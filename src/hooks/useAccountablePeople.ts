import { useMemo } from "react";
import type { Visitor } from "@/types/visitor";
import { useAttendance } from "@/hooks/useAttendance";
import { useSite } from "@/contexts/SiteContext";
import { buildAccountableRows, type AccountableRow } from "@/lib/accountablePeople";

/**
 * One row per accountable person for the arrivals passed in, scoped to the
 * current site. Attendance records win; older arrivals fall back to the saved
 * visitor record and are marked as legacy. Nothing is merged or collapsed.
 */
export function useAccountablePeople(visitors: Visitor[]) {
  const { parties, loading, checkOutPeople, refresh } = useAttendance();
  const { currentSiteId, isLegacySite } = useSite();

  const rows: AccountableRow[] = useMemo(
    () =>
      buildAccountableRows(visitors, parties, {
        siteId: currentSiteId,
        includeUnassigned: isLegacySite,
      }),
    [visitors, parties, currentSiteId, isLegacySite]
  );

  return { rows, parties, loading, checkOutPeople, refresh };
}
