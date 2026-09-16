import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  AutoCheckoutRule,
  isDueForAutoCheckout,
  reasonForRule,
} from "./rules.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Hourly automatic sign-out.
 *
 * Each site decides, per person type, whether people still signed in are closed
 * off after a set number of hours, at an end-of-day time in the site's own local
 * time, or whichever comes first. Residents are never included. Records closed
 * this way are marked as automatic so nobody mistakes them for an observed
 * departure.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const now = new Date();

    const { data: rules, error: rulesErr } = await supabase
      .from("auto_checkout_rules")
      .select("branch_id, person_type, enabled, mode, hours, end_of_day_time")
      .eq("enabled", true);
    if (rulesErr) throw new Error(`Rules: ${rulesErr.message}`);

    if (!rules || rules.length === 0) {
      return new Response(
        JSON.stringify({ success: true, checked_out: 0, sites: 0, message: "No sites use automatic sign-out" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const branchIds = [...new Set(rules.map((r: any) => r.branch_id))];
    const { data: branches, error: branchErr } = await supabase
      .from("branches")
      .select("id, name, timezone")
      .in("id", branchIds);
    if (branchErr) throw new Error(`Branches: ${branchErr.message}`);

    const zoneOf = new Map<string, string>(
      (branches || []).map((b: any) => [b.id, b.timezone || "UTC"]),
    );
    const nameOf = new Map<string, string>(
      (branches || []).map((b: any) => [b.id, b.name]),
    );

    let totalClosed = 0;
    const perSite: Record<string, number> = {};

    for (const branchId of branchIds) {
      const timeZone = zoneOf.get(branchId) || "UTC";
      const siteRules = rules.filter((r: any) => r.branch_id === branchId);
      const types = siteRules.map((r: any) => r.person_type);

      const { data: onSite, error: onSiteErr } = await supabase
        .from("visitors")
        .select("id, type, check_in_time, companion_details")
        .eq("branch_id", branchId)
        .eq("status", "checked-in")
        .in("type", types)
        .limit(1000);
      if (onSiteErr) throw new Error(`Visitors: ${onSiteErr.message}`);
      if (!onSite || onSite.length === 0) continue;

      // Group by the exact reason so each record carries an honest note.
      const due: { id: string; reason: string; companions: any[] }[] = [];
      const reasons = new Set<string>();

      for (const row of onSite) {
        const raw = siteRules.find((r: any) => r.person_type === row.type);
        if (!raw) continue;
        const rule: AutoCheckoutRule = {
          branchId,
          personType: raw.person_type,
          enabled: raw.enabled,
          mode: raw.mode,
          hours: raw.hours,
          endOfDayTime: String(raw.end_of_day_time).slice(0, 5),
        };
        const decision = isDueForAutoCheckout({
          rule,
          checkInTime: new Date(row.check_in_time),
          now,
          timeZone,
        });
        if (!decision.due || !decision.trigger) continue;
        const reason = reasonForRule(rule, decision.trigger);
        const list = batches.get(reason) || [];
        list.push(row.id);
        batches.set(reason, list);
      }

      let siteClosed = 0;
      const stamp = now.toISOString();

      for (const [reason, ids] of batches) {
        const { error: updErr } = await supabase
          .from("visitors")
          .update({
            status: "checked-out",
            check_out_time: stamp,
            auto_checked_out: true,
            checkout_reason: reason,
          })
          .in("id", ids)
          .eq("status", "checked-in");
        if (updErr) throw new Error(`Update: ${updErr.message}`);

        // Close the matching attendance rows so the on-site count stays honest.
        await supabase
          .from("visit_parties")
          .update({ check_out_time: stamp })
          .in("visitor_id", ids)
          .is("check_out_time", null);

        siteClosed += ids.length;
      }

      if (siteClosed > 0) {
        totalClosed += siteClosed;
        perSite[nameOf.get(branchId) || branchId] = siteClosed;

        await supabase.from("audit_log").insert({
          action: "auto_checkout",
          details: {
            site: nameOf.get(branchId) || branchId,
            branch_id: branchId,
            timezone: timeZone,
            rules: siteRules.map((r: any) => ({
              person_type: r.person_type,
              mode: r.mode,
              hours: r.hours,
              end_of_day_time: String(r.end_of_day_time).slice(0, 5),
            })),
            reasons: [...batches.keys()],
            count: siteClosed,
          },
          records_affected: siteClosed,
          performed_by: "system_auto_checkout",
        });
      }
    }

    console.log(`Automatic sign-out complete: ${totalClosed} records`, perSite);

    return new Response(
      JSON.stringify({ success: true, checked_out: totalClosed, per_site: perSite }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Automatic sign-out error:", error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
