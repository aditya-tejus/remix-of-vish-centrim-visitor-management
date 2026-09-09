import type { Visitor } from "@/types/visitor";

/**
 * Accountable people — the one read model for "who was actually here".
 *
 * A visit can hold several people: the person who signed in and anyone who came
 * with them. Each of them is individually accountable, so each gets their own
 * row. Rows are never merged by name, email, phone or personal code: two people
 * with no contact details recorded are still two people.
 *
 * Canonical first: when a visit has attendance records, those records are the
 * truth. Older arrivals that were never given attendance records fall back to
 * the saved visitor record and its saved companion names, and are marked as a
 * legacy record so nobody mistakes them for the same quality of evidence.
 *
 * This module reads only. It never writes, merges, renames or repairs anything.
 */

export interface PartyLike {
  id: string;
  visitId: string;
  legacyVisitorId: string | null;
  personId: string | null;
  displayName: string;
  relationship: string | null;
  isPrimary: boolean;
  companionIndex: number;
  nameStatus: string;
  checkInTime: Date;
  checkOutTime: Date | null;
  branchId?: string | null;
}

export interface AccountableRow {
  /** Stable row key for lists. */
  key: string;
  role: "primary" | "companion";
  source: "canonical" | "legacy";
  partyId: string | null;
  visitId: string | null;
  personId: string | null;
  /** The saved visitor record this row belongs to, where one exists. */
  visitorId: string | null;
  branchId: string | null;
  name: string;
  /** False when the person was counted but never named. */
  nameKnown: boolean;
  relationship: string | null;
  /** Set on companions: the name of the person they arrived with. */
  withPrimaryName: string | null;
  personType: string;
  companionIndex: number;
  checkInTime: Date;
  checkOutTime: Date | null;
  status: "checked-in" | "checked-out";
  /** The visitor record behind this row, for details not yet held canonically. */
  visitor: Visitor | null;
}

export interface BuildOptions {
  /** Only rows belonging to this site are returned. */
  siteId?: string | null;
  /** Legacy site: records with no site recorded also belong here. */
  includeUnassigned?: boolean;
}

function displayNameFor(party: PartyLike): { name: string; known: boolean } {
  if (party.nameStatus === "named" && party.displayName?.trim()) {
    return { name: party.displayName.trim(), known: true };
  }
  return { name: `Companion ${party.companionIndex} (name not recorded)`, known: false };
}

function statusFor(checkOutTime: Date | null): "checked-in" | "checked-out" {
  return checkOutTime ? "checked-out" : "checked-in";
}

/** Canonical attendance rows for one saved visitor record, if any exist. */
export function partiesForVisitor(parties: PartyLike[], visitorId: string): PartyLike[] {
  return parties
    .filter((p) => p.legacyVisitorId === visitorId)
    .sort((a, b) => a.companionIndex - b.companionIndex);
}

/**
 * The companion rows to show under one visitor: canonical attendance when the
 * visit has it, otherwise the names saved with the older arrival.
 */
export function companionRowsForVisitor(visitor: Visitor, parties: PartyLike[]): AccountableRow[] {
  const primaryName = `${visitor.firstName} ${visitor.surname}`.trim();
  const mine = partiesForVisitor(parties, visitor.id);

  if (mine.length > 0) {
    return mine
      .filter((p) => !p.isPrimary)
      .map((p) => {
        const { name, known } = displayNameFor(p);
        return {
          key: p.id,
          role: "companion" as const,
          source: "canonical" as const,
          partyId: p.id,
          visitId: p.visitId,
          personId: p.personId,
          visitorId: visitor.id,
          branchId: p.branchId ?? null,
          name,
          nameKnown: known,
          relationship: p.relationship,
          withPrimaryName: primaryName,
          personType: visitor.type,
          companionIndex: p.companionIndex,
          checkInTime: p.checkInTime,
          checkOutTime: p.checkOutTime,
          status: statusFor(p.checkOutTime),
          visitor,
        };
      });
  }

  // Older arrival with no attendance records: use the saved companion names,
  // and where only a headcount was kept, still show one row per person.
  const details = visitor.companionDetails || [];
  const counted = Math.max(visitor.additionalVisitors || 0, details.length);
  const rows: AccountableRow[] = [];
  for (let i = 0; i < counted; i++) {
    const detail: any = details[i] || {};
    const rawName = (detail.name || detail.companion_name || "").trim();
    rows.push({
      key: `${visitor.id}-legacy-${i + 1}`,
      role: "companion",
      source: "legacy",
      partyId: null,
      visitId: null,
      personId: null,
      visitorId: visitor.id,
      branchId: null,
      name: rawName || `Companion ${i + 1} (name not recorded)`,
      nameKnown: !!rawName,
      relationship: detail.relation || null,
      withPrimaryName: primaryName,
      personType: visitor.type,
      companionIndex: i + 1,
      checkInTime: visitor.checkInTime,
      checkOutTime: detail.checkedOutAt ? new Date(detail.checkedOutAt) : visitor.checkOutTime,
      status: statusFor(detail.checkedOutAt ? new Date(detail.checkedOutAt) : visitor.checkOutTime),
      visitor,
    });
  }
  return rows;
}

/** The primary row for one saved visitor record. */
export function primaryRowForVisitor(visitor: Visitor, parties: PartyLike[]): AccountableRow {
  const mine = partiesForVisitor(parties, visitor.id);
  const primary = mine.find((p) => p.isPrimary);
  const name = `${visitor.firstName} ${visitor.surname}`.trim();
  return {
    key: primary ? primary.id : visitor.id,
    role: "primary",
    source: primary ? "canonical" : "legacy",
    partyId: primary?.id ?? null,
    visitId: primary?.visitId ?? null,
    personId: primary?.personId ?? null,
    visitorId: visitor.id,
    branchId: primary?.branchId ?? null,
    name,
    nameKnown: !!name,
    relationship: null,
    withPrimaryName: null,
    personType: visitor.type,
    companionIndex: 0,
    checkInTime: primary?.checkInTime ?? visitor.checkInTime,
    checkOutTime: primary?.checkOutTime ?? visitor.checkOutTime,
    status: primary ? statusFor(primary.checkOutTime) : visitor.status,
    visitor,
  };
}

/**
 * Every accountable person across the given arrivals, primary first with their
 * companions directly beneath them.
 */
export function buildAccountableRows(
  visitors: Visitor[],
  parties: PartyLike[],
  options: BuildOptions = {}
): AccountableRow[] {
  const { siteId = null, includeUnassigned = false } = options;

  const inSite = (row: AccountableRow) => {
    if (!siteId) return true;
    if (row.branchId === null) return includeUnassigned || row.source === "legacy";
    return row.branchId === siteId;
  };

  return visitors.flatMap((visitor) => {
    const rows = [
      primaryRowForVisitor(visitor, parties),
      ...companionRowsForVisitor(visitor, parties),
    ];
    return rows.filter(inSite);
  });
}
