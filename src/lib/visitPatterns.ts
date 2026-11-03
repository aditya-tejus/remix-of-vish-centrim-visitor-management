/**
 * Visit patterns report — pure rules. Visits only: residents live here and
 * are never counted as visits. Every figure is for the chosen period.
 */
import { differenceInMinutes, eachDayOfInterval, format, getDay, isAfter, startOfDay } from "date-fns";
import type { Visitor } from "@/types/visitor";
import { personKey } from "@/lib/visitorDirectory";

export const PATTERN_TYPES = ["visitor", "contractor", "volunteer", "staff", "other"] as const;
export type PatternType = (typeof PATTERN_TYPES)[number];
export const PATTERN_TYPE_LABEL: Record<PatternType, string> = {
  visitor: "Visitors", contractor: "Contractors", volunteer: "Volunteers", staff: "Staff", other: "Other",
};
const typeOf = (t: string): PatternType => ((PATTERN_TYPES as readonly string[]).includes(t) ? t : "other") as PatternType;

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export interface VisitPatterns {
  total: number;
  people: number;
  averageMinutes: number | null;
  busiestDay: { date: Date; count: number } | null;
  byDay: ({ key: string; label: string; date: Date; total: number } & Record<PatternType, number>)[];
  byHour: { hour: number; label: string; count: number }[];
  peakHour: number | null;
  byWeekday: { day: string; average: number }[];
  lengthByType: { type: PatternType; label: string; minutes: number; visits: number }[];
  topResidents: { name: string; count: number }[];
  residentsWithoutVisitors: string[];
  typesPresent: PatternType[];
}

export function visitPatterns(all: Visitor[], from: Date, to: Date, residentNames: string[] = []): VisitPatterns {
  const start = startOfDay(from);
  const visits = all.filter((v) => v.type !== "resident" && v.checkInTime >= start && !isAfter(v.checkInTime, to));
  const days = eachDayOfInterval({ start, end: to });

  const byDayMap = new Map(days.map((d) => {
    const row = { key: format(d, "yyyy-MM-dd"), label: format(d, days.length > 14 ? "d MMM" : "EEE d"), date: d, total: 0,
      visitor: 0, contractor: 0, volunteer: 0, staff: 0, other: 0 };
    return [row.key, row];
  }));
  const hours = new Array(24).fill(0) as number[];
  const lengths = new Map<PatternType, { sum: number; n: number }>();
  const people = new Set<string>();
  const perResident = new Map(residentNames.map((n) => [n.trim().toLowerCase(), { name: n, count: 0 }]));
  const typesPresent = new Set<PatternType>();

  for (const v of visits) {
    const t = typeOf(v.type);
    typesPresent.add(t);
    const row = byDayMap.get(format(v.checkInTime, "yyyy-MM-dd"));
    if (row) { row[t] += 1; row.total += 1; }
    hours[v.checkInTime.getHours()] += 1;
    people.add(personKey(v));
    if (v.checkOutTime) {
      const l = lengths.get(t) ?? { sum: 0, n: 0 };
      l.sum += Math.max(0, differenceInMinutes(v.checkOutTime, v.checkInTime)); l.n += 1;
      lengths.set(t, l);
    }
    if (t === "visitor" && v.whomToVisit) {
      const hit = perResident.get(v.whomToVisit.trim().toLowerCase());
      if (hit) hit.count += 1;
    }
  }

  const byDay = [...byDayMap.values()];
  const busiest = byDay.reduce<VisitPatterns["busiestDay"]>((b, d) => (d.total > (b?.count ?? 0) ? { date: d.date, count: d.total } : b), null);
  const max = Math.max(...hours);
  const weekdayTotals = new Array(7).fill(0) as number[];
  const weekdayDays = new Array(7).fill(0) as number[];
  for (const d of byDay) { const i = (getDay(d.date) + 6) % 7; weekdayTotals[i] += d.total; weekdayDays[i] += 1; }
  const all_ = [...lengths.values()].reduce((a, l) => ({ sum: a.sum + l.sum, n: a.n + l.n }), { sum: 0, n: 0 });
  const ranked = [...perResident.values()];

  return {
    total: visits.length,
    people: people.size,
    averageMinutes: all_.n ? Math.round(all_.sum / all_.n) : null,
    busiestDay: busiest,
    byDay,
    byHour: hours.map((count, hour) => ({ hour, label: hourLabel(hour), count })),
    peakHour: max > 0 ? hours.indexOf(max) : null,
    byWeekday: WEEKDAYS.map((day, i) => ({ day, average: weekdayDays[i] ? Math.round((weekdayTotals[i] / weekdayDays[i]) * 10) / 10 : 0 })),
    lengthByType: PATTERN_TYPES.filter((t) => lengths.has(t)).map((t) => {
      const l = lengths.get(t)!;
      return { type: t, label: PATTERN_TYPE_LABEL[t], minutes: Math.round(l.sum / l.n), visits: l.n };
    }),
    topResidents: ranked.filter((r) => r.count > 0).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, 8),
    residentsWithoutVisitors: ranked.filter((r) => r.count === 0).map((r) => r.name).sort(),
    typesPresent: PATTERN_TYPES.filter((t) => typesPresent.has(t)),
  };
}

export const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? "AM" : "PM"}`;

/** "45 min", "2 h", "1 h 20 min". */
export function minutesLabel(mins: number | null): string {
  if (mins === null) return "—";
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}
