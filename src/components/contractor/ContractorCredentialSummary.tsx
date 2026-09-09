import { useEffect, useState } from "react";
import { ShieldCheck, CheckCircle2, AlertTriangle, XCircle, Clock3, MinusCircle, FileClock } from "lucide-react";
import { findContractorPerson, type ContractorPerson } from "@/hooks/useContractorPeople";
import { useComplianceStatus } from "@/hooks/useContractorDocuments";
import { summariseCompliance, type DocumentStatus } from "@/lib/contractorDocuments";
import { useOperatingContext } from "@/contexts/OperatingContext";

interface Props {
  firstName: string;
  surname: string;
  mobile?: string | null;
  supplierId?: string | null;
  /** Lets the profile show outstanding documents in the attention strip. */
  onOutstandingChange?: (labels: string[]) => void;
}

const STATE_ICON: Record<DocumentStatus, typeof CheckCircle2> = {
  valid: CheckCircle2,
  expiring: Clock3,
  grace: AlertTriangle,
  expired: XCircle,
  missing: AlertTriangle,
  pending: FileClock,
  rejected: XCircle,
  not_required: MinusCircle,
};

/**
 * Read-only view of a contractor's compliance documents. The status shown is
 * the server's own verdict (`contractor_compliance_status`), so this screen
 * cannot disagree with what happens at check-in. Nothing can be uploaded,
 * decided or created from here.
 */
export function ContractorCredentialSummary({
  firstName, surname, mobile, supplierId, onOutstandingChange,
}: Props) {
  const { siteId } = useOperatingContext();
  const [person, setPerson] = useState<ContractorPerson | null>(null);

  useEffect(() => {
    let cancelled = false;
    findContractorPerson({ firstName, surname, mobile: mobile || "" }).then((p) => {
      if (!cancelled) setPerson(p);
    });
    return () => { cancelled = true; };
  }, [firstName, surname, mobile]);

  const { rows } = useComplianceStatus({
    personId: person?.id ?? null,
    supplierId: supplierId ?? null,
    branchId: siteId,
  });

  const { lines, outstanding, awaitingReview } = summariseCompliance(rows);

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
      {awaitingReview > 0 && (
        <p className="text-[12px] text-muted-foreground flex items-center gap-1.5">
          <FileClock className="h-3.5 w-3.5" aria-hidden="true" />
          {awaitingReview} document{awaitingReview === 1 ? "" : "s"} awaiting review
        </p>
      )}
      <ul className="rounded-xl border border-border divide-y divide-border overflow-hidden">
        {lines.map((line) => {
          const Icon = STATE_ICON[line.status] || AlertTriangle;
          return (
            <li key={line.key} className="px-3.5 py-2.5 flex items-center justify-between gap-4">
              <span className="min-w-0">
                <span className="block text-[13px] text-foreground">{line.label}</span>
                <span className="block text-[11px] text-muted-foreground">{line.detail}</span>
              </span>
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
        Read only. Documents are submitted and decided in Contractor documents.
      </p>
    </div>
  );
}
