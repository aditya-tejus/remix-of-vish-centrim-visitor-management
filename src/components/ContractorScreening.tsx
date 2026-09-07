import { useState, useMemo, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useSuppliers, Supplier } from "@/hooks/useSuppliers";
import { Search, Check, Building2, Shield, HardHat, FileCheck, AlertTriangle, Syringe, ShieldAlert, CalendarClock, Loader2 } from "lucide-react";
import {
  buildComplianceChecklist,
  evaluateContractorGate,
  UNSUPERVISED_ACCESS_KEY,
  ESCORT_REASON_KEY,
} from "@/lib/contractorCredentials";
import { useCredentialTypes, useSupplierCredentials } from "@/hooks/useContractorEnforcement";
import {
  findContractorPerson,
  upsertContractorPerson,
  usePersonCredentials,
  useContractorEntryPolicy,
  type ContractorPerson,
} from "@/hooks/useContractorPeople";
import { ComplianceChecklist } from "@/components/contractor/ComplianceChecklist";
import { useToast } from "@/hooks/use-toast";

// AU screening template
const auScreeningQuestions = [
  { id: "swms", label: "Safe Work Method Statement (SWMS) provided?", type: "yesno" as const, required: true, icon: FileCheck },
  { id: "ppe", label: "Wearing appropriate PPE (hard hat, hi-vis, steel caps)?", type: "yesno" as const, required: true, icon: HardHat },
  { id: "permits", label: "Holds current work permits / licences?", type: "yesno" as const, required: true, icon: Shield },
  { id: "induction", label: "Completed site induction?", type: "yesno" as const, required: true, icon: Shield },
  { id: "infection_control", label: "No signs of illness or infection?", type: "yesno" as const, required: true, icon: Syringe },
  { id: "work_area", label: "Work area / scope of works", type: "text" as const, required: true, placeholder: "e.g. Room 12 bathroom renovation" },
];

// UK screening template
const ukScreeningQuestions = [
  { id: "rams", label: "Risk Assessment & Method Statement (RAMS) provided?", type: "yesno" as const, required: true, icon: FileCheck },
  { id: "ppe", label: "Wearing appropriate PPE?", type: "yesno" as const, required: true, icon: HardHat },
  { id: "permits", label: "Required permits / CSCS card valid?", type: "yesno" as const, required: true, icon: Shield },
  { id: "safeguarding", label: "Completed safeguarding awareness?", type: "yesno" as const, required: true, icon: Shield },
  { id: "infection_control", label: "No signs of illness or infection?", type: "yesno" as const, required: true, icon: Syringe },
  { id: "work_area", label: "Work area / scope of works", type: "text" as const, required: true, placeholder: "e.g. Kitchen refurbishment, East Wing" },
];

interface ContractorScreeningProps {
  jurisdiction: "AU" | "UK";
  answers: Record<string, any>;
  onAnswersChange: (answers: Record<string, any>) => void;
  selectedSupplier: Supplier | null;
  onSupplierChange: (supplier: Supplier | null) => void;
  compact?: boolean;
  /** Reports whether credential status currently holds up check-in */
  onBlockedChange?: (blocked: boolean, reason: string | null) => void;
}

