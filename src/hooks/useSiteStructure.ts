import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SiteStructure = "rac" | "rv" | "mixed";

/**
 * A care home talks about wings and rooms; a retirement village talks about
 * stages and villas. Same data, different words on screen.
 */
export function useSiteStructure() {
  const [structure, setStructure] = useState<SiteStructure>("rac");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("settings")
      .select("value")
      .eq("key", "site_structure")
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        if (data?.value === "rv" || data?.value === "mixed" || data?.value === "rac") {
          setStructure(data.value);
        }
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const isVillage = structure === "rv";

  return {
    structure,
    loading,
    isVillage,
    /** "Wing" / "Stage" */
    areaLabel: isVillage ? "Stage" : "Wing",
    areaLabelPlural: isVillage ? "Stages" : "Wings",
    /** "Room" / "Villa" */
    roomLabel: isVillage ? "Villa" : "Room",
    siteLabel: structure === "mixed" ? "Site" : isVillage ? "Village" : "Home",
  };
}
