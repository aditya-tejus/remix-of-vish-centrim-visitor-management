import { Supplier } from "@/hooks/useSuppliers";

export type Jurisdiction = "AU" | "UK";

export type CredentialState = "valid" | "expiring" | "expired" | "missing";

/** Keys stored in the `contractor_mandatory_credentials` setting */
export type CredentialKey = "dbs" | "acws" | "insurance";

/** Screening answer key that gates whether mandatory credentials actually block */
export const UNSUPERVISED_ACCESS_KEY = "unsupervised_resident_access";

export interface CredentialCheck {
  /** Stable key used by the mandatory-credentials setting */
  key: CredentialKey;
  /** Field key on suppliers_min holding the expiry date */
  expiryField: "dbs_expiry_date" | "acws_expiry_date" | "insurance_expiry_date";
  referenceField: "dbs_reference" | "acws_reference" | "insurance_reference";
  label: string;
  shortLabel: string;
  /** True when this credential is in the configured mandatory list */
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

function evaluateInto(expiry: string | null | undefined, reference: string | null | undefined) {
  const { state, days } = evaluate(expiry);
  return {
    state,
    expiry: expiry || null,
    reference: reference || null,
    daysToExpiry: days,
  };
}

/**
 * Credential checks for a supplier in the given jurisdiction.
 * Which credentials are treated as blocking is driven entirely by the
 * `contractor_mandatory_credentials` setting (default: none).
 *   UK -> DBS check, AU -> Aged Care Worker Screening, plus Public Liability Insurance.
 */
export function getSupplierCredentials(
  jurisdiction: Jurisdiction,
  supplier: Supplier | null,
  mandatory: CredentialKey[] = []
): CredentialCheck[] {
  const primary: CredentialCheck =
    jurisdiction === "UK"
      ? {
          key: "dbs",
          expiryField: "dbs_expiry_date",
          referenceField: "dbs_reference",
          label: "DBS Check",
          shortLabel: "DBS",
          blocking: mandatory.includes("dbs"),
          ...evaluateInto(supplier?.dbs_expiry_date, supplier?.dbs_reference),
        }
      : {
          key: "acws",
          expiryField: "acws_expiry_date",
          referenceField: "acws_reference",
          label: "Aged Care Worker Screening",
          shortLabel: "ACWS",
          blocking: mandatory.includes("acws"),
          ...evaluateInto(supplier?.acws_expiry_date, supplier?.acws_reference),
        };

  const insurance: CredentialCheck = {
    key: "insurance",
    expiryField: "insurance_expiry_date",
    referenceField: "insurance_reference",
    label: "Public Liability Insurance",
    shortLabel: "Insurance",
    blocking: mandatory.includes("insurance"),
    ...evaluateInto(supplier?.insurance_expiry_date, supplier?.insurance_reference),
  };

  return [primary, insurance];
}

export interface ContractorGate {
  blocked: boolean;
  reason: string | null;
  /** Every mandatory credential that is missing or expired */
  failing: CredentialCheck[];
  /** True when the contractor was marked as having unsupervised resident access */
  unsupervisedAccess: boolean;
}

/**
 * Evaluates every credential flagged as mandatory.
 *
 * The block only bites when the contractor has been marked as having
 * unsupervised access to residents. Escorted contractors, or ones with no
 * resident contact at all, still surface the reason for staff visibility but
 * are never blocked.
 */
export function isContractorBlocked(
  jurisdiction: Jurisdiction,
  supplier: Supplier | null,
  mandatory: CredentialKey[] = [],
  unsupervisedAccess = false
): ContractorGate {
  const credentials = getSupplierCredentials(jurisdiction, supplier, mandatory);
  const required = credentials.filter((c) => c.blocking);

  if (required.length === 0) {
    return { blocked: false, reason: null, failing: [], unsupervisedAccess };
  }

  if (!supplier) {
    const names = required.map((c) => c.label).join(" and ");
    return {
      blocked: unsupervisedAccess,
      reason: `Select the contractor's supplier so their ${names} can be verified.`,
      failing: required,
      unsupervisedAccess,
    };
  }

  const failing = required.filter((c) => c.state === "missing" || c.state === "expired");
  if (failing.length === 0) {
    return { blocked: false, reason: null, failing: [], unsupervisedAccess };
  }

  const parts = failing.map((c) =>
    c.state === "expired"
      ? `${c.label} expired on ${c.expiry}`
      : `${c.label} has not been recorded`
  );
  const list = parts.length > 1
    ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`
    : parts[0];

  const reason = unsupervisedAccess
    ? `${list} for ${supplier.name}. Unsupervised resident access cannot proceed until these are current.`
    : `${list} for ${supplier.name}. Not blocking — this contractor is not marked as having unsupervised resident access.`;

  return { blocked: unsupervisedAccess, reason, failing, unsupervisedAccess };
}
