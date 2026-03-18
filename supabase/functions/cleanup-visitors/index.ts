import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_RETENTION = [30, 60, 90, 180];
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

    const retentionMap: Record<string, number> = {};
    for (const type of VISITOR_TYPES) {
      const setting = settings?.find((s: any) => s.key === `retention_period_days_${type}`);
      const fallback = settings?.find((s: any) => s.key === "retention_period_days");
      const days = setting ? parseInt(setting.value, 10) : fallback ? parseInt(fallback.value, 10) : 60;
      retentionMap[type] = ALLOWED_RETENTION.includes(days) ? days : 60;
    }

    console.log("Cleanup: per-type retention =", retentionMap);

    let totalDeleted = 0;

    // 2. Delete per type with appropriate retention
    for (const type of VISITOR_TYPES) {
      const safeDays = retentionMap[type];
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
        .limit(BATCH_SIZE);

      if (stale && stale.length > 0) {
        const staleIds = stale.map((r: { id: string }) => r.id);
        await supabase.from("visitors").delete().in("id", staleIds);
        totalDeleted += staleIds.length;
      }
    }

    // 3. Log to audit_log
    await supabase.from("audit_log").insert({
      action: "automated_retention_cleanup",
      details: {
        retention_per_type: retentionMap,
        records_deleted: totalDeleted,
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
