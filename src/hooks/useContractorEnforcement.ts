import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type CredentialEnforcement = "warn" | "block";

/**
 * Global (instance-wide) setting controlling whether a missing/expired
 * highest-risk contractor credential blocks check-in or only warns staff.
 * Same pattern as the `jurisdiction` setting.
 */
export function useContractorEnforcement() {
  const [enforcement, setEnforcement] = useState<CredentialEnforcement>("warn");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("settings")
      .select("value")
      .eq("key", "contractor_credential_enforcement")
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        if (data?.value === "block" || data?.value === "warn") setEnforcement(data.value);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return { enforcement, loading, isBlocking: enforcement === "block" };
}
