import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSite } from "@/contexts/SiteContext";
import { dbToVisitor, type DbVisitor } from "@/hooks/useVisitors";
import type { Visitor } from "@/types/visitor";

/**
 * Arrivals between two dates at the current site (residents excluded — they are
 * not visits). Used by the visit calendar, which previously only saw today's list.
 */
export function useVisitsInRange(from: Date, to: Date) {
  const { currentSiteId, isLegacySite } = useSite();
  const [visits, setVisits] = useState<Visitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const revision = useRef(0);
  const fromIso = from.toISOString();
  const toIso = to.toISOString();

  const refetch = useCallback(async () => {
    const request = ++revision.current;
    if (!currentSiteId) { setVisits([]); setLoading(false); return; }
    setLoading(true);
    let query = supabase
      .from("visitors")
      .select("*")
      .neq("type", "resident")
      .gte("check_in_time", fromIso)
      .lt("check_in_time", toIso);
    query = isLegacySite
      ? query.or(`branch_id.eq.${currentSiteId},branch_id.is.null`)
      : query.eq("branch_id", currentSiteId);
    const { data, error } = await query.order("check_in_time", { ascending: true }).limit(5000);
    if (request !== revision.current) return;
    if (error) setError("We could not load visits for this month. Check the connection and try again.");
    else { setError(null); setVisits(((data || []) as unknown as DbVisitor[]).map(dbToVisitor)); }
    setLoading(false);
  }, [currentSiteId, isLegacySite, fromIso, toIso]);

  useEffect(() => { void refetch(); }, [refetch]);
  return { visits, loading, error, refetch };
}
