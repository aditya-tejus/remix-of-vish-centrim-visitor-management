import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ComplianceChecklist } from "./ComplianceChecklist";
import { buildComplianceChecklist } from "@/lib/contractorCredentials";
import { useCredentialTypes, useSupplierCredentials } from "@/hooks/useContractorEnforcement";
import { findContractorPerson, usePersonCredentials, type ContractorPerson } from "@/hooks/useContractorPeople";
import { useJurisdiction } from "@/hooks/useJurisdiction";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useMandatoryCredentials } from "@/hooks/useMandatoryCredentials";

interface Props {
  firstName: string;
  surname: string;
  mobile?: string | null;
  supplierId?: string | null;
}

/**
 * Everything the front desk needs to see about one contractor's compliance:
 * their personal checks, their company's checks, the documents themselves and
 * who confirmed each one.
 */
export function ContractorCompliancePanel({ firstName, surname, mobile, supplierId }: Props) {
  const { jurisdiction } = useJurisdiction();
  const { activeTypes } = useCredentialTypes();
  const { records: supplierRecords, save: saveCompany } = useSupplierCredentials(supplierId);
  const [person, setPerson] = useState<ContractorPerson | null>(null);
  const { records: personRecords, save: savePerson, verify } = usePersonCredentials(person?.id);
  const { toast } = useToast();

  useEffect(() => {
    let cancelled = false;
    findContractorPerson({ firstName, surname, mobile: mobile || "" }).then((p) => {
      if (!cancelled) setPerson(p);
    });
    return () => { cancelled = true; };
  }, [firstName, surname, mobile]);

  const { mandatoryKeys } = useMandatoryCredentials();

  const checklist = buildComplianceChecklist({
    jurisdiction: jurisdiction === "AU" ? "AU" : "UK",
    types: activeTypes,
    supplierRecords,
    personRecords,
    mandatoryKeys,
  });

  if (checklist.length === 0) return null;

  const outstanding = checklist.filter((c) => c.state !== "valid" && c.state !== "expiring").length;

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" /> Compliance documents
        </h3>
        <span className="text-xs text-muted-foreground">
          {outstanding === 0 ? "All current" : `${outstanding} need attention`}
        </span>
      </div>

      {!person && (
        <p className="text-xs text-muted-foreground">
          No personal record found for {firstName} {surname} yet — it is created the next time they check in.
        </p>
      )}

      <ComplianceChecklist
        checklist={checklist}
        personId={person?.id ?? null}
        onSavePerson={async (typeId, fields) => { await savePerson(typeId, fields as any); }}
        onSaveCompany={async (typeId, fields) => { await saveCompany(typeId, fields); }}
        onVerify={async (typeId, expiry) => {
          const { data } = await supabase.auth.getUser();
          try {
            await verify(typeId, data.user?.email || "Staff", expiry ?? undefined);
          } catch {
            toast({ title: "Could not confirm", variant: "destructive" });
          }
        }}
      />
    </Card>
  );
}
