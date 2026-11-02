/**
 * Visit calendar — pure rules for grouping visits by day and describing a month.
 * Residents are not visits (they live here), so they are left out of counts.
 */
import { format, isSameMonth } from "date-fns";
import type { Visitor } from "@/types/visitor";

export type CalendarTypeFilter = "all" | "visitor" | "contractor" | "volunteer" | "staff" | "other";

export const dayKey = (d: Date) => format(d, "yyyy-MM-dd");

export function indexByDay(visits: Visitor[], filter: CalendarTypeFilter = "all"): Map<string, Visitor[]> {
  const map = new Map<string, Visitor[]>();
  for (const v of visits) {
    if (v.type === "resident") continue;
    if (filter !== "all" && v.type !== filter) continue;
    const k = dayKey(v.checkInTime);
    const list = map.get(k);
    if (list) list.push(v); else map.set(k, [v]);
  }
  for (const list of map.values()) list.sort((a, b) => a.checkInTime.getTime() - b.checkInTime.getTime());
  return map;
}

export interface MonthSummary {
  total: number;
  daysWithVisits: number;
  busiest: { date: Date; count: number } | null;
  max: number;
}

export function summariseMonth(index: Map<string, Visitor[]>, month: Date): MonthSummary {
  let total = 0, daysWithVisits = 0, max = 0;
  let busiest: MonthSummary["busiest"] = null;
  for (const list of index.values()) {
    const d = list[0].checkInTime;
    if (!isSameMonth(d, month)) continue;
    total += list.length;
    daysWithVisits += 1;
    if (list.length > max) { max = list.length; busiest = { date: d, count: list.length }; }
  }
  return { total, daysWithVisits, busiest, max };
}

/** 0 = no visits, 1-4 = quiet to busiest, relative to the busiest day of the month. */
export function busyLevel(count: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0 || max <= 0) return 0;
  const r = count / max;
  return r > 0.75 ? 4 : r > 0.5 ? 3 : r > 0.25 ? 2 : 1;
}

export function durationLabel(from: Date, to: Date | null, now = new Date()): string {
  const mins = Math.max(0, Math.round(((to ?? now).getTime() - from.getTime()) / 60000));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}
