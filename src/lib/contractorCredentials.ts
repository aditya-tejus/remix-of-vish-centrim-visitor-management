import { Supplier } from "@/hooks/useSuppliers";

export type Jurisdiction = "AU" | "UK";

export type CredentialState = "valid" | "expiring" | "expired" | "missing";

export interface CredentialCheck {
  /** Field key on suppliers_min holding the expiry date */
  expiryField: "dbs_expiry_date" | "acws_expiry_date" | "insurance_expiry_date";
  referenceField: "dbs_reference" | "acws_reference" | "insurance_reference";
  label: string;
  shortLabel: string;
  /** Blocks check-in when missing or expired */
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

/**
 * Credential checks for a supplier in the given jurisdiction.
 * Exactly one credential is treated as blocking — the highest-risk one:
 *   UK -> DBS check, AU -> Aged Care Worker Screening.
 * Everything else (insurance, WHS/PPE answers) is a staff-reviewable warning.
 */
export function getSupplierCredentials(
  jurisdiction: Jurisdiction,
  supplier: Supplier | null
): CredentialCheck[] {
  const primary: CredentialCheck =
    jurisdiction === "UK"
      ? {
          expiryField: "dbs_expiry_date",
          referenceField: "dbs_reference",
          label: "DBS Check",
          shortLabel: "DBS",
          blocking: true,
          ...evaluateInto(supplier?.dbs_expiry_date, supplier?.dbs_reference),
        }
      : {
          expiryField: "acws_expiry_date",
          referenceField: "acws_reference",
          label: "Aged Care Worker Screening",
          shortLabel: "ACWS",
          blocking: true,
          ...evaluateInto(supplier?.acws_expiry_date, supplier?.acws_reference),
        };

  const insurance: CredentialCheck = {
    expiryField: "insurance_expiry_date",
    referenceField: "insurance_reference",
    label: "Public Liability Insurance",
    shortLabel: "Insurance",
    blocking: false,
    ...evaluateInto(supplier?.insurance_expiry_date, supplier?.insurance_reference),
  };

  return [primary, insurance];
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
 * True when check-in must be blocked: the single highest-risk credential
 * is missing or expired for the selected supplier.
 *
 * `enforcement` comes from the global `contractor_credential_enforcement`
 * setting — in "warn" mode the reason is still returned for display, but
 * `blocked` is false so staff can proceed.
 */
export function isContractorBlocked(
  jurisdiction: Jurisdiction,
  supplier: Supplier | null,
  enforcement: "warn" | "block" = "block"
): { blocked: boolean; reason: string | null; credential: CredentialCheck | null; enforcement: "warn" | "block" } {
  const credentials = getSupplierCredentials(jurisdiction, supplier);
  const primary = credentials.find((c) => c.blocking) || null;
  const gate = (blocked: boolean, reason: string | null, credential: CredentialCheck | null) => ({
    blocked: blocked && enforcement === "block",
    reason,
    credential,
    enforcement,
  });

  if (!supplier) {
    return gate(true, `Select the contractor's supplier so their ${primary?.label} can be verified.`, primary);
  }
  if (!primary) return gate(false, null, null);
  if (primary.state === "missing") {
    return gate(
      true,
      `${primary.label} has not been recorded for ${supplier.name}. Record the expiry date and reference before allowing site access.`,
      primary
    );
  }
  if (primary.state === "expired") {
    return gate(
      true,
      `${primary.label} for ${supplier.name} expired on ${primary.expiry}. Site access cannot proceed until it is renewed.`,
      primary
    );
  }
  return gate(false, null, primary);
}

