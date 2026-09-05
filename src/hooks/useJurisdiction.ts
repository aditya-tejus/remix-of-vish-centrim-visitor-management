import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Jurisdiction = "AU" | "UK";

/**
 * Reads the facility's configured jurisdiction from settings.
 * Drives which privacy regime (Australian Privacy Act 1988 / APPs vs UK GDPR)
 * is referenced in compliance copy, checklists and privacy notices.
 */
export function useJurisdiction() {
  const [jurisdiction, setJurisdiction] = useState<Jurisdiction>("AU");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("settings")
      .select("value")
      .eq("key", "jurisdiction")
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        if (data?.value === "UK" || data?.value === "AU") setJurisdiction(data.value);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const isUK = jurisdiction === "UK";

  return {
    jurisdiction,
    loading,
    isUK,
    /** e.g. "UK GDPR" / "Australian Privacy Act 1988" */
    regimeName: isUK ? "UK GDPR" : "Australian Privacy Act 1988",
    regimeShort: isUK ? "UK GDPR" : "Privacy Act 1988 (Cth)",
    principlesName: isUK ? "GDPR Articles" : "Australian Privacy Principles (APPs)",
    regulator: isUK ? "Information Commissioner's Office (ICO)" : "Office of the Australian Information Commissioner (OAIC)",
    controllerTerm: isUK ? "Data Controller" : "APP Entity",
    subjectAccessTerm: isUK ? "Subject Access Request (SAR)" : "Access Request (APP 12)",
    accessDeadline: isUK ? "30-day statutory deadline (Art. 15/20)" : "30-day response period (APP 12)",
    erasureRef: isUK ? "Art. 17" : "APP 11.2",
    portabilityRef: isUK ? "Art. 20" : "APP 12.5",
  };
}
