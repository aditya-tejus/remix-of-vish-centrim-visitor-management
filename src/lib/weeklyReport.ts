import type { Visitor } from "@/types/visitor";
import { companionRowsForVisitor, primaryRowForVisitor } from "@/lib/accountablePeople";

/**
 * Weekly visitor activity — one pure composition used by the screen, the CSV and
 * the printable page, so the three can never disagree.
 *
 * Attendance records (canonical) are the truth. A saved visitor record is only
 * used where the visit has no attendance records, and every such row is marked
 * as an older record so nobody mistakes it for the same quality of evidence.
 */

/* ------------------------------------------------------------------ time */

function partsInZone(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const map: Record<string, string> = {};
  for (const p of fmt.formatToParts(date)) map[p.type] = p.value;
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour === "24" ? "0" : map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
    weekday: map.weekday,
  };
}

/** Offset of the zone from UTC at that instant, in milliseconds. */
function zoneOffsetMs(date: Date, timeZone: string): number {
  const p = partsInZone(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** The instant at which local midnight of the given local date occurs. */
function zonedMidnight(year: number, month: number, day: number, timeZone: string): Date {
  const guess = Date.UTC(year, month - 1, day);
  let ts = guess - zoneOffsetMs(new Date(guess), timeZone);
  ts = guess - zoneOffsetMs(new Date(ts), timeZone);
  return new Date(ts);
}

const WEEKDAY_INDEX: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

export interface DateWindow {
  start: Date;
  /** Exclusive. */
  end: Date;
}

export function startOfDayInZone(date: Date, timeZone: string): Date {
  const p = partsInZone(date, timeZone);
  return zonedMidnight(p.year, p.month, p.day, timeZone);
}

/** Monday 00:00 to the following Monday 00:00, in the site's own time. */
export function weekWindow(reference: Date, timeZone: string, weekOffset = 0): DateWindow {
  const p = partsInZone(reference, timeZone);
  const back = WEEKDAY_INDEX[p.weekday] ?? 0;
  const dayStart = zonedMidnight(p.year, p.month, p.day, timeZone);
  const monday = new Date(dayStart.getTime() - back * 86400000 + weekOffset * 7 * 86400000);
  const m = partsInZone(monday, timeZone);
  const start = zonedMidnight(m.year, m.month, m.day, timeZone);
  const roughEnd = new Date(start.getTime() + 7 * 86400000 + 3 * 3600000);
  const e = partsInZone(roughEnd, timeZone);
  const end = zonedMidnight(e.year, e.month, e.day, timeZone);
  return { start, end };
}

export const MAX_RANGE_DAYS = 31;

/** A custom range is never allowed to exceed 31 days. */
export function clampRange(from: Date, to: Date): { window: DateWindow; capped: boolean } {
  const start = from <= to ? from : to;
  let end = from <= to ? to : from;
  let capped = false;
  const maxEnd = new Date(start.getTime() + MAX_RANGE_DAYS * 86400000);
  if (end.getTime() > maxEnd.getTime()) {
    end = maxEnd;
    capped = true;
  }
  return { window: { start, end }, capped };
}

export function formatDateInZone(date: Date, timeZone: string): string {
  const fmt = new Intl.DateTimeFormat("en-GB", { timeZone, day: "2-digit", month: "short", year: "numeric" });
  // Some runtimes render September as "Sept"; keep three letters everywhere.
  return fmt.format(date).replace(/,/g, "").replace("Sept", "Sep");
}

export function formatTimeInZone(date: Date, timeZone: string): string {
  const fmt = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hour12: true });
  return fmt.format(date).toUpperCase();
}

export function formatDateTimeInZone(date: Date, timeZone: string): string {
  return `${formatTimeInZone(date, timeZone)} ${formatDateInZone(date, timeZone)}`;
}

/* ------------------------------------------------------------------ rows */

export interface CanonicalPartyInput {
  id: string;
  visitId: string;
  branchId: string | null;
  personType: string;
  destinationLabel: string | null;
  displayName: string;
  nameStatus: string;
  isPrimary: boolean;
  companionIndex: number;
  relationship: string | null;
  checkInTime: Date;
  checkOutTime: Date | null;
  legacyVisitorId: string | null;
  screeningOutcome?: string | null;
}

export interface LegacyVisitInput {
  visitor: Visitor;
  branchId: string | null;
}

export type LeftState = "left" | "on-site" | "missing";

export interface ReportRow {
  key: string;
  name: string;
  nameKnown: boolean;
  personType: string;
  role: "primary" | "companion";
  withPrimaryName: string | null;
  arrived: Date;
  destination: string;
  left: Date | null;
  leftState: LeftState;
  record: "canonical" | "legacy";
  /** Only ever set when the reader is allowed to see screening. Never an answer. */
  screeningStatus: string | null;
  visitorId: string | null;
}

export interface BuildOptions {
  siteId: string | null;
  /** Legacy site: records saved before sites existed belong here. */
  includeUnassigned?: boolean;
  now: Date;
  timeZone: string;
  includeScreening: boolean;
}

function leftStateFor(checkOut: Date | null, arrived: Date, now: Date, timeZone: string): LeftState {
  if (checkOut) return "left";
  return arrived < startOfDayInZone(now, timeZone) ? "missing" : "on-site";
}

const SCREENING_LABELS: Record<string, string> = {
  clear: "Clear",
  flagged: "Needs attention",
  blocked: "Blocked",
};

