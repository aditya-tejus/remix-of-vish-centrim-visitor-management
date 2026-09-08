/**
 * Stage 4 — operating-context packs.
 *
 * One product, three operating contexts. A pack is pure configuration: wording,
 * which optional registers apply, how the roll call is grouped and which privacy
 * regime is referenced. No forks, no customer-specific content.
 *
 * A pack never proves legal compliance on its own — it only makes the product
 * say and ask the right things for the context it is running in.
 */

export type Jurisdiction = "AU" | "UK";
/** Stored on the site record (`branches.site_structure`). */
export type SiteSegmentKey = "rac" | "rv" | "care_home";
export type SegmentPackId = "au_rac" | "au_rv" | "uk_care";

export interface SegmentTerms {
  /** "Home", "Village", "Care home" */
  site: string;
  /** "Wing", "Stage", "Unit" */
  area: string;
  areaPlural: string;
  /** "Room", "Villa", "Room" */
  place: string;
  placePlural: string;
  /** Optional grouping above the place — retirement villages only. */
  property: string | null;
  household: string | null;
  resident: string;
  residentPlural: string;
  /** What the visitor is asked on check-in. */
  destination: string;
  /** Person accountable in an emergency. */
  responsible: string;
  associates: string;
}

export interface SegmentModules {
  /** Resident leave and return as its own workflow. */
  residentLeave: boolean;
  keysRegister: boolean;
  foodRegister: boolean;
  /** Villa/property/stage fields on residents and roll call. */
  propertyFields: boolean;
  household: boolean;
  /** Clinical / care-support labels (care level, mobility aids, DoLS-LPS). */
  clinicalSupportFields: boolean;
  /** Infection-control screening questions offered by default. */
  infectionControl: boolean;
  /** Safeguarding and staff-review wording. */
  safeguardingWording: boolean;
  /** Village warden / responsible staff shown on roll call. */
  warden: boolean;
}

export interface SegmentPack {
  id: SegmentPackId;
  label: string;
  shortLabel: string;
  jurisdiction: Jurisdiction;
  structure: SiteSegmentKey;
  description: string;
  terms: SegmentTerms;
  modules: SegmentModules;
  /** Roll-call grouping, outermost first. */
  emergencyGrouping: string[];
  /** Contractor document wording that applies in this context. */
  credentialLabels: string[];
  privacy: {
    regimeName: string;
    regulator: string;
    controllerTerm: string;
    /** Deliberately empty: retention periods are a customer/legal decision. */
    retentionNote: string;
  };
}

const AU_PRIVACY = {
  regimeName: "Australian Privacy Act 1988",
  regulator: "Office of the Australian Information Commissioner (OAIC)",
  controllerTerm: "APP Entity",
  retentionNote:
    "Retention period is set by your organisation. No default period is assumed by this system.",
};

const UK_PRIVACY = {
  regimeName: "UK GDPR",
  regulator: "Information Commissioner's Office (ICO)",
  controllerTerm: "Data Controller",
  retentionNote:
    "Retention period and controller details must be entered by your organisation. No default period is assumed by this system.",
};

export const SEGMENT_PACKS: Record<SegmentPackId, SegmentPack> = {
  au_rac: {
    id: "au_rac",
    label: "Australia — residential aged care",
    shortLabel: "AU aged care",
    jurisdiction: "AU",
    structure: "rac",
    description:
      "Rooms and wings, resident leave and return, infection-control questions, roll call grouped by wing.",
    terms: {
      site: "Home",
      area: "Wing",
      areaPlural: "Wings",
      place: "Room",
      placePlural: "Rooms",
      property: null,
      household: null,
      resident: "Resident",
      residentPlural: "Residents",
      destination: "Who are you visiting?",
      responsible: "Staff responsible",
      associates: "People with them",
    },
    modules: {
      residentLeave: true,
      keysRegister: true,
      foodRegister: true,
      propertyFields: false,
      household: false,
      clinicalSupportFields: true,
      infectionControl: true,
      safeguardingWording: true,
      warden: false,
    },
    emergencyGrouping: ["Wing", "Room", "Person type"],
    credentialLabels: ["Police check", "NDIS worker screening", "Insurance"],
    privacy: AU_PRIVACY,
  },
  au_rv: {
    id: "au_rv",
    label: "Australia — retirement village",
    shortLabel: "AU village",
    jurisdiction: "AU",
    structure: "rv",
    description:
      "Properties, stages and villas, households and associated people, keys and fobs register, roll call grouped by stage and villa.",
    terms: {
      site: "Village",
      area: "Stage",
      areaPlural: "Stages",
      place: "Villa",
      placePlural: "Villas",
      property: "Property",
      household: "Household",
      resident: "Resident",
      residentPlural: "Residents",
      destination: "Which villa are you visiting?",
      responsible: "Warden responsible",
      associates: "Household and associates",
    },
    modules: {
      residentLeave: true,
      keysRegister: true,
      foodRegister: false,
      propertyFields: true,
      household: true,
      clinicalSupportFields: false,
      infectionControl: false,
      safeguardingWording: false,
      warden: true,
    },
    emergencyGrouping: ["Stage", "Property / villa", "Household", "Person type"],
    credentialLabels: ["Police check", "Insurance", "Trade licence"],
    privacy: AU_PRIVACY,
  },
  uk_care: {
    id: "uk_care",
    label: "UK — care home / housing with care",
    shortLabel: "UK care home",
    jurisdiction: "UK",
    structure: "care_home",
    description:
      "Rooms and units, UK wording, DBS and safeguarding checks, UK privacy notice and controller details, roll call grouped by unit.",
    terms: {
      site: "Care home",
      area: "Unit",
      areaPlural: "Units",
      place: "Room",
      placePlural: "Rooms",
      property: null,
      household: null,
      resident: "Resident",
      residentPlural: "Residents",
      destination: "Who are you visiting?",
      responsible: "Staff responsible",
      associates: "People with them",
    },
    modules: {
      residentLeave: true,
      keysRegister: true,
      foodRegister: true,
      propertyFields: false,
      household: false,
      clinicalSupportFields: true,
      infectionControl: true,
      safeguardingWording: true,
      warden: false,
    },
    emergencyGrouping: ["Unit", "Room", "Person type"],
    credentialLabels: ["DBS check", "Right to work", "Insurance"],
    privacy: UK_PRIVACY,
  },
};

export const SEGMENT_PACK_LIST = Object.values(SEGMENT_PACKS);

/** Safe default for pre-existing prototype data — never a real customer. */
export const DEFAULT_PACK_ID: SegmentPackId = "au_rac";

/**
 * Resolves a pack from what the site record holds. Anything unrecognised falls
 * back to the legacy default so existing sites keep loading.
 */
export function resolvePack(
  jurisdiction?: string | null,
  structure?: string | null
): SegmentPack {
  const j = jurisdiction === "UK" ? "UK" : "AU";
  const s = (structure || "").toLowerCase();
  if (j === "UK") return SEGMENT_PACKS.uk_care;
  if (s === "rv" || s === "retirement_village" || s === "village") return SEGMENT_PACKS.au_rv;
  return SEGMENT_PACKS.au_rac;
}

export function packById(id?: string | null): SegmentPack {
  return SEGMENT_PACKS[(id as SegmentPackId) || DEFAULT_PACK_ID] ?? SEGMENT_PACKS[DEFAULT_PACK_ID];
}
