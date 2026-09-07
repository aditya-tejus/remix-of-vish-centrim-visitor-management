export type Jurisdiction = "AU" | "UK";

export type CredentialState = "valid" | "expiring" | "expired" | "missing";

/** Credential keys are user-defined — the list lives in the `credential_types` table */
export type CredentialKey = string;

/** Screening answer key that gates whether required credentials actually block */
export const UNSUPERVISED_ACCESS_KEY = "unsupervised_resident_access";
/** Free-text justification recorded when unsupervised access is answered "No" */
export const ESCORT_REASON_KEY = "unsupervised_escort_reason";

export interface CredentialType {
  id: string;
  key: string;
  label: string;
  short_label: string;
  jurisdiction: "AU" | "UK" | "ALL";
  is_required: boolean;
  is_active: boolean;
  sort_order: number;
}

export interface SupplierCredentialRecord {
  credential_type_id: string;
  expiry_date: string | null;
  reference: string | null;
}

export interface CredentialCheck {
  typeId: string;
  key: CredentialKey;
  label: string;
  shortLabel: string;
  /** True when this credential is marked as required before check-in */
  blocking: boolean;
  state: CredentialState;
  expiry: string | null;
  reference: string | null;
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

/** Credential types that apply in the given jurisdiction, in display order. */
export function applicableCredentialTypes(
  jurisdiction: Jurisdiction,
  types: CredentialType[]
): CredentialType[] {
  return types
    .filter((t) => t.is_active && (t.jurisdiction === "ALL" || t.jurisdiction === jurisdiction))
    .sort((a, b) => a.sort_order - b.sort_order);
}

/**
 * Builds the credential checklist for a supplier from the configured credential
 * types and whatever the supplier has on record.
 */
export function getSupplierCredentials(
  jurisdiction: Jurisdiction,
  types: CredentialType[],
  records: SupplierCredentialRecord[] = []
): CredentialCheck[] {
  return applicableCredentialTypes(jurisdiction, types).map((t) => {
    const rec = records.find((r) => r.credential_type_id === t.id);
    const { state, days } = evaluate(rec?.expiry_date);
    return {
      typeId: t.id,
      key: t.key,
      label: t.label,
      shortLabel: t.short_label,
      blocking: t.is_required,
      state,
      expiry: rec?.expiry_date || null,
      reference: rec?.reference || null,
      daysToExpiry: days,
    };
  });
}

export interface ContractorGate {
  blocked: boolean;
  reason: string | null;
  /** Every required credential that is missing or expired */
  failing: CredentialCheck[];
  /** True when the contractor was marked as having unsupervised resident access */
  unsupervisedAccess: boolean;
  /** True when the access question still needs an answer before proceeding */
  needsAnswer: boolean;
  /** True when a "No" answer needs a written escort/exemption justification */
  needsEscortReason: boolean;
}

interface GateInput {
  jurisdiction: Jurisdiction;
  supplierName: string | null;
  types: CredentialType[];
  records?: SupplierCredentialRecord[];
  /** null = not yet answered */
  unsupervisedAccess: boolean | null;
  escortReason?: string;
}

/**
 * Evaluates every credential marked as required.
 *
 * The block only bites when the contractor has been marked as having
 * unsupervised access to residents. Escorted contractors, or ones with no
 * resident contact, still surface the reason for staff visibility but are not
 * blocked — though the exemption must be justified in writing when a required
 * credential is missing or expired.
 */
export function evaluateContractorGate({
  jurisdiction,
  supplierName,
  types,
  records = [],
  unsupervisedAccess,
  escortReason = "",
}: GateInput): ContractorGate {
  const credentials = getSupplierCredentials(jurisdiction, types, records);
  const required = credentials.filter((c) => c.blocking);
  const answered = unsupervisedAccess === true || unsupervisedAccess === false;
  const yes = unsupervisedAccess === true;

  const base = {
    failing: [] as CredentialCheck[],
    unsupervisedAccess: yes,
    needsAnswer: false,
    needsEscortReason: false,
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

  if (!supplierName) {
    const names = required.map((c) => c.label).join(" and ");
    return {
      blocked: yes,
      reason: `Select the contractor's supplier so their ${names} can be verified.`,
      ...base,
      failing: required,
    };
  }

  const failing = required.filter((c) => c.state === "missing" || c.state === "expired");
  if (failing.length === 0) {
    return { blocked: false, reason: null, ...base };
  }

  const parts = failing.map((c) =>
    c.state === "expired" ? `${c.label} expired on ${c.expiry}` : `${c.label} has not been recorded`
  );
  const list =
    parts.length > 1
      ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`
      : parts[0];

  if (yes) {
    return {
      blocked: true,
      reason: `${list} for ${supplierName}. Unsupervised resident access cannot proceed until these are current.`,
      ...base,
      failing,
    };
  }

  const needsEscortReason = escortReason.trim().length < 3;
  return {
    blocked: needsEscortReason,
    reason: needsEscortReason
      ? `${list} for ${supplierName}. Record who is escorting this contractor, or why resident contact is not possible, before continuing.`
      : `${list} for ${supplierName}. Not blocking — escorted / no unsupervised resident access.`,
    ...base,
    failing,
    needsEscortReason,
  };
}
