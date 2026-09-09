import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Visitor } from "@/types/visitor";
import type { CanonicalPartyInput, LegacyVisitInput } from "@/lib/weeklyReport";

/**
 * Everyone recorded at one site between two instants. Attendance records first;
 * saved visitor records are read only so that visits with no attendance record
 * are still counted, and they are handed back marked as legacy.
 */
export function useWeeklyVisitReport(siteId: string | null, from: Date, to: Date) {
  const [canonical, setCanonical] = useState<CanonicalPartyInput[]>([]);
  const [legacy, setLegacy] = useState<LegacyVisitInput[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fromIso = from.toISOString();
  const toIso = to.toISOString();

  useEffect(() => {
    let active = true;
    if (!siteId) {
      setCanonical([]);
      setLegacy([]);
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);
      setError(null);

      const { data: partyRows, error: partyError } = await supabase
        .from("visit_parties")
        .select(
          "id, visit_id, display_name, relationship, is_primary, companion_index, name_status, check_in_time, check_out_time, visits!inner(branch_id, person_type, destination_label, legacy_visitor_id)"
        )
        .gte("check_in_time", fromIso)
        .lt("check_in_time", toIso)
        .eq("visits.branch_id", siteId)
        .order("check_in_time", { ascending: false })
        .limit(2000);

      const { data: visitorRows, error: visitorError } = await supabase
        .from("visitors")
        .select(
          "id, first_name, surname, type, check_in_time, check_out_time, status, whom_to_visit, additional_visitors, companion_details, screening_outcome, branch_id"
        )
        .gte("check_in_time", fromIso)
        .lt("check_in_time", toIso)
        .eq("branch_id", siteId)
        .order("check_in_time", { ascending: false })
        .limit(2000);

      if (!active) return;

      if (partyError || visitorError) {
        setError("We could not load the report. Please try again.");
        setLoading(false);
        return;
      }

      setCanonical(
        ((partyRows as any[]) || []).map((row) => ({
          id: row.id,
          visitId: row.visit_id,
          branchId: row.visits?.branch_id ?? null,
          personType: row.visits?.person_type ?? "visitor",
          destinationLabel: row.visits?.destination_label ?? null,
          displayName: row.display_name,
          nameStatus: row.name_status,
          isPrimary: row.is_primary,
          companionIndex: row.companion_index,
          relationship: row.relationship,
          checkInTime: new Date(row.check_in_time),
          checkOutTime: row.check_out_time ? new Date(row.check_out_time) : null,
          legacyVisitorId: row.visits?.legacy_visitor_id ?? null,
          screeningOutcome: null,
        }))
      );

      setLegacy(
        ((visitorRows as any[]) || []).map((row) => ({
          branchId: row.branch_id ?? null,
          visitor: {
            id: row.id,
            firstName: row.first_name,
            surname: row.surname,
            type: row.type,
            checkInTime: new Date(row.check_in_time),
            checkOutTime: row.check_out_time ? new Date(row.check_out_time) : null,
            status: row.status,
            whomToVisit: row.whom_to_visit || "",
            additionalVisitors: row.additional_visitors || 0,
            companionDetails: row.companion_details || [],
            screeningOutcome: row.screening_outcome ?? undefined,
          } as unknown as Visitor,
        }))
      );
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [siteId, fromIso, toIso]);

  return { canonical, legacy, loading, error };
}
