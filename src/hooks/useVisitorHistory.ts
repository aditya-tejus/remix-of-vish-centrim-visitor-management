import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Visitor } from "@/types/visitor";
import { useSite } from "@/contexts/SiteContext";

export interface VisitHistoryEntry {
  id: string;
  checkInTime: Date;
  checkOutTime: Date | null;
  status: string;
  type: string;
  whomToVisit: string;
  visitedResidentIds: string[];
  comments: string;
  companionDetails: any[];
  additionalVisitors: number;
  healthAnswers: Record<string, any>;
  bodyTemperature: number | null;
  checkoutReason: string | null;
  leaveType: string | null;
  /** Where this line came from: an attendance record, or an older saved record. */
  source: "canonical" | "legacy";
  /** How this person was on that visit. */
  role: "primary" | "companion" | "unknown";
}


/**
 * A person's full visit history, not just today's records.
 * Matched on the stable person code first, then name + phone.
 */
export function useVisitorHistory(visitor: Visitor | null | undefined) {
  const { currentSiteId, isLegacySite } = useSite();
  const [visits, setVisits] = useState<VisitHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const personQr = visitor?.personQr;
  const firstName = visitor?.firstName;
  const surname = visitor?.surname;
  const mobile = visitor?.mobile;

  useEffect(() => {
    let active = true;
    if (!firstName && !personQr) { setVisits([]); setLoading(false); return; }

    const map = (rows: any[]): VisitHistoryEntry[] =>
      rows.map((r) => ({
        id: r.id,
        checkInTime: new Date(r.check_in_time),
        checkOutTime: r.check_out_time ? new Date(r.check_out_time) : null,
        status: r.status,
        type: r.type,
        whomToVisit: r.whom_to_visit || "",
        visitedResidentIds: r.visited_resident_ids || [],
        comments: r.comments || "",
        companionDetails: r.companion_details || [],
        additionalVisitors: r.additional_visitors || 0,
        healthAnswers: r.health_answers || {},
        bodyTemperature: r.body_temperature ?? null,
        checkoutReason: r.checkout_reason ?? null,
        leaveType: r.leave_type ?? null,
      }));

    (async () => {
      setLoading(true);
      let rows: any[] = [];

      /** History never crosses site boundaries. */
      const scoped = (q: any) => {
        if (!currentSiteId) return q;
        return isLegacySite
          ? q.or(`branch_id.eq.${currentSiteId},branch_id.is.null`)
          : q.eq("branch_id", currentSiteId);
      };

      if (personQr) {
        const { data } = await scoped(
          supabase.from("visitors").select("*").eq("person_qr", personQr)
        )
          .order("check_in_time", { ascending: false })
          .limit(200);
        rows = data || [];
      }

      if (rows.length === 0 && firstName && surname) {
        let query = scoped(
          supabase.from("visitors").select("*").ilike("first_name", firstName).ilike("surname", surname)
        );
        if (mobile) query = query.eq("mobile", mobile);
        const { data } = await query.order("check_in_time", { ascending: false }).limit(200);
        rows = data || [];
      }

      if (!active) return;
      setVisits(map(rows));
      setLoading(false);
    })();

    return () => { active = false; };
  }, [visitor?.id, personQr, firstName, surname, mobile, currentSiteId, isLegacySite]);

  return { visits, loading };
}
