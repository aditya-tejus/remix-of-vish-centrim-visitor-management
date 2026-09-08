import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSite } from "@/contexts/SiteContext";

/**
 * Which credentials a given site insists on before a contractor may work
 * unsupervised. Stored per site so one home can require a police check while
 * another does not — nothing here is a legal requirement, it is the operator's
 * own policy.
 *
 * A site with no row of its own falls back to the "Required" tick on the
 * credential itself.
 */
const BASE_KEY = "contractor_mandatory_credentials";

const settingKey = (siteId: string | null | undefined) =>
  siteId ? `${BASE_KEY}@${siteId}` : BASE_KEY;

export async function fetchMandatoryCredentialKeys(siteId: string | null): Promise<string[] | null> {
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", settingKey(siteId))
    .maybeSingle();
  if (!data?.value) return null;
  try {
    const parsed = JSON.parse(data.value);
    return Array.isArray(parsed) ? parsed.map(String) : null;
  } catch {
    return null;
  }
}

export function useMandatoryCredentials() {
  const { currentSiteId } = useSite();
  const [keys, setKeys] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    setKeys(await fetchMandatoryCredentialKeys(currentSiteId));
    setLoading(false);
  }, [currentSiteId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  /** Turn a credential on or off for this site. Passing null clears the override. */
  const setForSite = useCallback(
    async (next: string[] | null) => {
      const key = settingKey(currentSiteId);
      if (next === null) {
        await supabase.from("settings").delete().eq("key", key);
      } else {
        await supabase
          .from("settings")
          .upsert({ key, value: JSON.stringify(next), updated_at: new Date().toISOString() }, { onConflict: "key" });
      }
      const { data: auth } = await supabase.auth.getUser();
      await supabase.from("audit_log").insert({
        action: "contractor_mandatory_credentials_changed",
        performed_by: auth.user?.email || "staff",
        user_id: auth.user?.id ?? null,
        records_affected: 1,
        details: { site_id: currentSiteId, credentials: next } as any,
      });
      await refetch();
    },
    [currentSiteId, refetch]
  );

  return { mandatoryKeys: keys, loading, refetch, setForSite, siteId: currentSiteId };
}