export function ContractorScreening({
  jurisdiction,
  answers,
  onAnswersChange,
  selectedSupplier,
  onSupplierChange,
  compact = true,
  onBlockedChange,
}: ContractorScreeningProps) {
  const { suppliers } = useSuppliers();
  const { toast } = useToast();
  const [savingCredential, setSavingCredential] = useState<string | null>(null);
  const [supplierSearch, setSupplierSearch] = useState("");
  const [showSupplierList, setShowSupplierList] = useState(false);

  const questions = jurisdiction === "AU" ? auScreeningQuestions : ukScreeningQuestions;

  const { activeTypes } = useCredentialTypes();
  const { records, save } = useSupplierCredentials(selectedSupplier?.id);

  const filteredSuppliers = useMemo(() => {
    if (!supplierSearch.trim()) return suppliers;
    const q = supplierSearch.toLowerCase();
    return suppliers.filter(
      (s) => s.name.toLowerCase().includes(q) || s.abn?.includes(q) || s.company_number?.includes(q)
    );
  }, [suppliers, supplierSearch]);

  const setAnswer = (id: string, value: any) => {
    onAnswersChange({ ...answers, [id]: value });
  };

  const unsupervisedAnswer: boolean | null =
    answers[UNSUPERVISED_ACCESS_KEY] === true ? true
      : answers[UNSUPERVISED_ACCESS_KEY] === false ? false
      : null;
  const escortReason: string = answers[ESCORT_REASON_KEY] || "";

  const credentials = getSupplierCredentials(jurisdiction, activeTypes, records);
  const anyRequired = credentials.some((c) => c.blocking);
  const gate = evaluateContractorGate({
    jurisdiction,
    supplierName: selectedSupplier?.name ?? null,
    types: activeTypes,
    records,
    unsupervisedAccess: unsupervisedAnswer,
    escortReason,
  });

  const allRequiredAnswered = questions
    .filter((q) => q.required)
    .every((q) => {
      const val = answers[q.id];
      if (q.type === "yesno") return val === true || val === false;
      return val !== undefined && val !== "";
    });

  const failedChecks = questions.filter(
    (q) => q.type === "yesno" && answers[q.id] === false
  );

  // Report the gate upward only when it actually changes — the callback is
  // usually an inline arrow, so it must stay out of the dependency list.
  const lastReported = useRef<string>("");
  const onBlockedChangeRef = useRef(onBlockedChange);
  onBlockedChangeRef.current = onBlockedChange;
  useEffect(() => {
    const signature = `${gate.blocked}|${gate.reason ?? ""}`;
    if (signature === lastReported.current) return;
    lastReported.current = signature;
    onBlockedChangeRef.current?.(gate.blocked, gate.reason);
  }, [gate.blocked, gate.reason]);

  const saveCredential = async (typeId: string, field: "expiry_date" | "reference", value: string) => {
    if (!selectedSupplier) return;
    setSavingCredential(`${typeId}:${field}`);
    try {
      await save(typeId, { [field]: value || null } as any);
    } catch {
      toast({ title: "Could not save", description: "The credential details were not saved.", variant: "destructive" });
    } finally {
      setSavingCredential(null);
    }
  };

  const stateStyles: Record<string, string> = {
    valid: "border-success/30 bg-success/5",
    expiring: "border-warning/40 bg-warning/5",
    expired: "border-destructive/40 bg-destructive/5",
    missing: "border-destructive/40 bg-destructive/5",
  };
  const stateLabel: Record<string, string> = {
    valid: "Verified",
    expiring: "Expiring soon",
    expired: "Expired",
    missing: "Not recorded",
  };

  return (
    <div className="space-y-4">
      {/* Unsupervised resident access — asked first, it decides what the credentials mean */}
      <div
        className={`rounded-xl border-2 p-3 space-y-3 ${
          unsupervisedAnswer === true ? "border-warning/40 bg-warning/5"
            : unsupervisedAnswer === false ? "border-success/30 bg-success/5"
            : gate.needsAnswer ? "border-destructive/40 bg-destructive/5"
            : "border-border"
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <ShieldAlert className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <p className="text-[12px] text-foreground flex-1">
            Will they have unsupervised access to residents?
            {anyRequired && <span className="text-destructive ml-0.5">*</span>}
          </p>
          <div className="flex gap-1.5 shrink-0">
            <button
              onClick={() => setAnswer(UNSUPERVISED_ACCESS_KEY, true)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                unsupervisedAnswer === true ? "bg-warning text-warning-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-warning/20"
              }`}
            >
              Yes
            </button>
            <button
              onClick={() => setAnswer(UNSUPERVISED_ACCESS_KEY, false)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                unsupervisedAnswer === false ? "bg-success text-success-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-success/20"
              }`}
            >
              No
            </button>
          </div>
        </div>

        {unsupervisedAnswer === false && (
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">
              Escorted by / why there is no resident contact
              {gate.needsEscortReason && <span className="text-destructive ml-0.5">*</span>}
            </Label>
            <Textarea
              value={escortReason}
              onChange={(e) => setAnswer(ESCORT_REASON_KEY, e.target.value)}
              placeholder="e.g. Escorted by maintenance lead all visit — boiler room only"
              className="rounded-lg text-sm min-h-[60px]"
            />
          </div>
        )}
      </div>

      {/* Supplier autocomplete */}
      <div className="space-y-2">
        <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Supplier / Company
        </Label>
        {selectedSupplier ? (
          <div className="rounded-xl border border-success/30 bg-success/5 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-success/10 flex items-center justify-center">
                  <Building2 className="h-4 w-4 text-success" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{selectedSupplier.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {jurisdiction === "AU" && selectedSupplier.abn && `ABN: ${selectedSupplier.abn}`}
                    {jurisdiction === "UK" && selectedSupplier.company_number && `Co. No: ${selectedSupplier.company_number}`}
                    {selectedSupplier.contact_name && ` · ${selectedSupplier.contact_name}`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => { onSupplierChange(null); setShowSupplierList(true); }}
                className="text-[11px] text-primary hover:underline font-semibold"
              >
                Change
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={supplierSearch}
                onChange={(e) => { setSupplierSearch(e.target.value); setShowSupplierList(true); }}
                onFocus={() => setShowSupplierList(true)}
                placeholder="Search supplier name or ABN..."
                className="pl-10 h-10 rounded-xl text-sm"
              />
            </div>
            {showSupplierList && (
              <div className="max-h-[180px] overflow-y-auto rounded-xl border border-border bg-card shadow-sm">
                {filteredSuppliers.length === 0 ? (
                  <div className="p-3 text-center text-[12px] text-muted-foreground">
                    No suppliers found — type to continue as ad-hoc
                  </div>
                ) : (
                  filteredSuppliers.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => { onSupplierChange(s); setShowSupplierList(false); setSupplierSearch(""); }}
                      className="w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors border-b border-border last:border-0"
                    >
                      <div className="flex items-center gap-2.5">
                        <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium text-foreground truncate">{s.name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {jurisdiction === "AU" && s.abn && `ABN: ${s.abn}`}
                            {jurisdiction === "UK" && s.company_number && `Co: ${s.company_number}`}
                            {s.contact_name && ` · ${s.contact_name}`}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Credential verification — dynamic list configured in Settings */}
      {selectedSupplier && credentials.length > 0 && (
        <div className="space-y-2">
          <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <CalendarClock className="h-3.5 w-3.5" />
            Credential Verification
          </Label>
          {credentials.map((c) => (
            <div key={c.typeId} className={`rounded-xl border-2 p-3 space-y-2 ${stateStyles[c.state]}`}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-[12px] font-semibold text-foreground">
                  {c.label}
                  {c.blocking && <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wider text-destructive">Required</span>}
                </p>
                <Badge variant="outline" className="text-[10px] font-bold shrink-0">
                  {stateLabel[c.state]}
                  {c.state === "expiring" && c.daysToExpiry !== null && ` · ${c.daysToExpiry}d`}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Expiry date</Label>
                  <Input
                    type="date"
                    defaultValue={c.expiry || ""}
                    onBlur={(e) => e.target.value !== (c.expiry || "") && saveCredential(c.typeId, "expiry_date", e.target.value)}
                    className="rounded-lg h-9 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Document reference</Label>
                  <Input
                    defaultValue={c.reference || ""}
                    placeholder="Certificate / clearance no."
                    onBlur={(e) => e.target.value !== (c.reference || "") && saveCredential(c.typeId, "reference", e.target.value)}
                    className="rounded-lg h-9 text-sm"
                  />
                </div>
              </div>
              {savingCredential?.startsWith(c.typeId) ? (
                <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Saving…</p>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {gate.reason && (
        <div className={`rounded-xl border-2 p-3 flex items-start gap-2 ${gate.blocked ? "border-destructive/40 bg-destructive/5" : "border-amber-500/40 bg-amber-500/5"}`}>
          <ShieldAlert className={`h-4 w-4 shrink-0 mt-0.5 ${gate.blocked ? "text-destructive" : "text-amber-600"}`} />
          <div>
            <p className={`text-[12px] font-bold ${gate.blocked ? "text-destructive" : "text-amber-700"}`}>
              {gate.blocked ? (gate.needsAnswer ? "Answer required" : "Check-in blocked") : "Credential warning — staff review"}
            </p>
            <p className={`text-[11px] ${gate.blocked ? "text-destructive/80" : "text-amber-700/80"}`}>{gate.reason}</p>
          </div>
        </div>
      )}

      {/* Jurisdiction badge */}
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-[10px] font-bold">
          {jurisdiction === "AU" ? "🇦🇺 Australia" : "🇬🇧 United Kingdom"}
        </Badge>
        <span className="text-[11px] text-muted-foreground">
          {jurisdiction === "AU" ? "SWMS / WHS screening" : "RAMS / H&S screening"}
        </span>
      </div>

      {/* Screening questions — compact staff view */}
      <div className="space-y-2">
        <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5" />
          Contractor Screening
        </Label>

        {failedChecks.length > 0 && (
          <div className="rounded-xl border border-warning/40 bg-warning/5 p-3 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-[12px] font-semibold text-destructive">Staff review required (not blocking)</p>
              <p className="text-[11px] text-destructive/80">
                {failedChecks.map((q) => q.label.split("?")[0]).join("; ")}
              </p>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {questions.map((q) => {
            const answer = answers[q.id];
            const Icon = (q as { icon?: React.ComponentType<{ className?: string }> }).icon;

            if (q.type === "yesno") {
              const isYes = answer === true;
              const isNo = answer === false;
              return (
                <div
                  key={q.id}
                  className={`rounded-xl border-2 p-3 transition-all ${
                    isYes ? "border-success/30 bg-success/5"
                      : isNo ? "border-destructive/30 bg-destructive/5"
                      : "border-border"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {Icon && (
                      <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${
                        isYes ? "bg-success/10 text-success"
                          : isNo ? "bg-destructive/10 text-destructive"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                    )}
                    <p className="text-[12px] text-foreground flex-1">
                      {q.label}
                      {q.required && <span className="text-destructive ml-0.5">*</span>}
                    </p>
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        onClick={() => setAnswer(q.id, true)}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                          isYes ? "bg-success text-success-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-success/20"
                        }`}
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setAnswer(q.id, false)}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                          isNo ? "bg-destructive text-destructive-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-destructive/20"
                        }`}
                      >
                        No
                      </button>
                    </div>
                  </div>
                </div>
              );
            }

            if (q.type === "text") {
              return (
                <div key={q.id} className="space-y-1">
                  <Label className="text-[11px]">
                    {q.label}
                    {q.required && <span className="text-destructive ml-0.5">*</span>}
                  </Label>
                  <Input
                    value={answer || ""}
                    onChange={(e) => setAnswer(q.id, e.target.value)}
                    placeholder={q.placeholder || ""}
                    className="rounded-lg h-9 text-sm"
                  />
                </div>
              );
            }

            return null;
          })}
        </div>
      </div>

      {/* Completion indicator */}
      {allRequiredAnswered && failedChecks.length === 0 && !gate.reason && (
        <div className="rounded-xl border border-success/30 bg-success/5 p-3 flex items-center gap-2">
          <Check className="h-4 w-4 text-success" />
          <p className="text-[12px] font-semibold text-success">All screening checks passed</p>
        </div>
      )}
    </div>
  );
}
