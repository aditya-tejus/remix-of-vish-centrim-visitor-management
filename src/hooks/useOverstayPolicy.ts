import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Overstay thresholds are operational, not clinical: a family visit running past
 * four hours is unusual, a contractor on site for eight is normal. Each person
 * type therefore carries its own threshold, stored as `overstay_hours_{type}`.
 */
export const PERSON_TYPES = ["visitor", "contractor", "volunteer", "staff"] as const;
export type OverstayPersonType = (typeof PERSON_TYPES)[number];

export const DEFAULT_OVERSTAY_HOURS = 8;

export type OverstayMap = Record<string, number>;

export function overstayKey(personType: string) {
  return `overstay_hours_${personType}`;
}

/** Cached so non-hook callers (visitor list counts, alerts) share one lookup. */
let cachedMap: OverstayMap | null = null;

export function defaultOverstayMap(): OverstayMap {
  const map: OverstayMap = {};
  PERSON_TYPES.forEach((t) => { map[t] = DEFAULT_OVERSTAY_HOURS; });
  return map;
}

export function overstayHoursSync(personType: string) {
  return cachedMap?.[personType] ?? DEFAULT_OVERSTAY_HOURS;
}

/**
 * Same rule everywhere: on site longer than this person type's threshold.
 * Residents live here, so their time in residence is never an overstay.
 */
export function isOverstayedSync(visitor: { type: string; status: string; checkInTime: Date }) {
  return (
    visitor.type !== "resident" &&
    visitor.status === "checked-in" &&
    Date.now() - visitor.checkInTime.getTime() > overstayHoursSync(visitor.type) * 3600000
  );
}

export async function fetchOverstayHours(): Promise<OverstayMap> {
  const { data } = await supabase
    .from("settings")
    .select("key, value")
    .in("key", PERSON_TYPES.map(overstayKey));

  const map: OverstayMap = defaultOverstayMap();
  (data || []).forEach((row) => {
    const type = row.key.replace("overstay_hours_", "");
    const hours = Number(row.value);
    if (Number.isFinite(hours) && hours > 0) map[type] = hours;
  });
  cachedMap = map;
  return map;
}

interface OverstayCandidate {
  type: string;
  status: string;
  checkInTime: Date;
}

export function useOverstayPolicy() {
  const [hoursByType, setHoursByType] = useState<OverstayMap>(() => cachedMap ?? defaultOverstayMap());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchOverstayHours().then((map) => {
      if (!active) return;
      setHoursByType(map);
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const hoursFor = useCallback(
    (personType: string) => hoursByType[personType] ?? DEFAULT_OVERSTAY_HOURS,
    [hoursByType]
  );

  const isOverstayed = useCallback(
    (visitor: OverstayCandidate) =>
      visitor.status === "checked-in" &&
      Date.now() - visitor.checkInTime.getTime() > hoursFor(visitor.type) * 3600000,
    [hoursFor]
  );

  return { hoursByType, hoursFor, isOverstayed, loading };
}
