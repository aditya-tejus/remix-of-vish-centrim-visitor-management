import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Live count of visitors currently on site, plus the configured maximum
 * (`max_visitors_on_site` — empty/absent means no cap).
 */
export function useOccupancy(pollMs = 30000) {
  const [count, setCount] = useState(0);
  const [cap, setCap] = useState<number | null>(null);

  const load = useCallback(async () => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [{ count: onSite }, { data: setting }] = await Promise.all([
      supabase
        .from("visitors")
        .select("id", { count: "exact", head: true })
        .neq("type", "resident")
        .eq("status", "checked-in")
        .gte("check_in_time", todayStart.toISOString()),
      supabase.from("settings").select("value").eq("key", "max_visitors_on_site").maybeSingle(),
    ]);

    setCount(onSite || 0);
    const parsed = setting?.value ? parseInt(setting.value, 10) : NaN;
    setCap(Number.isFinite(parsed) && parsed > 0 ? parsed : null);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, pollMs);
    return () => clearInterval(t);
  }, [load, pollMs]);

  const atLimit = cap !== null && count >= cap;
  const nearLimit = cap !== null && !atLimit && count >= Math.ceil(cap * 0.8);

  return { count, cap, atLimit, nearLimit, refresh: load };
}
