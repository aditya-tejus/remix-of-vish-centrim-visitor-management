/**
 * Phase 8B-3b — profile composition.
 *
 * Pure functions that turn data we already hold into the ordered sections of a
 * person's profile. Nothing here reads, writes or repairs anything: callers
 * pass in what they already loaded, and get back plain rows to put on screen.
 *
 * Two rules run through all of it:
 *  - a detail that this site no longer collects is never shown as current;
 *  - every operational flag carries words, not just a colour.
 */

import type { Visitor } from "@/types/visitor";
import type { CheckInFieldSpec } from "@/lib/checkInFields";
import { isFieldEnabled } from "@/lib/checkInFields";
import type { AccountableRow } from "@/lib/accountablePeople";
import type { CredentialState } from "@/lib/contractorCredentials";

/* ------------------------------------------------------------------ */
/* Needs attention                                                     */
/* ------------------------------------------------------------------ */

export type AttentionTone = "critical" | "warning" | "info";

export interface AttentionItem {
  id: string;
  tone: AttentionTone;
  /** Short word or two, always readable without colour. */
  label: string;
  /** Plain sentence a receptionist can act on. */
  detail: string;
}

export interface WatchlistFlagLike {
  alert_type?: string | null;
  reason?: string | null;
  instructions?: string | null;
}

export interface KeyHoldLike {
  id: string;
  keyLabel: string;
  propertyLabel: string | null;
  overdue: boolean;
}

export interface AttentionInput {
  watchlist?: WatchlistFlagLike | null;
  screeningOutcome?: Visitor["screeningOutcome"];
  screeningFlagCount?: number;
  keys?: KeyHoldLike[];
  /** Contractor credentials that are missing, expired or awaiting confirmation. */
  outstandingCredentials?: string[];
}

export function buildAttentionItems(input: AttentionInput): AttentionItem[] {
  const items: AttentionItem[] = [];
  const {
    watchlist,
    screeningOutcome,
    screeningFlagCount = 0,
    keys = [],
    outstandingCredentials = [],
  } = input;

  if (watchlist) {
    const hard = watchlist.alert_type === "hard";
    items.push({
      id: "watchlist",
      tone: hard ? "critical" : "warning",
      label: hard ? "Access restricted" : "Watchlist",
      detail:
        [watchlist.reason, watchlist.instructions].filter(Boolean).join(" — ") ||
        (hard ? "Do not allow access without a manager." : "Check with a manager before allowing access."),
    });
  }

  if (screeningOutcome === "blocked") {
    items.push({
      id: "screening",
      tone: "critical",
      label: "Blocked",
      detail:
        screeningFlagCount > 0
          ? `Check-in questions blocked this arrival (${screeningFlagCount} concern${screeningFlagCount === 1 ? "" : "s"}).`
          : "Check-in questions blocked this arrival.",
    });
  } else if (screeningOutcome === "flagged") {
    items.push({
      id: "screening",
      tone: "warning",
      label: "Warning",
      detail:
        screeningFlagCount > 0
          ? `Check-in questions raised ${screeningFlagCount} concern${screeningFlagCount === 1 ? "" : "s"}.`
          : "Check-in questions raised a concern.",
    });
  }

  const overdue = keys.filter((k) => k.overdue);
  if (keys.length > 0) {
    items.push({
      id: "keys",
      tone: overdue.length > 0 ? "critical" : "warning",
      label: overdue.length > 0 ? "Key overdue" : "Holding keys",
      detail:
        keys
          .map((k) => [k.keyLabel, k.propertyLabel].filter(Boolean).join(" · "))
          .join(", ") + (overdue.length > 0 ? " — past the time it was due back." : " — still signed out."),
    });
  }

  if (outstandingCredentials.length > 0) {
    items.push({
      id: "credentials",
      tone: "warning",
      label: "Documents outstanding",
      detail: `${outstandingCredentials.join(", ")} not current on file.`,
    });
  }

  return items;
}

/* ------------------------------------------------------------------ */
/* Details, split by what this site still collects                     */
/* ------------------------------------------------------------------ */

export interface DetailEntry {
  valueKey: string;
  label: string;
  value: string;
}

export interface DetailSplit {
  /** Fields configured as active for this person type, in configured order. */
  active: DetailEntry[];
  /** Values kept from before a field was switched off. Permission-gated. */
  historic: DetailEntry[];
}

/** Fallback wording when a stored value has no configured field any more. */
const HISTORIC_LABELS: Record<string, string> = {
  mobile: "Mobile",
  email: "Email",
  address: "Address",
  comments: "Notes",
  visitPurpose: "Purpose of visit",
  visitReasonOther: "Reason for visit",
  volunteerRole: "Volunteer role",
  volunteerSupervisor: "Volunteer supervisor",
  influenzaVaccineDate: "Flu vaccination date",
  covidDose1Date: "COVID dose 1",
  covidDose2Date: "COVID dose 2",
  bodyTemperature: "Temperature recorded",
};

