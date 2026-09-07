import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_RETENTION = [30, 60, 90, 180, 365, 1095, 2555];
const NEVER = "never";
const BATCH_SIZE = 500;
const VISITOR_TYPES = ["visitor", "contractor", "resident"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Fetch per-type retention periods
    const { data: settings } = await supabase
      .from("settings")
      .select("key, value")
      .like("key", "retention_period_days%");

    // null = never auto-delete for that type
    const retentionMap: Record<string, number | null> = {};
    for (const type of VISITOR_TYPES) {
      const setting = settings?.find((s: any) => s.key === `retention_period_days_${type}`);
      const fallback = settings?.find((s: any) => s.key === "retention_period_days");
      const raw = setting?.value ?? fallback?.value ?? "60";
      if (raw === NEVER) {
        retentionMap[type] = null;
        continue;
      }
      const days = parseInt(raw, 10);
      retentionMap[type] = ALLOWED_RETENTION.includes(days) ? days : 60;
    }

    console.log("Cleanup: per-type retention =", retentionMap);

    let totalDeleted = 0;

    // 2. Delete per type with appropriate retention
    for (const type of VISITOR_TYPES) {
      const safeDays = retentionMap[type];
      // "Never delete" configured for this type — skip entirely
      if (safeDays === null) {
        console.log(`Cleanup: ${type} set to never auto-delete — skipped`);
        continue;
      }
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - safeDays);
      const cutoffISO = cutoff.toISOString();

      // Delete checked-out records past retention
      let hasMore = true;
      while (hasMore) {
        const { data: batch, error: selectErr } = await supabase
          .from("visitors")
          .select("id")
          .eq("type", type)
          .lt("check_in_time", cutoffISO)
          .neq("status", "checked-in")
          .eq("legal_hold", false)
          .limit(BATCH_SIZE);

        if (selectErr) throw new Error(`Select error (${type}): ${selectErr.message}`);
        if (!batch || batch.length === 0) { hasMore = false; break; }

        const ids = batch.map((r: { id: string }) => r.id);
        const { error: deleteErr } = await supabase.from("visitors").delete().in("id", ids);
        if (deleteErr) throw new Error(`Delete error (${type}): ${deleteErr.message}`);

        totalDeleted += ids.length;
        if (batch.length < BATCH_SIZE) hasMore = false;
      }

      // Handle stale checked-in visitors (retention + 7 days grace)
      const staleCutoff = new Date();
      staleCutoff.setDate(staleCutoff.getDate() - safeDays - 7);
      const staleCutoffISO = staleCutoff.toISOString();

      const { data: stale } = await supabase
        .from("visitors")
        .select("id")
        .eq("type", type)
        .eq("status", "checked-in")
        .lt("check_in_time", staleCutoffISO)
        .eq("legal_hold", false)
        .limit(BATCH_SIZE);

      if (stale && stale.length > 0) {
        const staleIds = stale.map((r: { id: string }) => r.id);
        await supabase.from("visitors").delete().in("id", staleIds);
        totalDeleted += staleIds.length;
      }
    }

    // 2b. Food register records follow the VISITOR retention period.
    //     Records linked to a visitor under legal hold are exempt.
    let foodDeleted = 0;
    const foodDays = retentionMap["visitor"];
    if (foodDays === null) {
      console.log("Cleanup: food register set to never auto-delete (visitor retention) — skipped");
    } else {
      const foodCutoff = new Date();
      foodCutoff.setDate(foodCutoff.getDate() - foodDays);
      const foodCutoffISO = foodCutoff.toISOString();

      // Visitor ids currently under legal hold — their food records are protected.
      const { data: heldVisitors } = await supabase
        .from("visitors")
        .select("id")
        .eq("legal_hold", true);
      const heldIds: string[] = (heldVisitors || []).map((r: { id: string }) => r.id);

      let foodMore = true;
      while (foodMore) {
        let q = supabase
          .from("food_register")
          .select("id, visitor_id, resident_visitor_id")
          .lt("recorded_at", foodCutoffISO)
          .limit(BATCH_SIZE);

        const { data: foodBatch, error: foodSelErr } = await q;
        if (foodSelErr) throw new Error(`Select error (food_register): ${foodSelErr.message}`);
        if (!foodBatch || foodBatch.length === 0) break;

        const deletable = foodBatch
          .filter(
            (r: any) =>
              !heldIds.includes(r.visitor_id) && !heldIds.includes(r.resident_visitor_id)
          )
          .map((r: any) => r.id);

        if (deletable.length > 0) {
          const { error: foodDelErr } = await supabase
            .from("food_register")
            .delete()
            .in("id", deletable);
          if (foodDelErr) throw new Error(`Delete error (food_register): ${foodDelErr.message}`);
          foodDeleted += deletable.length;
        }

        // Nothing deletable in this batch (all under legal hold) — stop to avoid looping.
        if (foodBatch.length < BATCH_SIZE || deletable.length === 0) foodMore = false;
      }
      totalDeleted += foodDeleted;
      console.log(`Cleanup: ${foodDeleted} food register records deleted`);
    }

    // 3. Log to audit_log
    await supabase.from("audit_log").insert({
      action: "automated_retention_cleanup",
      details: {
        retention_per_type: retentionMap,
        records_deleted: totalDeleted,
        food_records_deleted: foodDeleted,
      },
      records_affected: totalDeleted,
      performed_by: "system_cron",
    });

    console.log(`Cleanup complete: ${totalDeleted} records deleted`);

    return new Response(
      JSON.stringify({
        success: true,
        records_deleted: totalDeleted,
        retention_per_type: retentionMap,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Cleanup error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
