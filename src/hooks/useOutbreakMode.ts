import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Reads (and, for admins, writes) the global `outbreak_mode` setting.
 * When on, the kiosk hard-blocks check-in on any positive health answer
 * or high temperature instead of showing a staff-review warning.
 */
export function useOutbreakMode(pollMs = 60000) {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "outbreak_mode")
      .maybeSingle();
    setEnabled(data?.value === "true");
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, pollMs);
    return () => clearInterval(t);
  }, [load, pollMs]);

  const setOutbreakMode = useCallback(async (next: boolean, performedBy?: string) => {
    setSaving(true);
    const { error } = await supabase
      .from("settings")
      .upsert({ key: "outbreak_mode", value: next ? "true" : "false" }, { onConflict: "key" });
    if (!error) {
      setEnabled(next);
      await supabase.from("audit_log").insert({
        action: "outbreak_mode_changed",
        details: { enabled: next },
        performed_by: performedBy || "staff",
      });
    }
    setSaving(false);
    return !error;
  }, []);

  return { enabled, loading, saving, setOutbreakMode, refresh: load };
}
