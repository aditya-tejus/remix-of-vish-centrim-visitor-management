import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSite } from "@/contexts/SiteContext";

export interface PersonMatch {
  id: string;
  firstName: string;
  surname: string;
  mobile: string | null;
  email: string | null;
  /** True when a contact detail matched exactly, not just the name. */
  strongMatch: boolean;
}

/**
 * Finds people already known at the current site so a companion can be
 * recognised instead of created again. A name on its own is only ever a
 * suggestion — reception must choose the person deliberately.
 */
export function usePeopleLookup(query: string) {
  const { currentSiteId, isLegacySite } = useSite();
  const [matches, setMatches] = useState<PersonMatch[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setMatches([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      let request = supabase
        .from("people")
        .select("id, first_name, surname, mobile, email")
        .eq("is_active", true)
        .or(`first_name.ilike.%${term}%,surname.ilike.%${term}%,mobile.ilike.%${term}%,email.ilike.%${term}%`)
        .limit(6);

      if (currentSiteId) {
        request = isLegacySite
          ? request.or(`branch_id.eq.${currentSiteId},branch_id.is.null`)
          : request.eq("branch_id", currentSiteId);
      }

      const { data } = await request;
      if (cancelled) return;
      const digits = term.replace(/[^0-9]/g, "");
      setMatches(
        (data || []).map((p) => ({
          id: p.id as string,
          firstName: p.first_name as string,
          surname: p.surname as string,
          mobile: (p.mobile as string) ?? null,
          email: (p.email as string) ?? null,
          strongMatch:
            (!!digits && digits.length >= 6 && (p.mobile || "").replace(/[^0-9]/g, "") === digits) ||
            (term.includes("@") && (p.email || "").toLowerCase() === term.toLowerCase()),
        }))
      );
      setSearching(false);
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, currentSiteId, isLegacySite]);

  return { matches, searching };
}
