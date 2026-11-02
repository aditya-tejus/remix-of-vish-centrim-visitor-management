import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSite } from "@/contexts/SiteContext";
import { dbToVisitor, type DbVisitor } from "@/hooks/useVisitors";
import { buildDirectory } from "@/lib/visitorDirectory";
import type { Visitor } from "@/types/visitor";

/** How many arrivals are read for the directory. Older history is reached through reports. */
export const DIRECTORY_HISTORY_LIMIT = 2000;

/**
 * Everyone who has visited the current site (not only today's arrivals), one
 * entry per person. Residents are excluded — they have their own section.
 * Signed-in staff only; site isolation follows the same rule as the visit list.
 */
export function useVisitorDirectory() {
  const { currentSiteId, isLegacySite } = useSite();
  const [history, setHistory] = useState<Visitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);
  const revision = useRef(0);

  const refetch = useCallback(async () => {
    const request = ++revision.current;
    if (!currentSiteId) { setHistory([]); setLoading(false); return; }
    setLoading(true);
    let query = supabase.from("visitors").select("*").neq("type", "resident");
    query = isLegacySite
      ? query.or(`branch_id.eq.${currentSiteId},branch_id.is.null`)
      : query.eq("branch_id", currentSiteId);
    const { data, error } = await query
      .order("check_in_time", { ascending: false })
      .limit(DIRECTORY_HISTORY_LIMIT);
    if (request !== revision.current) return;
    if (error) {
      setError("We could not load visitor profiles. Check the connection and try again.");
    } else {
      setError(null);
      const rows = (data || []) as unknown as DbVisitor[];
      setHistory(rows.map(dbToVisitor));
      setTruncated(rows.length >= DIRECTORY_HISTORY_LIMIT);
    }
    setLoading(false);
  }, [currentSiteId, isLegacySite]);

  useEffect(() => { void refetch(); }, [refetch]);

  const entries = useMemo(() => buildDirectory(history), [history]);
  return { entries, history, loading, error, truncated, refetch };
}
