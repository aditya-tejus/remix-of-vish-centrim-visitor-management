/**
 * On site and today — pure presentation rules for the reception list.
 * The views themselves are derived in useVisitViews from one visitor list.
 */
import { endOfDay, isSameDay, isToday } from "date-fns";
import type { Visitor } from "@/types/visitor";

/**
 * Residents who are away and due back on the chosen day. When the chosen day is
 * today, residents whose return time has already passed (any earlier day) are
 * included too — an overdue return is exactly what the desk needs to see.
 */
export function residentsDue(all: Visitor[], date: Date, now = new Date()): Visitor[] {
  const today = isToday(date) || isSameDay(date, now);
  return all
    .filter((v) => {
      if (v.type !== "resident" || v.status !== "checked-out" || !v.expectedReturnDate) return false;
      if (isSameDay(v.expectedReturnDate, date)) return true;
      return today && v.expectedReturnDate.getTime() < now.getTime();
    })
    .sort((a, b) => {
      const od = Number(isOverdueBack(b, now)) - Number(isOverdueBack(a, now));
      return od || a.expectedReturnDate!.getTime() - b.expectedReturnDate!.getTime();
    });
}

export const isOverdueBack = (v: Visitor, now = new Date()) =>
  v.type === "resident" && v.status === "checked-out" && !!v.expectedReturnDate && v.expectedReturnDate.getTime() < now.getTime();

/** Only counts residents due on or before the end of the chosen day. */
export const dueBackBy = (v: Visitor, date: Date) => !!v.expectedReturnDate && v.expectedReturnDate.getTime() <= endOfDay(date).getTime();

export interface Destination {
  primary: string;
  secondary?: string;
  /** Resident record to link to, when the destination resolved to one. */
  residentId?: string;
  hidden?: boolean;
}

interface ResidentLite { visitorId: string; name: string; room: string; wing: string }

/**
 * Who or where the person went. Room labels arrive already formatted
 * ("Room W05"), so they are never prefixed again.
 */
export function destinationFor(
  visitor: Pick<Visitor, "whomToVisit" | "visitedResidentIds">,
  residents: ResidentLite[],
  opts: { showDestination: boolean; areaLabel: string },
): Destination | null {
  const name = (visitor.whomToVisit || "").trim();
  const byId = visitor.visitedResidentIds?.[0];
  let res = byId ? residents.find((r) => r.visitorId === byId) : undefined;
  if (!res && name) {
    const matches = residents.filter((r) => r.name.toLowerCase() === name.toLowerCase());
    if (matches.length === 1) res = matches[0];
  }
  if (!name && !res) return null;
  if (!opts.showDestination) {
    return { primary: res?.wing ? `${opts.areaLabel} ${res.wing}` : "Recorded", secondary: "Name hidden by site setting", hidden: true };
  }
  if (res) {
    return { primary: res.name, secondary: [res.room, res.wing].filter(Boolean).join(" · ") || undefined, residentId: res.visitorId };
  }
  return { primary: name };
}

/** "45 min", "3 h 20 min" — the desk reads this at a glance. */
export function stayLabel(from: Date, to: Date | null, now = new Date()): string {
  const mins = Math.max(0, Math.floor(((to ?? now).getTime() - from.getTime()) / 60000));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export const expectedOutBy = (v: Pick<Visitor, "checkInTime">, hours: number) => new Date(v.checkInTime.getTime() + hours * 3600000);

/** Every shortcut is ignored while typing or while a dialog or sheet is open. */
export function shortcutAllowed(target: EventTarget | null, doc: Pick<Document, "querySelector"> = document): boolean {
  const el = target as HTMLElement | null;
  const tag = el?.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable) return false;
  if (el?.closest?.('[role="combobox"],[role="listbox"],[role="menu"]')) return false;
  return !doc.querySelector('[role="dialog"][data-state="open"],[role="alertdialog"][data-state="open"]');
}
