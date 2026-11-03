/**
 * Food register page — pure presentation rules: date presets, grouping by
 * day, and the headline totals. Storage and filtering on the server stay in
 * useFoodRegister.
 */
import { format, isSameDay, subDays } from "date-fns";
import type { FoodRecord } from "@/lib/foodRegister";

export type FoodPeriod = "today" | "7d" | "30d" | "all" | "custom";

export const FOOD_PERIODS: { id: FoodPeriod; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "all", label: "All" },
  { id: "custom", label: "Choose dates" },
];

const ymd = (d: Date) => format(d, "yyyy-MM-dd");

/** The from/to (yyyy-MM-dd) a preset stands for. Custom keeps whatever was typed. */
export function periodRange(period: FoodPeriod, now = new Date(), custom: { from: string; to: string } = { from: "", to: "" }) {
  if (period === "today") return { from: ymd(now), to: ymd(now) };
  if (period === "7d") return { from: ymd(subDays(now, 6)), to: ymd(now) };
  if (period === "30d") return { from: ymd(subDays(now, 29)), to: ymd(now) };
  if (period === "custom") return custom;
  return { from: "", to: "" };
}

/** Newest first, one group per day, labelled the way reception talks. */
export function groupByDay(records: FoodRecord[], now = new Date()): { key: string; label: string; items: FoodRecord[] }[] {
  const groups = new Map<string, { key: string; label: string; items: FoodRecord[] }>();
  const sorted = [...records].sort((a, b) => b.recordedAt.getTime() - a.recordedAt.getTime());
  for (const r of sorted) {
    const key = ymd(r.recordedAt);
    let g = groups.get(key);
    if (!g) {
      const label = isSameDay(r.recordedAt, now) ? "Today"
        : isSameDay(subDays(now, 1), r.recordedAt) ? "Yesterday"
        : format(r.recordedAt, "EEEE d MMMM");
      g = { key, label, items: [] };
      groups.set(key, g);
    }
    g.items.push(r);
  }
  return [...groups.values()];
}

/** Totals for exactly the records on screen, so the numbers always match the list. */
export function foodTotals(records: FoodRecord[]) {
  return {
    total: records.length,
    homemade: records.filter((r) => r.foodType === "homemade").length,
    shared: records.filter((r) => r.sharedWithOthers).length,
    residents: new Set(records.map((r) => r.residentVisitorId ?? r.residentName)).size,
  };
}

/** Commas and brackets have meaning in the server's filter syntax; keep searches to plain words. */
export const safeSearch = (q: string) => q.replace(/[,()%*\\]/g, " ").replace(/\s+/g, " ").trim();