/** The stored personal values a profile can show, as plain text. */
export function profileValues(visitor: Visitor): Record<string, string> {
  const out: Record<string, string> = {
    firstName: visitor.firstName || "",
    surname: visitor.surname || "",
    mobile: visitor.mobile || "",
    email: visitor.email || "",
    address: visitor.address || "",
    comments: visitor.comments || "",
    visitReasonOther: visitor.visitReasonOther || "",
    volunteerRole: visitor.volunteerRole || "",
    volunteerSupervisor: visitor.volunteerSupervisor || "",
    influenzaVaccineDate: visitor.influenzaVaccineDate || "",
    covidDose1Date: visitor.covidDose1Date || "",
    covidDose2Date: visitor.covidDose2Date || "",
    bodyTemperature: visitor.bodyTemperature != null ? `${visitor.bodyTemperature}` : "",
  };
  return out;
}

/**
 * Active fields come from configuration, so a field this site switched off is
 * never presented as something we still collect. A value captured before that
 * change is not deleted — it moves to the historic list instead.
 */
export function splitDetails(visitor: Visitor, specs: CheckInFieldSpec[]): DetailSplit {
  const values = profileValues(visitor);

  const active: DetailEntry[] = specs
    .filter((s) => !s.core)
    .map((s) => ({
      valueKey: s.valueKey,
      label: s.label,
      value: values[s.valueKey] ?? "",
    }))
    .filter((e) => e.value.trim() !== "");

  const activeKeys = new Set(active.map((a) => a.valueKey));

  const historic: DetailEntry[] = Object.entries(values)
    .filter(([key, value]) => {
      if (!value || !value.trim()) return false;
      if (key === "firstName" || key === "surname") return false;
      if (activeKeys.has(key)) return false;
      return !isFieldEnabled(specs, key);
    })
    .map(([key, value]) => ({
      valueKey: key,
      label: HISTORIC_LABELS[key] || key,
      value,
    }));

  return { active, historic };
}

/* ------------------------------------------------------------------ */
/* Relationship                                                        */
/* ------------------------------------------------------------------ */

/** "With Adam John" for a companion, nothing for the person who signed in. */
export function describeRelationship(row: Pick<AccountableRow, "role" | "withPrimaryName">): string | null {
  if (row.role !== "companion" || !row.withPrimaryName) return null;
  return `With ${row.withPrimaryName}`;
}

/* ------------------------------------------------------------------ */
/* Contractor credentials (read only)                                  */
/* ------------------------------------------------------------------ */

export interface CredentialLike {
  key: string;
  label: string;
  state: CredentialState;
  expiryDate?: string | null;
}

export interface CredentialLine {
  key: string;
  label: string;
  state: CredentialState;
  /** Wording that says the state without relying on colour. */
  statusText: string;
  outstanding: boolean;
}

const STATE_TEXT: Record<CredentialState, string> = {
  valid: "Current",
  expiring: "Expiring soon",
  expired: "Expired",
  missing: "Not on file",
  pending: "Awaiting confirmation",
};

export function summariseCredentials(checklist: CredentialLike[]): {
  lines: CredentialLine[];
  outstanding: string[];
} {
  const lines = checklist.map((c) => ({
    key: c.key,
    label: c.label,
    state: c.state,
    statusText: STATE_TEXT[c.state] || String(c.state),
    outstanding: c.state !== "valid" && c.state !== "expiring",
  }));
  return { lines, outstanding: lines.filter((l) => l.outstanding).map((l) => l.label) };
}

/* ------------------------------------------------------------------ */
/* Keys and food context                                               */
/* ------------------------------------------------------------------ */

/** Keys still out, limited to arrivals belonging to this person at this site. */
export function keysForPerson<T extends { visitorId: string | null }>(
  issues: T[],
  visitIdsAtSite: Set<string>
): T[] {
  return issues.filter((i) => !!i.visitorId && visitIdsAtSite.has(i.visitorId));
}

export interface FoodLike {
  id: string;
  residentVisitorId?: string | null;
  visitorId?: string | null;
  broughtByName?: string | null;
  residentName?: string | null;
}

/**
 * Food entries that involve this person, either because they brought food in
 * or because it was recorded for them as a resident. The caller must pass
 * records that are already scoped to the current site.
 */
export function foodForPerson<T extends FoodLike>(
  records: T[],
  person: { visitorId: string; fullName: string; visitIds?: Set<string> }
): T[] {
  const name = person.fullName.trim().toLowerCase();
  return records.filter((r) => {
    if (r.residentVisitorId && r.residentVisitorId === person.visitorId) return true;
    if (r.visitorId && (r.visitorId === person.visitorId || person.visitIds?.has(r.visitorId))) return true;
    return !!name && (r.broughtByName || "").trim().toLowerCase() === name;
  });
}

/* ------------------------------------------------------------------ */
/* History paging                                                      */
/* ------------------------------------------------------------------ */

export const HISTORY_PAGE_SIZE = 20;

export function historyPage<T>(entries: T[], shown: number): { rows: T[]; remaining: number } {
  const rows = entries.slice(0, shown);
  return { rows, remaining: Math.max(entries.length - rows.length, 0) };
}
