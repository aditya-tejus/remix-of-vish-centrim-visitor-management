/**
 * Visit calendar — pure rules for grouping visits by day and describing a month.
 * Residents are not visits (they live here), so they are left out of counts.
 */
import { format, getDaysInMonth, isAfter, isSameMonth, startOfMonth } from "date-fns";
import type { Visitor } from "@/types/visitor";
import { personKey } from "@/lib/visitorDirectory";

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

/** Visits of the shown month only (the grid also holds leading/trailing days). */
function monthVisits(index: Map<string, Visitor[]>, month: Date): Visitor[] {
  const out: Visitor[] = [];
  for (const list of index.values()) if (isSameMonth(list[0].checkInTime, month)) out.push(...list);
  return out;
}

export interface MonthInsights {
  /** Arrivals per clock hour, 0-23. */
  byHour: number[];
  peakHour: number | null;
  /** Average per day, over the days of the month that have happened so far. */
  dailyAverage: number;
  uniquePeople: number;
  /** Residents ranked by social visits (visitor type only), most first. */
  topResidents: { name: string; count: number }[];
  /** Residents with no social visit recorded this month (only when the month has started). */
  residentsWithoutVisits: string[];
}

export function monthInsights(
  index: Map<string, Visitor[]>,
  month: Date,
  residentNames: string[],
  now = new Date(),
): MonthInsights {
  const list = monthVisits(index, month);
  const byHour = new Array(24).fill(0) as number[];
  const people = new Set<string>();
  const perResident = new Map<string, { name: string; count: number }>();
  const norm = (s: string) => s.trim().toLowerCase();
  for (const r of residentNames) perResident.set(norm(r), { name: r, count: 0 });

  for (const v of list) {
    byHour[v.checkInTime.getHours()] += 1;
    people.add(personKey(v));
    if (v.type === "visitor" && v.whomToVisit) {
      const hit = perResident.get(norm(v.whomToVisit));
      if (hit) hit.count += 1;
    }
  }

  const max = Math.max(...byHour);
  const start = startOfMonth(month);
  const elapsed = isAfter(start, now)
    ? 0
    : isSameMonth(month, now) ? now.getDate() : getDaysInMonth(month);
  const ranked = [...perResident.values()];

  return {
    byHour,
    peakHour: max > 0 ? byHour.indexOf(max) : null,
    dailyAverage: elapsed ? Math.round((list.length / elapsed) * 10) / 10 : 0,
    uniquePeople: people.size,
    topResidents: ranked.filter((r) => r.count > 0).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, 5),
    residentsWithoutVisits: elapsed ? ranked.filter((r) => r.count === 0).map((r) => r.name).sort() : [],
  };
}

/** "2 PM" style label for an hour of the day. */
export const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? "AM" : "PM"}`;

export function durationLabel(from: Date, to: Date | null, now = new Date()): string {
  const mins = Math.max(0, Math.round(((to ?? now).getTime() - from.getTime()) / 60000));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}