export function screeningLabel(outcome?: string | null): string | null {
  if (!outcome) return null;
  return SCREENING_LABELS[outcome] ?? null;
}

/** Every accountable person's activity in the window, one row per person per visit. */
export function buildReportRows(
  canonical: CanonicalPartyInput[],
  legacy: LegacyVisitInput[],
  options: BuildOptions
): ReportRow[] {
  const { siteId, includeUnassigned = false, now, timeZone, includeScreening } = options;

  const inSite = (branchId: string | null) => {
    if (!siteId) return true;
    if (branchId === null) return includeUnassigned;
    return branchId === siteId;
  };

  const parties = canonical.filter((p) => inSite(p.branchId));
  const primaryNameByVisit = new Map<string, string>();
  for (const p of parties) {
    if (p.isPrimary) primaryNameByVisit.set(p.visitId, p.displayName?.trim() || "Name not recorded");
  }

  const canonicalRows: ReportRow[] = parties.map((p) => {
    const named = p.nameStatus === "named" && !!p.displayName?.trim();
    return {
      key: p.id,
      name: named ? p.displayName.trim() : `Companion ${p.companionIndex} (name not recorded)`,
      nameKnown: named,
      personType: p.personType,
      role: p.isPrimary ? "primary" : "companion",
      withPrimaryName: p.isPrimary ? null : primaryNameByVisit.get(p.visitId) ?? null,
      arrived: p.checkInTime,
      destination: p.destinationLabel?.trim() || "",
      left: p.checkOutTime,
      leftState: leftStateFor(p.checkOutTime, p.checkInTime, now, timeZone),
      record: "canonical",
      screeningStatus: includeScreening ? screeningLabel(p.screeningOutcome) : null,
      visitorId: p.legacyVisitorId,
    };
  });

  const covered = new Set(parties.map((p) => p.legacyVisitorId).filter(Boolean) as string[]);

  const legacyRows: ReportRow[] = legacy
    .filter((l) => inSite(l.branchId) && !covered.has(l.visitor.id))
    .flatMap(({ visitor }) => {
      const rows = [primaryRowForVisitor(visitor, []), ...companionRowsForVisitor(visitor, [])];
      return rows.map((r) => ({
        key: r.key,
        name: r.name,
        nameKnown: r.nameKnown,
        personType: r.personType,
        role: r.role,
        withPrimaryName: r.withPrimaryName,
        arrived: r.checkInTime,
        destination: visitor.whomToVisit || "",
        left: r.checkOutTime,
        leftState: leftStateFor(r.checkOutTime, r.checkInTime, now, timeZone),
        record: "legacy" as const,
        screeningStatus: includeScreening ? screeningLabel(visitor.screeningOutcome) : null,
        visitorId: visitor.id,
      }));
    });

  return [...canonicalRows, ...legacyRows].sort((a, b) => b.arrived.getTime() - a.arrived.getTime());
}

/* --------------------------------------------------------------- filters */

export interface ReportFilters {
  search?: string;
  personType?: string;
  missingOnly?: boolean;
}

export function filterReportRows(rows: ReportRow[], filters: ReportFilters): ReportRow[] {
  const term = (filters.search || "").trim().toLowerCase();
  return rows.filter((r) => {
    if (filters.personType && filters.personType !== "all" && r.personType !== filters.personType) return false;
    if (filters.missingOnly && r.leftState !== "missing") return false;
    if (term) {
      const hay = `${r.name} ${r.withPrimaryName || ""} ${r.destination}`.toLowerCase();
      if (!hay.includes(term)) return false;
    }
    return true;
  });
}

export interface ReportTotals {
  people: number;
  visits: number;
  onSite: number;
  missing: number;
  legacy: number;
}

export function reportTotals(rows: ReportRow[]): ReportTotals {
  return {
    people: rows.length,
    visits: new Set(rows.map((r) => (r.role === "primary" ? r.key : r.withPrimaryName + String(r.arrived.getTime())))).size,
    onSite: rows.filter((r) => r.leftState === "on-site").length,
    missing: rows.filter((r) => r.leftState === "missing").length,
    legacy: rows.filter((r) => r.record === "legacy").length,
  };
}

export const LEFT_STATE_LABELS: Record<LeftState, string> = {
  left: "Signed out",
  "on-site": "Still on site",
  missing: "No sign-out recorded",
};

/** The table exactly as it is exported — headers first, then one row per person. */
export function reportToRows(rows: ReportRow[], timeZone: string, includeScreening: boolean): string[][] {
  const headers = [
    "Name",
    "Person type",
    "Role",
    "Arrived",
    "Destination",
    "Left",
    "Sign-out status",
    "Record",
  ];
  if (includeScreening) headers.push("Check-in questions");

  const body = rows.map((r) => {
    const line = [
      r.name,
      r.personType,
      r.role === "primary" ? "Main visitor" : `With ${r.withPrimaryName || "main visitor"}`,
      formatDateTimeInZone(r.arrived, timeZone),
      r.destination,
      r.left ? formatDateTimeInZone(r.left, timeZone) : "",
      LEFT_STATE_LABELS[r.leftState],
      r.record === "legacy" ? "Older record" : "Attendance record",
    ];
    if (includeScreening) line.push(r.screeningStatus || "Not recorded");
    return line;
  });

  return [headers, ...body];
}
