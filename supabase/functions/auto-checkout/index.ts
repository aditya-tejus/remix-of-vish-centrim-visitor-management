import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Check if auto-checkout is enabled
    const { data: enabledSetting } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "auto_checkout_enabled")
      .single();

    if (!enabledSetting || enabledSetting.value !== "true") {
      console.log("Auto check-out is disabled, skipping.");
      return new Response(
        JSON.stringify({ success: true, message: "Auto check-out disabled", checked_out: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Get the configured hours threshold
    const { data: hoursSetting } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "auto_checkout_hours")
      .single();

    const hours = hoursSetting ? parseInt(hoursSetting.value, 10) : 12;
    const safeHours = [4, 8, 12, 24].includes(hours) ? hours : 12;

    // 3. Calculate the cutoff time
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - safeHours);
    const cutoffISO = cutoff.toISOString();

    console.log(`Auto check-out: threshold=${safeHours}h, cutoff=${cutoffISO}`);

    // 4. Find all visitors still checked in past the threshold
    const { data: staleVisitors, error: selectErr } = await supabase
      .from("visitors")
      .select("id, first_name, surname")
      .eq("status", "checked-in")
      .lt("check_in_time", cutoffISO)
      .limit(500);

    if (selectErr) throw new Error(`Select error: ${selectErr.message}`);

    if (!staleVisitors || staleVisitors.length === 0) {
      console.log("No stale visitors found.");
      return new Response(
        JSON.stringify({ success: true, checked_out: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Auto check-out each visitor
    const now = new Date().toISOString();
    const ids = staleVisitors.map((v: { id: string }) => v.id);

    const { error: updateErr } = await supabase
      .from("visitors")
      .update({
        status: "checked-out",
        check_out_time: now,
        comments: `Auto checked-out after ${safeHours} hours`,
      })
      .in("id", ids);

    if (updateErr) throw new Error(`Update error: ${updateErr.message}`);

    // 6. Log to audit trail
    await supabase.from("audit_log").insert({
      action: "auto_checkout",
      details: {
        threshold_hours: safeHours,
        cutoff_time: cutoffISO,
        visitors_checked_out: staleVisitors.map((v: any) => `${v.first_name} ${v.surname}`),
        count: ids.length,
      },
      records_affected: ids.length,
      performed_by: "system_cron",
    });

    console.log(`Auto check-out complete: ${ids.length} visitors checked out`);

    return new Response(
      JSON.stringify({
        success: true,
        checked_out: ids.length,
        threshold_hours: safeHours,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Auto check-out error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
