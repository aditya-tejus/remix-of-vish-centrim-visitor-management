/**
 * Visitor profiles directory — pure rules.
 *
 * Turns a site's visit history into one entry per person, so reception can find
 * anyone who has visited (not just today's arrivals). People are only treated as
 * the same person when they share a personal code or a real contact detail —
 * never on a blank field and never on name alone, so two different people called
 * Jane Smith with no contact details stay separate.
 *
 * No data access here; the hook loads history and this module shapes it.
 */
import type { Visitor } from "@/types/visitor";

export type DirectoryTab = "all" | "on_site" | "recent" | "attention";
export type DirectorySort = "last_visit" | "name";

export interface DirectoryFlags {
  watchlist: boolean;
  overdue: boolean;
  screening: "flagged" | "blocked" | null;
  keysHeld: number;
}

export interface DirectoryEntry {
  key: string;
  /** Most recent visit — the source of name, type and contact details. */
  latest: Visitor;
  /** Every visit by this person at this site, newest first. */
  visits: Visitor[];
  visitCount: number;
  lastVisit: Date;
  onSite: boolean;
  /** Arrival time of the open visit, when on site. */
  onSiteSince: Date | null;
  /** The destination they choose most often (ties go to the most recent). */
  usuallyVisits: string | null;
}

export const RECENT_DAYS = 30;

export function personKey(v: Pick<Visitor, "id" | "personQr" | "email" | "mobile">): string {
  const email = (v.email || "").trim().toLowerCase();
  const mobile = (v.mobile || "").replace(/[^0-9]/g, "");
  return (
    (v.personQr && `qr:${v.personQr}`) ||
    (email && `email:${email}`) ||
    (mobile.length >= 6 && `mobile:${mobile}`) ||
    `record:${v.id}`
  );
}

export function buildDirectory(history: Visitor[]): DirectoryEntry[] {
  const groups = new Map<string, Visitor[]>();
  for (const v of history) {
    if (v.type === "resident") continue; // residents have their own section
    const k = personKey(v);
    const list = groups.get(k);
    if (list) list.push(v); else groups.set(k, [v]);
  }
  const entries: DirectoryEntry[] = [];
  for (const [key, list] of groups) {
    const visits = [...list].sort((a, b) => b.checkInTime.getTime() - a.checkInTime.getTime());
    const latest = visits[0];
    const open = visits.find((v) => v.status === "checked-in");
    const counts = new Map<string, { n: number; at: number }>();
    for (const v of visits) {
      const d = (v.whomToVisit || "").trim();
      if (!d) continue;
      const c = counts.get(d);
      if (c) c.n += 1; else counts.set(d, { n: 1, at: v.checkInTime.getTime() });
    }
    let usuallyVisits: string | null = null;
    let best = { n: 0, at: 0 };
    for (const [d, c] of counts) {
      if (c.n > best.n || (c.n === best.n && c.at > best.at)) { usuallyVisits = d; best = c; }
    }
    entries.push({
      key, latest, visits, visitCount: visits.length, lastVisit: latest.checkInTime,
      onSite: !!open, onSiteSince: open ? open.checkInTime : null, usuallyVisits,
    });
  }
  return entries;
}

export function needsAttention(f: DirectoryFlags): boolean {
  return f.watchlist || f.overdue || f.screening !== null || f.keysHeld > 0;
}

export function inTab(e: DirectoryEntry, tab: DirectoryTab, flags: DirectoryFlags, now = new Date()): boolean {
  switch (tab) {
    case "on_site": return e.onSite;
    case "recent": return now.getTime() - e.lastVisit.getTime() <= RECENT_DAYS * 86400000;
    case "attention": return needsAttention(flags);
    default: return true;
  }
}

export function matchesSearch(e: DirectoryEntry, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const v = e.latest;
  const digits = q.replace(/[^0-9]/g, "");
  return (
    `${v.firstName} ${v.surname}`.toLowerCase().includes(q) ||
    (v.email || "").toLowerCase().includes(q) ||
    (digits.length >= 3 && (v.mobile || "").replace(/[^0-9]/g, "").includes(digits)) ||
    (e.usuallyVisits || "").toLowerCase().includes(q)
  );
}

export function sortEntries(list: DirectoryEntry[], sort: DirectorySort): DirectoryEntry[] {
  const out = [...list];
  if (sort === "name") {
    out.sort((a, b) =>
      `${a.latest.surname} ${a.latest.firstName}`.localeCompare(`${b.latest.surname} ${b.latest.firstName}`, undefined, { sensitivity: "base" })
    );
  } else {
    // On site first, then most recent visit.
    out.sort((a, b) => Number(b.onSite) - Number(a.onSite) || b.lastVisit.getTime() - a.lastVisit.getTime());
  }
  return out;
}

/** Plain wording for when someone was last here, in the viewer's day terms. */
export function lastVisitLabel(d: Date, now = new Date()): string {
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((start(now) - start(d)) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "Last week";
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}
