import { useOperatingContext } from "@/contexts/OperatingContext";

export type SiteStructure = "rac" | "rv" | "mixed";

/**
 * A care home talks about wings and rooms; a retirement village talks about
 * stages and villas; a UK care home talks about units. Same data, different
 * words on screen. Wording now comes from the site's operating-context pack.
 */
export function useSiteStructure() {
  const { pack, loading } = useOperatingContext();
  const isVillage = pack.structure === "rv";

  return {
    structure: (isVillage ? "rv" : "rac") as SiteStructure,
    loading,
    isVillage,
    /** "Wing" / "Stage" / "Unit" */
    areaLabel: pack.terms.area,
    areaLabelPlural: pack.terms.areaPlural,
    /** "Room" / "Villa" */
    roomLabel: pack.terms.place,
    siteLabel: pack.terms.site,
    /** "Property" in a village, otherwise not used. */
    propertyLabel: pack.terms.property,
    householdLabel: pack.terms.household,
    responsibleLabel: pack.terms.responsible,
    associatesLabel: pack.terms.associates,
    showPropertyFields: pack.modules.propertyFields,
    showClinicalSupportFields: pack.modules.clinicalSupportFields,
  };
}
