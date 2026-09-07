import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { CredentialKey } from "@/lib/contractorCredentials";

export const MANDATORY_CREDENTIALS_KEY = "contractor_mandatory_credentials";

export function parseMandatoryCredentials(raw: string | null | undefined): CredentialKey[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((k): k is CredentialKey => k === "dbs" || k === "acws" || k === "insurance");
  } catch {
    return [];
  }
}

/**
 * Global (instance-wide) setting listing which contractor credentials are
 * mandatory before check-in. Same pattern as the `jurisdiction` setting.
 * Defaults to an empty list — nothing is mandatory until opted in.
 */
export function useMandatoryCredentials() {
  const [mandatory, setMandatory] = useState<CredentialKey[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("settings")
      .select("value")
      .eq("key", MANDATORY_CREDENTIALS_KEY)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setMandatory(parseMandatoryCredentials(data?.value));
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return { mandatory, loading };
}
