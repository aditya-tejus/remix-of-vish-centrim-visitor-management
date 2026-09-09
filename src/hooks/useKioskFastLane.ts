import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { siteScopedKey, useOperatingContext } from "@/contexts/OperatingContext";

/**
 * Whether this site issues personal visitor cards / visit codes and offers the
 * kiosk "Fast Lane". When it is off the kiosk must not show the tile at all —
 * an option that can never succeed is worse than no option.
 */
export function useKioskFastLane() {
  const { siteId } = useOperatingContext();
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const scoped = siteId ? siteScopedKey("kiosk_fast_lane_enabled", siteId) : null;
    const keys = scoped ? [scoped, "kiosk_fast_lane_enabled"] : ["kiosk_fast_lane_enabled"];
    supabase
      .from("settings")
      .select("key, value")
      .in("key", keys)
      .then(({ data }) => {
        if (cancelled) return;
        const value =
          (scoped ? data?.find((d) => d.key === scoped)?.value : undefined) ??
          data?.find((d) => d.key === "kiosk_fast_lane_enabled")?.value;
        setEnabled(value === "true");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [siteId]);

  return { fastLaneEnabled: enabled, fastLaneLoading: loading };
}
