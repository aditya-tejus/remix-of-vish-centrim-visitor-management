/**
 * Residents page — pure presentation rules. Movement meaning stays in
 * residentMovement.ts; this file only decides how residents are shown.
 */
import type { Resident } from "@/hooks/useResidents";
import { residentLocation, sameLocalDay, type ResidentLocation } from "@/lib/residentMovement";

export type ResidentView = "away" | "expected" | "no-absence" | "directory";

/** "needs_two_carers" or "walking frame" → "Needs two carers" / "Walking frame". */
export function humanise(value: string | null | undefined): string {
  const s = (value ?? "").replace(/[_-]+/g, " ").trim().toLowerCase();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}

/** Room labels arrive as "Room W05"; sites may call rooms villas or apartments. */
export function placeLabel(room: string, place: string): string {
  if (!room) return `${place} not recorded`;
  return room.replace(/^Room\s+/i, `${place} `);
}

export function wingCounts(residents: Pick<Resident, "wing">[]): { wing: string; count: number }[] {
  const m = new Map<string, number>();
  for (const r of residents) if (r.wing) m.set(r.wing, (m.get(r.wing) ?? 0) + 1);
  return [...m.entries()].map(([wing, count]) => ({ wing, count })).sort((a, b) => a.wing.localeCompare(b.wing));
}

export function matchesResident(r: Pick<Resident, "name" | "room" | "wing" | "keyWorker">, q: string): boolean {
  const query = q.trim().toLowerCase();
  if (!query) return true;
  return `${r.name} ${r.room} ${r.wing} ${r.keyWorker ?? ""}`.toLowerCase().includes(query);
}

export function inView(r: Resident, view: ResidentView, now: Date, timeZone: string): boolean {
  const loc = residentLocation(r, now);
  if (view === "directory") return true;
  if (view === "no-absence") return loc === "no-absence";
  if (view === "away") return loc !== "no-absence";
  return loc !== "no-absence" && !!r.expectedReturnDate && (loc === "overdue" || sameLocalDay(r.expectedReturnDate, now, timeZone));
}

/** Overdue first, then soonest expected back, then by name. */
export function sortResidents(list: Resident[], now: Date): Resident[] {
  return [...list].sort((a, b) => {
    const od = Number(residentLocation(b, now) === "overdue") - Number(residentLocation(a, now) === "overdue");
    return od || (a.expectedReturnDate?.getTime() ?? Infinity) - (b.expectedReturnDate?.getTime() ?? Infinity) || a.name.localeCompare(b.name);
  });
}

export const locationLabel: Record<ResidentLocation, string> = {
  "no-absence": "No absence recorded",
  away: "Out",
  "on-leave": "On leave",
  overdue: "Past expected return",
};

/** Time in the site's zone: "7:00 PM" today, otherwise "Sun 1 Nov, 7:00 PM". */
export function movementLabel(date: Date, timeZone: string, now = new Date()): string {
  const time = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit", hour12: true }).format(date);
  if (sameLocalDay(date, now, timeZone)) return time;
  const day = new Intl.DateTimeFormat("en-AU", { timeZone, weekday: "short", day: "numeric", month: "short" }).format(date).replace(",", "");
  return `${day}, ${time}`;
}
