/**
 * Phase 8E — contractor documentation verification.
 *
 * One place that decides what a document status *means*. The server function
 * `contractor_compliance_status` is the authority for the status itself; this
 * file only turns that answer into words, ordering and simple arithmetic so the
 * profile, the reviewer queue and check-in cannot disagree with each other.
 */

export type DocumentStatus =
  | "valid"
  | "expiring"
  | "grace"
  | "pending"
  | "rejected"
  | "expired"
  | "missing"
  | "not_required";

export type ReviewDecision = "approved" | "rejected" | "not_required";

export interface ComplianceRow {
  credential_type_id: string;
  credential_key: string;
  label: string;
  short_label: string;
  holder_scope: "person" | "company";
  mandatory: boolean;
  block_on_fail: boolean;
  grace_days: number;
  status: DocumentStatus;
  expiry_date: string | null;
  grace_ends: string | null;
  blocking: boolean;
  document_id: string | null;
  version: number | null;
  submitted_at: string | null;
  reviewed_at: string | null;
}

export const STATUS_TEXT: Record<DocumentStatus, string> = {
  valid: "Verified",
  expiring: "Expiring soon",
  grace: "Expired — grace period",
  pending: "Awaiting review",
  rejected: "Rejected",
  expired: "Expired",
  missing: "Not on file",
  not_required: "Not required",
};

/** Statuses that still need somebody to do something. */
export function isOutstanding(status: DocumentStatus): boolean {
  return status !== "valid" && status !== "expiring" && status !== "not_required";
}

/** Nothing counts as verified unless a reviewer said so — never inferred. */
export function isVerified(status: DocumentStatus): boolean {
  return status === "valid" || status === "expiring" || status === "grace";
}

export function daysUntil(date: string | null, now: Date = new Date()): number | null {
  if (!date) return null;
  const end = new Date(`${date}T23:59:59`);
  if (Number.isNaN(end.getTime())) return null;
  return Math.ceil((end.getTime() - now.getTime()) / 86400000);
}

export function ageInDays(submittedAt: string | null, now: Date = new Date()): number {
  if (!submittedAt) return 0;
  const t = new Date(submittedAt).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((now.getTime() - t) / 86400000));
}

/** Plain sentence for one line of the profile or the check-in warning. */
export function statusDetail(row: ComplianceRow, now: Date = new Date()): string {
  switch (row.status) {
    case "valid":
      return row.expiry_date ? `Valid to ${row.expiry_date}` : "Verified — no expiry recorded";
    case "expiring": {
      const d = daysUntil(row.expiry_date, now);
      return `Expires in ${d} day${d === 1 ? "" : "s"} (${row.expiry_date})`;
    }
    case "grace":
      return `Expired ${row.expiry_date} — grace period ends ${row.grace_ends}`;
    case "pending":
      return "Submitted — a reviewer needs to decide";
    case "rejected":
      return "Rejected — a new document is needed";
    case "expired":
      return `Expired on ${row.expiry_date}`;
    case "missing":
      return "Nothing on file";
    case "not_required":
      return "Not required at this site";
  }
}

export interface ComplianceSummary {
  lines: Array<{
    key: string;
    label: string;
    status: DocumentStatus;
    statusText: string;
    detail: string;
    outstanding: boolean;
    mandatory: boolean;
  }>;
  outstanding: string[];
  blocked: boolean;
  blockedReason: string | null;
  awaitingReview: number;
}

/**
 * Reception view. Deliberately status only — no reference numbers, no files,
 * no reviewer notes.
 */
export function summariseCompliance(rows: ComplianceRow[], now: Date = new Date()): ComplianceSummary {
  const lines = rows.map((r) => ({
    key: r.credential_key,
    label: r.label,
    status: r.status,
    statusText: STATUS_TEXT[r.status] ?? String(r.status),
    detail: statusDetail(r, now),
    outstanding: isOutstanding(r.status),
    mandatory: r.mandatory,
  }));

  const blockingRows = rows.filter((r) => r.blocking);
  const outstanding = lines.filter((l) => l.outstanding && l.mandatory).map((l) => l.label);

  return {
    lines,
    outstanding: outstanding.length ? outstanding : lines.filter((l) => l.outstanding).map((l) => l.label),
    blocked: blockingRows.length > 0,
    blockedReason: blockingRows.length
      ? `${blockingRows.map((r) => r.label).join(", ")} must be verified before unsupervised work`
      : null,
    awaitingReview: rows.filter((r) => r.status === "pending").length,
  };
}

export interface QueueRow {
  id: string;
  branch_id: string;
  credential_type_id: string;
  holder_scope: "person" | "company";
  holder_name: string;
  company_name: string | null;
  type_label: string;
  /** Lifecycle of the evidence itself, as stored: an approved one reads "verified". */
  status: DocumentStatus | "superseded" | "verified";
  version: number;
  submitted_by: string;
  submitted_at: string;
  expiry_date: string | null;
}

export interface QueueFilters {
  status?: string;
  credentialTypeId?: string;
  minAgeDays?: number;
  search?: string;
}

/** Queue filtering, oldest waiting first. */
export function filterQueue(rows: QueueRow[], f: QueueFilters, now: Date = new Date()): QueueRow[] {
  const term = (f.search || "").trim().toLowerCase();
  return rows
    .filter((r) => (f.status && f.status !== "all" ? r.status === f.status : true))
    .filter((r) => (f.credentialTypeId && f.credentialTypeId !== "all" ? r.credential_type_id === f.credentialTypeId : true))
    .filter((r) => (f.minAgeDays ? ageInDays(r.submitted_at, now) >= f.minAgeDays : true))
    .filter((r) =>
      term
        ? `${r.holder_name} ${r.company_name || ""} ${r.type_label}`.toLowerCase().includes(term)
        : true
    )
    .sort((a, b) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime());
}

/** A decision may only be recorded once, and rejection always needs words. */
export function validateDecision(input: {
  decision: ReviewDecision;
  reasonCode?: string | null;
  notes?: string | null;
  alreadyDecided?: boolean;
}): { ok: boolean; error: string | null } {
  if (input.alreadyDecided) return { ok: false, error: "This document has already been decided" };
  if (input.decision === "rejected" && !(input.reasonCode || (input.notes || "").trim())) {
    return { ok: false, error: "Give a reason before rejecting" };
  }
  return { ok: true, error: null };
}

export const REASON_CODES: Array<{ value: string; label: string }> = [
  { value: "illegible", label: "Cannot be read" },
  { value: "expired_on_arrival", label: "Already expired" },
  { value: "wrong_document", label: "Wrong document type" },
  { value: "name_mismatch", label: "Name does not match" },
  { value: "insufficient_cover", label: "Cover or scope insufficient" },
  { value: "other", label: "Other (explain in notes)" },
];

/** Storage path convention: site first, so storage rules can check the site. */
export function documentStoragePath(input: {
  branchId: string;
  holderScope: "person" | "company";
  holderId: string;
  credentialKey: string;
  fileName: string;
  uid: string;
}): string {
  const ext = (input.fileName.split(".").pop() || "dat").toLowerCase().replace(/[^a-z0-9]/g, "");
  const key = input.credentialKey.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `${input.branchId}/${input.holderScope}/${input.holderId}/${key}/${input.uid}.${ext}`;
}
