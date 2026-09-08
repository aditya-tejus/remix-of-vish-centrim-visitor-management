export type Jurisdiction = "AU" | "UK";

export type CredentialState = "valid" | "expiring" | "expired" | "missing" | "pending";

/** Credential keys are user-defined — the list lives in the `credential_types` table */
export type CredentialKey = string;

/** Screening answer key that gates whether required credentials actually block */
export const UNSUPERVISED_ACCESS_KEY = "unsupervised_resident_access";
/** Free-text justification recorded when unsupervised access is answered "No" */
export const ESCORT_REASON_KEY = "unsupervised_escort_reason";

/** What happens when a mandatory credential is missing or out of date */
export type EntryPolicy = "unsupervised" | "provisional" | "reception";

export type HolderScope = "person" | "company";

export interface CredentialType {
  id: string;
  key: string;
  label: string;
  short_label: string;
  jurisdiction: "AU" | "UK" | "ALL";
  is_required: boolean;
  is_active: boolean;
  sort_order: number;
  /** Personal checks (police check / DBS) belong to the worker, not the company */
  holder_scope?: HolderScope;
  /** When true, staff expect an actual document on file — not just a date */
  requires_document?: boolean;
}

export interface SupplierCredentialRecord {
  credential_type_id: string;
  expiry_date: string | null;
  reference: string | null;
}

export interface PersonCredentialRecord {
  credential_type_id: string;
  expiry_date: string | null;
  reference: string | null;
  document_path: string | null;
  verification_status: string | null;
  uploaded_by?: string | null;
  uploaded_at?: string | null;
  verified_by?: string | null;
  verified_at?: string | null;
}

export interface CredentialCheck {
  typeId: string;
  key: CredentialKey;
  label: string;
  shortLabel: string;
  /** True when this credential is marked as required before check-in */
  blocking: boolean;
  scope: HolderScope;
  requiresDocument: boolean;
  state: CredentialState;
  expiry: string | null;
  reference: string | null;
  documentPath: string | null;
  verificationStatus: string | null;
  uploadedBy: string | null;
  uploadedAt: string | null;
  verifiedBy: string | null;
  verifiedAt: string | null;
  daysToExpiry: number | null;
}

const EXPIRING_SOON_DAYS = 30;

function evaluate(expiry: string | null | undefined): { state: CredentialState; days: number | null } {
  if (!expiry) return { state: "missing", days: null };
  const end = new Date(`${expiry}T23:59:59`);
  if (Number.isNaN(end.getTime())) return { state: "missing", days: null };
  const days = Math.ceil((end.getTime() - Date.now()) / 86400000);
  if (days < 0) return { state: "expired", days };
  if (days <= EXPIRING_SOON_DAYS) return { state: "expiring", days };
  return { state: "valid", days };
}

export function scopeOf(t: CredentialType): HolderScope {
  return t.holder_scope === "person" ? "person" : "company";
}

/** Credential types that apply in the given jurisdiction, in display order. */
export function applicableCredentialTypes(
  jurisdiction: Jurisdiction,
  types: CredentialType[]
): CredentialType[] {
  return types
    .filter((t) => t.is_active && (t.jurisdiction === "ALL" || t.jurisdiction === jurisdiction))
    .sort((a, b) => a.sort_order - b.sort_order);
}

interface ChecklistInput {
  /**
   * Credential keys this site insists on. When omitted, the "Required" tick on
   * the credential itself is used. Nothing here is treated as a legal
   * requirement — it is the operator's own policy.
   */
  mandatoryKeys?: string[] | null;

  jurisdiction: Jurisdiction;
  types: CredentialType[];
  /** Company-wide records (insurance, trade licence) held against the supplier */
  supplierRecords?: SupplierCredentialRecord[];
  /** Personal records (police check / DBS / WWCC) held against the individual */
  personRecords?: PersonCredentialRecord[];
}

/**
 * Builds the full compliance checklist for one contractor visit: personal checks
 * come from the worker's own record, company checks from the supplier's.
 *
 * A personal document that has been uploaded but not yet confirmed by a staff
 * member never counts as valid — it sits at "pending" until someone verifies it.
 */
export function buildComplianceChecklist({
  jurisdiction,
  types,
  supplierRecords = [],
  personRecords = [],
  mandatoryKeys = null,
}: ChecklistInput): CredentialCheck[] {

  return applicableCredentialTypes(jurisdiction, types).map((t) => {
    const scope = scopeOf(t);
    const personRec = personRecords.find((r) => r.credential_type_id === t.id);
    const supplierRec = supplierRecords.find((r) => r.credential_type_id === t.id);
    const rec = scope === "person" ? personRec : supplierRec;

    const { state: dateState, days } = evaluate(rec?.expiry_date);
    const verification = scope === "person" ? personRec?.verification_status ?? null : "verified";
    const documentPath = scope === "person" ? personRec?.document_path ?? null : null;

    let state: CredentialState = dateState;
    if (scope === "person" && dateState !== "missing" && dateState !== "expired" && verification !== "verified") {
      state = "pending";
    }
    if (scope === "person" && dateState === "missing" && documentPath && verification !== "verified") {
      state = "pending";
    }

    return {
      typeId: t.id,
      key: t.key,
      label: t.label,
      shortLabel: t.short_label,
      blocking: mandatoryKeys ? mandatoryKeys.includes(t.key) : t.is_required,
      scope,
      requiresDocument: t.requires_document === true,
      state,
      expiry: rec?.expiry_date || null,
      reference: rec?.reference || null,
      documentPath,
      verificationStatus: verification,
      uploadedBy: personRec?.uploaded_by ?? null,
      uploadedAt: personRec?.uploaded_at ?? null,
      verifiedBy: personRec?.verified_by ?? null,
      verifiedAt: personRec?.verified_at ?? null,
      daysToExpiry: days,
    };
  });
}

