import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOperatingContext, siteScopedKey } from "@/contexts/OperatingContext";

export type PersonTypeId = "visitor" | "contractor" | "volunteer" | "staff" | "resident";

export interface PersonTypeConfigRow {
  type: PersonTypeId;
  /** Built-in, internal name — used in lists and reports. */
  label: string;
  /** Name shown on the kiosk (falls back to the built-in label). */
  kioskLabel: string;
  kioskEnabled: boolean;
  deskEnabled: boolean;
  /** Shown to staff in lists and filters. */
  staffVisible: boolean;
  /** Must say who or where they are going. */
  destinationRequired: boolean;
  /** Check-in questions apply. */
  screeningApplies: boolean;
  /** Privacy acknowledgement asked at sign-in. */
  privacyApplies: boolean;
  /** Badge and QR issued. */
  badgeApplies: boolean;
  /** Included in the emergency roll call. */
  rollCallIncluded: boolean;
  description: string;
}

export const PERSON_TYPE_DEFAULTS: {
  type: PersonTypeId;
  label: string;
  description: string;
  destinationRequired: boolean;
  screeningApplies: boolean;
  privacyApplies: boolean;
  badgeApplies: boolean;
  rollCallIncluded: boolean;
}[] = [
  { type: "visitor", label: "Visitor", description: "Family, friend, or guest", destinationRequired: true, screeningApplies: true, privacyApplies: true, badgeApplies: true, rollCallIncluded: true },
  { type: "contractor", label: "Contractor", description: "Tradesperson or supplier", destinationRequired: false, screeningApplies: true, privacyApplies: true, badgeApplies: true, rollCallIncluded: true },
  { type: "volunteer", label: "Volunteer", description: "Volunteer or helper", destinationRequired: true, screeningApplies: true, privacyApplies: true, badgeApplies: true, rollCallIncluded: true },
  { type: "staff", label: "Staff", description: "Staff member sign-in", destinationRequired: false, screeningApplies: false, privacyApplies: false, badgeApplies: false, rollCallIncluded: true },
  { type: "resident", label: "Resident", description: "Resident leaving or returning (kiosk tile only)", destinationRequired: false, screeningApplies: true, privacyApplies: false, badgeApplies: false, rollCallIncluded: true },
];

const FLAG_KEYS = [
  "kiosk", "desk", "label", "staffvisible", "destination",
  "screening", "privacy", "badge", "rollcall",
] as const;

const keysFor = (t: PersonTypeId) => FLAG_KEYS.map((f) => `person_type_${f}_${t}`);

export const PERSON_TYPE_SETTING_KEYS = PERSON_TYPE_DEFAULTS.flatMap((d) => keysFor(d.type));

/** Reads a site value first, then the account-wide value, then the built-in default. */
function pick(map: Record<string, string>, key: string, siteId: string | null) {
  const scoped = siteId ? map[siteScopedKey(key, siteId)] : undefined;
  return scoped !== undefined && scoped !== "" ? scoped : map[key];
}

function build(map: Record<string, string>, siteId: string | null): PersonTypeConfigRow[] {
  return PERSON_TYPE_DEFAULTS.map((d) => {
    const get = (f: string) => pick(map, `person_type_${f}_${d.type}`, siteId);
    const bool = (f: string, fallback: boolean) => {
      const v = get(f);
      if (v === undefined || v === "") return fallback;
      return v !== "false";
    };
    const custom = (get("label") || "").trim();
    return {
      type: d.type,
      label: d.label,
      kioskLabel: custom || d.label,
      // Missing rows mean "on" so existing sites keep current behaviour.
      kioskEnabled: bool("kiosk", true),
      deskEnabled: d.type === "visitor" ? true : bool("desk", true),
      staffVisible: bool("staffvisible", true),
      destinationRequired: bool("destination", d.destinationRequired),
      screeningApplies: bool("screening", d.screeningApplies),
      privacyApplies: bool("privacy", d.privacyApplies),
      badgeApplies: bool("badge", d.badgeApplies),
      rollCallIncluded: bool("rollcall", d.rollCallIncluded),
      description: d.description,
    };
  });
}

/**
 * Which person types a site offers, where they are offered, what the kiosk calls
 * them and which parts of the workflow apply to each. Reporting always uses the
 * built-in `label`. Site values win over account-wide values.
 */
export function usePersonTypes() {
  const { siteId } = useOperatingContext();
  const [rows, setRows] = useState<PersonTypeConfigRow[]>(() => build({}, null));
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const scoped = siteId ? PERSON_TYPE_SETTING_KEYS.map((k) => siteScopedKey(k, siteId)) : [];
    const { data } = await supabase
      .from("settings")
      .select("key, value")
      .in("key", [...PERSON_TYPE_SETTING_KEYS, ...scoped]);
    const map: Record<string, string> = {};
    (data || []).forEach((r: any) => { map[r.key] = r.value; });
    setRows(build(map, siteId));
    setLoading(false);
  }, [siteId]);

  useEffect(() => { load(); }, [load]);

  return {
    personTypes: rows,
    loading,
    reload: load,
    siteId,
    /** Check-in types offered on the kiosk (resident is a tile, not a check-in type). */
    kioskTypes: rows.filter((r) => r.type !== "resident" && r.kioskEnabled),
    /** Check-in types offered at the front desk. */
    deskTypes: rows.filter((r) => r.type !== "resident" && r.deskEnabled),
    residentKioskEnabled: rows.find((r) => r.type === "resident")?.kioskEnabled ?? true,
  };
}
