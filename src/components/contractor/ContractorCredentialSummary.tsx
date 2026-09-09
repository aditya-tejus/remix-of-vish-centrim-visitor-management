import { useEffect, useState } from "react";
import { ShieldCheck, CheckCircle2, AlertTriangle, XCircle, Clock3 } from "lucide-react";
import { buildComplianceChecklist } from "@/lib/contractorCredentials";
import { summariseCredentials, type CredentialLine } from "@/lib/profileSections";
import { useCredentialTypes, useSupplierCredentials } from "@/hooks/useContractorEnforcement";
import { findContractorPerson, usePersonCredentials, type ContractorPerson } from "@/hooks/useContractorPeople";
import { useMandatoryCredentials } from "@/hooks/useMandatoryCredentials";
import { useJurisdiction } from "@/hooks/useJurisdiction";

interface Props {
  firstName: string;
  surname: string;
  mobile?: string | null;
  supplierId?: string | null;
  /** Lets the profile show outstanding documents in the attention strip. */
  onOutstandingChange?: (labels: string[]) => void;
}

const STATE_ICON = {
  valid: CheckCircle2,
  expiring: Clock3,
  expired: XCircle,
  missing: AlertTriangle,
  pending: Clock3,
} as const;

/**
 * Read-only view of a contractor's compliance documents, composed from the
 * records already held for the person and their company. Nothing can be
 * uploaded, confirmed or created from here.
 */
export function ContractorCredentialSummary({
  firstName, surname, mobile, supplierId, onOutstandingChange,
}: Props) {
  const { jurisdiction } = useJurisdiction();
  const { activeTypes } = useCredentialTypes();
  const { records: supplierRecords } = useSupplierCredentials(supplierId);
  const [person, setPerson] = useState<ContractorPerson | null>(null);
  const { records: personRecords } = usePersonCredentials(person?.id);
  const { mandatoryKeys } = useMandatoryCredentials();

  useEffect(() => {
    let cancelled = false;
    findContractorPerson({ firstName, surname, mobile: mobile || "" }).then((p) => {
      if (!cancelled) setPerson(p);
    });
    return () => { cancelled = true; };
  }, [firstName, surname, mobile]);

  const checklist = buildComplianceChecklist({
    jurisdiction: jurisdiction === "AU" ? "AU" : "UK",
    types: activeTypes,
    supplierRecords,
    personRecords,
    mandatoryKeys,
  });

  const { lines, outstanding } = summariseCredentials(checklist as any);

  useEffect(() => {
    onOutstandingChange?.(outstanding);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outstanding.join("|")]);

  if (lines.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Compliance documents
      </p>
      {!person && (
        <p className="text-[12px] text-muted-foreground">
          No personal record found for {firstName} {surname} yet, so only company documents are shown.
        </p>
      )}
      <ul className="rounded-xl border border-border divide-y divide-border overflow-hidden">
        {lines.map((line: CredentialLine) => {
          const Icon = STATE_ICON[line.state] || AlertTriangle;
          return (
            <li key={line.key} className="px-3.5 py-2.5 flex items-center justify-between gap-4">
              <span className="text-[13px] text-foreground">{line.label}</span>
              <span
                className={`shrink-0 inline-flex items-center gap-1.5 text-[12px] font-medium ${
                  line.outstanding ? "text-destructive" : "text-muted-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {line.statusText}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="text-[11px] text-muted-foreground">
        Read only. Documents are recorded from the contractor pages.
      </p>
    </div>
  );
}