/** Back-compat helper — company-only view of the checklist. */
export function getSupplierCredentials(
  jurisdiction: Jurisdiction,
  types: CredentialType[],
  records: SupplierCredentialRecord[] = []
): CredentialCheck[] {
  return buildComplianceChecklist({ jurisdiction, types, supplierRecords: records });
}

export interface ContractorGate {
  blocked: boolean;
  reason: string | null;
  /** Every required credential that is missing, expired or awaiting verification */
  failing: CredentialCheck[];
  /** True when the contractor was marked as having unsupervised resident access */
  unsupervisedAccess: boolean;
  /** True when the access question still needs an answer before proceeding */
  needsAnswer: boolean;
  /** True when a "No" answer needs a written escort/exemption justification */
  needsEscortReason: boolean;
  /** True when entry may go ahead but must be recorded as escorted / pending checks */
  provisional: boolean;
  /** True when the kiosk should send them to a staff member instead of continuing */
  seeReception: boolean;
  entryPolicy: EntryPolicy;
}

interface GateInput {
  jurisdiction: Jurisdiction;
  supplierName: string | null;
  types: CredentialType[];
  /** Pre-built checklist. When absent it is derived from the record arrays. */
  checklist?: CredentialCheck[];
  records?: SupplierCredentialRecord[];
  personRecords?: PersonCredentialRecord[];
  /** null = not yet answered */
  unsupervisedAccess: boolean | null;
  escortReason?: string;
  entryPolicy?: EntryPolicy;
  /** Personal checks cannot be evaluated until we know who the worker is */
  personIdentified?: boolean;
}

function joinList(parts: string[]) {
  return parts.length > 1
    ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`
    : parts[0];
}

function describe(c: CredentialCheck) {
  if (c.state === "expired") return `${c.label} expired on ${c.expiry}`;
  if (c.state === "pending") return `${c.label} is waiting for a staff member to confirm it`;
  return `${c.label} has not been recorded`;
}

/**
 * Evaluates every credential marked as required, against the configured entry
 * policy:
 *  - "unsupervised": only blocks contractors who will be alone with residents
 *  - "provisional":  entry allowed but flagged as escorted / checks pending
 *  - "reception":    kiosk stops and sends them to a staff member
 */
export function evaluateContractorGate({
  jurisdiction,
  supplierName,
  types,
  checklist,
  records = [],
  personRecords = [],
  unsupervisedAccess,
  escortReason = "",
  entryPolicy = "unsupervised",
  personIdentified = true,
}: GateInput): ContractorGate {
  const credentials =
    checklist ??
    buildComplianceChecklist({ jurisdiction, types, supplierRecords: records, personRecords });
  const required = credentials.filter((c) => c.blocking);
  const answered = unsupervisedAccess === true || unsupervisedAccess === false;
  const yes = unsupervisedAccess === true;

  const base = {
    failing: [] as CredentialCheck[],
    unsupervisedAccess: yes,
    needsAnswer: false,
    needsEscortReason: false,
    provisional: false,
    seeReception: false,
    entryPolicy,
  };

  // Nothing is required — the question is informational only.
  if (required.length === 0) {
    return { blocked: false, reason: null, ...base };
  }

  if (!answered) {
    return {
      blocked: true,
      reason: "Answer whether this contractor will have unsupervised access to residents.",
      ...base,
      needsAnswer: true,
    };
  }

  const needsPerson = required.some((c) => c.scope === "person");
  if (needsPerson && !personIdentified) {
    return {
      blocked: true,
      reason: "Enter the contractor's own name and mobile so their personal checks can be looked up.",
      ...base,
      failing: required.filter((c) => c.scope === "person"),
    };
  }

  const needsCompany = required.some((c) => c.scope === "company");
  if (needsCompany && !supplierName) {
    const names = required.filter((c) => c.scope === "company").map((c) => c.label).join(" and ");
    return {
      blocked: true,
      reason: `Select the contractor's company so their ${names} can be checked.`,
      ...base,
      failing: required.filter((c) => c.scope === "company"),
    };
  }

  const failing = required.filter(
    (c) => c.state === "missing" || c.state === "expired" || c.state === "pending"
  );
  if (failing.length === 0) {
    return { blocked: false, reason: null, ...base };
  }

  const list = joinList(failing.map(describe));

  if (entryPolicy === "reception") {
    return {
      blocked: true,
      reason: `${list}. A staff member needs to complete this check-in at reception.`,
      ...base,
      failing,
      seeReception: true,
    };
  }

  if (entryPolicy === "provisional") {
    return {
      blocked: false,
      reason: `${list}. Entry allowed provisionally — this contractor must stay escorted until the checks are confirmed.`,
      ...base,
      failing,
      provisional: true,
    };
  }

  if (yes) {
    return {
      blocked: true,
      reason: `${list}. Unsupervised resident access cannot proceed until these are current.`,
      ...base,
      failing,
    };
  }

  const needsEscortReason = escortReason.trim().length < 3;
  return {
    blocked: needsEscortReason,
    reason: needsEscortReason
      ? `${list}. Record who is escorting this contractor, or why resident contact is not possible, before continuing.`
      : `${list}. Not blocking — escorted / no unsupervised resident access.`,
    ...base,
    failing,
    needsEscortReason,
    provisional: !needsEscortReason,
  };
}
