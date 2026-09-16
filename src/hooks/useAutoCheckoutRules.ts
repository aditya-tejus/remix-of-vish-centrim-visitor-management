import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSite } from "@/contexts/SiteContext";
import {
  AutoCheckoutRule,
  AutoCheckoutPersonType,
  defaultRule,
} from "@/lib/autoCheckout";

function rowToRule(row: any, branchId: string, personType: AutoCheckoutPersonType): AutoCheckoutRule {
  return {
    branchId,
    personType,
    enabled: !!row.enabled,
    mode: row.mode,
    hours: row.hours ?? 12,
    endOfDayTime: (row.end_of_day_time ?? "22:00").slice(0, 5),
  };
}

/** Reads and writes one site's automatic sign-out rule for a single person type. */
export function useAutoCheckoutRule(personType: AutoCheckoutPersonType) {
  const { currentSiteId } = useSite();
  const [rule, setRule] = useState<AutoCheckoutRule | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!currentSiteId) {
      setRule(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from("auto_checkout_rules")
      .select("enabled, mode, hours, end_of_day_time")
      .eq("branch_id", currentSiteId)
      .eq("person_type", personType)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setRule(data ? rowToRule(data, currentSiteId, personType) : defaultRule(currentSiteId, personType));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentSiteId, personType]);

  const update = useCallback((patch: Partial<AutoCheckoutRule>) => {
    setRule((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const save = useCallback(async (): Promise<string | null> => {
    if (!rule || !currentSiteId) return "No site selected.";
    setSaving(true);
    const { error } = await supabase.from("auto_checkout_rules").upsert(
      {
        branch_id: currentSiteId,
        person_type: personType,
        enabled: rule.enabled,
        mode: rule.mode,
        hours: rule.hours,
        end_of_day_time: `${rule.endOfDayTime}:00`,
      },
      { onConflict: "branch_id,person_type" }
    );
    setSaving(false);
    return error ? error.message : null;
  }, [rule, currentSiteId, personType]);

  return { rule, loading, saving, update, save };
}
