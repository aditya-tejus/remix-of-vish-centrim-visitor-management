import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type PersonTypeId = "visitor" | "contractor" | "volunteer" | "staff" | "resident";

export interface PersonTypeConfigRow {
  type: PersonTypeId;
  /** Built-in, internal name — used in lists and reports. */
  label: string;
  /** Name shown on the kiosk (falls back to the built-in label). */
  kioskLabel: string;
  kioskEnabled: boolean;
  deskEnabled: boolean;
  description: string;
}

export const PERSON_TYPE_DEFAULTS: { type: PersonTypeId; label: string; description: string }[] = [
  { type: "visitor", label: "Visitor", description: "Family, friend, or guest" },
  { type: "contractor", label: "Contractor", description: "Tradesperson or supplier" },
  { type: "volunteer", label: "Volunteer", description: "Volunteer or helper" },
  { type: "staff", label: "Staff", description: "Staff member sign-in" },
  { type: "resident", label: "Resident", description: "Resident leaving or returning (kiosk tile only)" },
];

const keysFor = (t: PersonTypeId) => [
  `person_type_kiosk_${t}`,
  `person_type_desk_${t}`,
  `person_type_label_${t}`,
];

export const PERSON_TYPE_SETTING_KEYS = PERSON_TYPE_DEFAULTS.flatMap((d) => keysFor(d.type));

function build(map: Record<string, string>): PersonTypeConfigRow[] {
  return PERSON_TYPE_DEFAULTS.map((d) => {
    const custom = (map[`person_type_label_${d.type}`] || "").trim();
    return {
      type: d.type,
      label: d.label,
      kioskLabel: custom || d.label,
      // Missing rows mean "on" so existing sites keep current behaviour.
      kioskEnabled: map[`person_type_kiosk_${d.type}`] !== "false",
      deskEnabled: d.type === "visitor" ? true : map[`person_type_desk_${d.type}`] !== "false",
      description: d.description,
    };
  });
}

/**
 * Which person types a site offers, where they are offered, and what the
 * kiosk calls them. Reporting always uses the built-in `label`.
 */
export function usePersonTypes() {
  const [rows, setRows] = useState<PersonTypeConfigRow[]>(() => build({}));
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("settings")
      .select("key, value")
      .in("key", PERSON_TYPE_SETTING_KEYS);
    const map: Record<string, string> = {};
    (data || []).forEach((r: any) => { map[r.key] = r.value; });
    setRows(build(map));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return {
    personTypes: rows,
    loading,
    reload: load,
    /** Check-in types offered on the kiosk (resident is a tile, not a check-in type). */
    kioskTypes: rows.filter((r) => r.type !== "resident" && r.kioskEnabled),
    /** Check-in types offered at the front desk. */
    deskTypes: rows.filter((r) => r.type !== "resident" && r.deskEnabled),
    residentKioskEnabled: rows.find((r) => r.type === "resident")?.kioskEnabled ?? true,
  };
}
