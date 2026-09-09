import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSite } from "@/contexts/SiteContext";

export interface AttendanceParty {
  id: string;
  visitId: string;
  legacyVisitorId: string | null;
  personId: string | null;
  displayName: string;
  relationship: string | null;
  isPrimary: boolean;
  companionIndex: number;
  /** "named" or "unresolved" — an unresolved person was counted but never named. */
  nameStatus: string;
  checkInTime: Date;
  checkOutTime: Date | null;
}

/**
 * Everyone recorded as being on a visit — the main visitor and each companion —
 * as individually accountable people. This is the attendance source of truth;
 * the older visitor record stays in place for compatibility.
 */
export function useAttendance(options: { onlyOpen?: boolean } = {}) {
  const { onlyOpen = false } = options;
  const { currentSiteId, isLegacySite } = useSite();
  const [parties, setParties] = useState<AttendanceParty[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchParties = useCallback(async () => {
    let query = supabase
      .from("visit_parties")
      .select(
        "id, visit_id, person_id, display_name, relationship, is_primary, companion_index, name_status, check_in_time, check_out_time, visits!inner(branch_id, legacy_visitor_id)"
      )
      .order("companion_index", { ascending: true })
      .limit(1000);

    if (onlyOpen) query = query.is("check_out_time", null);
    if (currentSiteId) {
      query = isLegacySite
        ? query.or(`branch_id.eq.${currentSiteId},branch_id.is.null`, { foreignTable: "visits" })
        : query.eq("visits.branch_id", currentSiteId);
    }

    const { data, error } = await query;
    if (!error && data) {
      setParties(
        (data as any[]).map((row) => ({
          id: row.id,
          visitId: row.visit_id,
          legacyVisitorId: row.visits?.legacy_visitor_id ?? null,
          personId: row.person_id,
          displayName: row.display_name,
          relationship: row.relationship,
          isPrimary: row.is_primary,
          companionIndex: row.companion_index,
          nameStatus: row.name_status,
          checkInTime: new Date(row.check_in_time),
          checkOutTime: row.check_out_time ? new Date(row.check_out_time) : null,
        }))
      );
    }
    setLoading(false);
  }, [currentSiteId, isLegacySite, onlyOpen]);

  useEffect(() => {
    fetchParties();
    const channel = supabase
      .channel("visit-parties-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "visit_parties" }, () => fetchParties())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchParties]);

  /** Records a departure for one person, several people, or a whole group. */
  const checkOutPeople = useCallback(
    async (partyIds: string[], at?: Date, reason?: string) => {
      const { error } = await supabase.rpc("check_out_party" as any, {
        p_party_ids: partyIds,
        p_time: (at ?? new Date()).toISOString(),
        p_reason: reason ?? null,
      });
      if (error) throw error;
      await fetchParties();
    },
    [fetchParties]
  );

  return { parties, loading, refresh: fetchParties, checkOutPeople };
}
