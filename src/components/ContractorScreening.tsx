import { useState, useMemo, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSuppliers, Supplier } from "@/hooks/useSuppliers";
import { Search, Check, Building2, AlertTriangle, ShieldAlert, CalendarClock, ClipboardCheck } from "lucide-react";
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
import { useContractorQuestions, type ContractorQuestion } from "@/hooks/useContractorQuestions";

/** The one question that decides how hard a missing credential bites */
const UNSUPERVISED_QUESTION_KEY = "unsupervised_access";

interface ContractorScreeningProps {
  jurisdiction: "AU" | "UK";
  answers: Record<string, any>;
  onAnswersChange: (answers: Record<string, any>) => void;
  selectedSupplier: Supplier | null;
  onSupplierChange: (supplier: Supplier | null) => void;
  compact?: boolean;
  /** Reports whether credential status currently holds up check-in */
  onBlockedChange?: (blocked: boolean, reason: string | null) => void;
  /** The individual tradesperson — personal checks are looked up against them */
  workerFirstName?: string;
  workerSurname?: string;
  workerMobile?: string;
  /** Unattended kiosk: self-uploads only, no staff confirmation */
  kiosk?: boolean;
  /** Reports the matched contractor person record so check-in can store it */
  onPersonChange?: (personId: string | null) => void;
}

export function ContractorScreening({
  jurisdiction,
  answers,
  onAnswersChange,
  selectedSupplier,
  onSupplierChange,
  compact = true,
  onBlockedChange,
  workerFirstName = "",
  workerSurname = "",
  workerMobile = "",
  kiosk = false,
  onPersonChange,
}: ContractorScreeningProps) {
  const { suppliers } = useSuppliers();
  const { toast } = useToast();
  const [supplierSearch, setSupplierSearch] = useState("");
  const [showSupplierList, setShowSupplierList] = useState(false);
  const [changingSupplier, setChangingSupplier] = useState(false);
  const [person, setPerson] = useState<ContractorPerson | null>(null);
  const [recognisedSupplier, setRecognisedSupplier] = useState(false);

  const { activeTypes } = useCredentialTypes();
  const { records, save } = useSupplierCredentials(selectedSupplier?.id);
  const entryPolicy = useContractorEntryPolicy();
  const { records: personRecords, save: savePersonCredential, verify } = usePersonCredentials(person?.id);

  const nameKey = `${workerFirstName.trim().toLowerCase()}|${workerSurname.trim().toLowerCase()}|${workerMobile.replace(/\D/g, "")}`;

  // Find (or create) the individual worker so their own police check / DBS can
  // be shown. Company details stay on the supplier record.
  useEffect(() => {
    let cancelled = false;
    const first = workerFirstName.trim();
    const last = workerSurname.trim();
    if (!first || !last) {
      setPerson(null);
      onPersonChange?.(null);
      return;
    }
    (async () => {
      const found = await findContractorPerson({ firstName: first, surname: last, mobile: workerMobile });
      if (cancelled) return;
      if (found) {
        setPerson(found);
        onPersonChange?.(found.id);
        return;
      }
      const created = await upsertContractorPerson({
        firstName: first,
        surname: last,
        mobile: workerMobile || null,
        supplierId: selectedSupplier?.id || null,
      });
      if (cancelled) return;
      setPerson(created);
      onPersonChange?.(created?.id ?? null);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nameKey, selectedSupplier?.id]);

  // We already know who they work for — fill it in instead of asking again.
  useEffect(() => {
    if (selectedSupplier || changingSupplier) return;
    const known = person?.supplier_id ? suppliers.find((s) => s.id === person.supplier_id) : null;
    if (known) {
      setRecognisedSupplier(true);
      onSupplierChange(known);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [person?.supplier_id, suppliers, selectedSupplier, changingSupplier]);

  const {
    onFile,
    outstanding,
    visitQuestions,
    answerFor,
    saveAnswer,
  } = useContractorQuestions({ jurisdiction, supplierId: selectedSupplier?.id ?? null, personId: person?.id ?? null });

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

  const answerKeyOf = (q: ContractorQuestion) =>
    q.key === UNSUPERVISED_QUESTION_KEY ? UNSUPERVISED_ACCESS_KEY : q.key;

  const handleAnswer = (q: ContractorQuestion, value: any) => {
    setAnswer(answerKeyOf(q), value);
    if (q.owner_scope !== "visit") {
      void saveAnswer(q, value, kiosk ? "Kiosk" : "Staff");
    }
  };

  // Staff-only questions never appear on an unattended kiosk.
  const visible = (q: ContractorQuestion) => !kiosk || q.answered_by !== "staff";
  const askNow = [...outstanding, ...visitQuestions].filter(visible);
  const staffPending = [...outstanding, ...visitQuestions].filter((q) => kiosk && q.answered_by === "staff" && q.required);

  const unsupervisedAnswer: boolean | null =
    answers[UNSUPERVISED_ACCESS_KEY] === true ? true
      : answers[UNSUPERVISED_ACCESS_KEY] === false ? false
      : null;
  const escortReason: string = answers[ESCORT_REASON_KEY] || "";

  const credentials = buildComplianceChecklist({
    jurisdiction,
    types: activeTypes,
    supplierRecords: records,
    personRecords,
  });
  const gate = evaluateContractorGate({
    jurisdiction,
    supplierName: selectedSupplier?.name ?? null,
    types: activeTypes,
    checklist: credentials,
    // On the kiosk the resident-access question is a reception task — entry is
    // flagged rather than stopped, and staff finish it at the desk.
    unsupervisedAccess: kiosk ? false : unsupervisedAnswer,
    escortReason: kiosk ? "Reception to confirm resident access" : escortReason,
    entryPolicy,
    personIdentified: !!person,
  });
  const allClear = credentials.length > 0 && credentials.every((c) => c.state === "valid" || c.state === "expiring");
  const actionNeeded = credentials.filter((c) => c.state !== "valid" && c.state !== "expiring");

  const unanswered = askNow.filter((q) => {
    if (!q.required) return false;
    const v = answers[answerKeyOf(q)];
    if (q.input_type === "yesno") return v !== true && v !== false;
    return v === undefined || v === "";
  });
  const failedChecks = askNow.filter(
    (q) => q.input_type === "yesno" && answers[answerKeyOf(q)] === false
  );
  const blockingNo = failedChecks.filter((q) => q.blocks_on_no);

  const questionReason =
    unanswered.length > 0
      ? "Please answer the remaining screening questions."
      : blockingNo.length > 0
      ? `${blockingNo.map((q) => q.label.replace(/\?$/, "")).join("; ")} — please see a staff member.`
      : null;

  const blocked = gate.blocked || questionReason !== null;
  const reason = gate.blocked ? gate.reason : questionReason ?? gate.reason;

  // Report the gate upward only when it actually changes — the callback is
  // usually an inline arrow, so it must stay out of the dependency list.
  const lastReported = useRef<string>("");
  const onBlockedChangeRef = useRef(onBlockedChange);
  onBlockedChangeRef.current = onBlockedChange;
  useEffect(() => {
    const signature = `${blocked}|${reason ?? ""}`;
    if (signature === lastReported.current) return;
    lastReported.current = signature;
    onBlockedChangeRef.current?.(blocked, reason);
  }, [blocked, reason]);

  const verifyCredential = async (typeId: string, expiry?: string | null) => {
    try {
      await verify(typeId, "Staff", expiry ?? undefined);
    } catch {
      toast({ title: "Could not confirm", variant: "destructive" });
    }
  };

  const yesNo = (q: ContractorQuestion) => {
    const value = answers[answerKeyOf(q)];
    const isYes = value === true;
    const isNo = value === false;
    return (
      <div
        key={q.id}
        className={`rounded-xl border-2 p-3 transition-all ${
          isYes ? "border-success/30 bg-success/5"
            : isNo ? "border-destructive/30 bg-destructive/5"
            : "border-border"
        }`}
      >
        <div className={kiosk ? "space-y-3" : "flex items-center gap-3"}>
          <p className={`text-foreground flex-1 ${kiosk ? "text-base font-medium" : "text-[12px]"}`}>
            {q.label}
            {q.required && <span className="text-destructive ml-0.5">*</span>}
          </p>
          <div className={`flex gap-2 shrink-0 ${kiosk ? "" : "gap-1.5"}`}>
            <button
              onClick={() => handleAnswer(q, true)}
              className={`rounded-lg font-bold transition-all ${kiosk ? "flex-1 h-14 text-base" : "px-3 py-1.5 text-[11px]"} ${
                isYes ? "bg-success text-success-foreground shadow-sm" : "bg-muted text-muted-foreground"
              }`}
            >
              Yes
            </button>
            <button
              onClick={() => handleAnswer(q, false)}
              className={`rounded-lg font-bold transition-all ${kiosk ? "flex-1 h-14 text-base" : "px-3 py-1.5 text-[11px]"} ${
                isNo ? "bg-destructive text-destructive-foreground shadow-sm" : "bg-muted text-muted-foreground"
              }`}
            >
              No
            </button>
          </div>
        </div>

        {q.key === UNSUPERVISED_QUESTION_KEY && isNo && !kiosk && (
          <div className="space-y-1 mt-3">
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
    );
  };

  return (
    <div className="space-y-4">
      {/* Company — recognised from the worker's record wherever possible */}
      <div className="space-y-2">
        <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Company
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
                    {recognisedSupplier ? "From your last visit" : "Selected"}
                    {jurisdiction === "AU" && selectedSupplier.abn && ` · ABN: ${selectedSupplier.abn}`}
                    {jurisdiction === "UK" && selectedSupplier.company_number && ` · Co. No: ${selectedSupplier.company_number}`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setChangingSupplier(true);
                  setRecognisedSupplier(false);
                  onSupplierChange(null);
                  setShowSupplierList(true);
                }}
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
                placeholder="Search company name..."
                className={`pl-10 rounded-xl ${kiosk ? "h-14 text-base" : "h-10 text-sm"}`}
              />
            </div>
            {showSupplierList && (
              <div className="max-h-[180px] overflow-y-auto rounded-xl border border-border bg-card shadow-sm">
                {filteredSuppliers.length === 0 ? (
                  <div className="p-3 text-center text-[12px] text-muted-foreground">
                    No companies found — continue as a one-off visit
                  </div>
                ) : (
                  filteredSuppliers.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        onSupplierChange(s);
                        setShowSupplierList(false);
                        setSupplierSearch("");
                        setRecognisedSupplier(false);
                      }}
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

      {/* Already on file — shown, never re-asked */}
      {(allClear || onFile.length > 0) && (
        <div className="rounded-xl border border-success/30 bg-success/5 p-3 space-y-1">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-success shrink-0" />
            <p className="text-[13px] font-semibold text-success">Already on file</p>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {[
              ...credentials
                .filter((c) => c.state === "valid" || c.state === "expiring")
                .map((c) => `${c.shortLabel}${c.expiry ? ` to ${c.expiry}` : ""}`),
              ...onFile.map((q) => {
                const a = answerFor(q);
                const v = a?.answer;
                return `${q.label.replace(/\?$/, "")}${v === true ? ": Yes" : v === false ? ": No" : typeof v === "string" && v ? `: ${v}` : ""}`;
              }),
            ].join(" · ")}
          </p>
        </div>
      )}

      {/* Anything missing or out of date */}
      {actionNeeded.length > 0 && (
        <div className="space-y-2">
          <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <CalendarClock className="h-3.5 w-3.5" />
            Needs attention
          </Label>
          <p className="text-[11px] text-muted-foreground">
            {kiosk
              ? "Please attach the item below so a staff member can confirm it."
              : "Attach the document and confirm it once you have seen the original."}
          </p>
          <ComplianceChecklist
            checklist={credentials}
            personId={person?.id ?? null}
            kiosk={kiosk}
            large={!compact}
            onSavePerson={async (typeId, fields) => { await savePersonCredential(typeId, fields as any); }}
            onSaveCompany={async (typeId, fields) => { await save(typeId, fields); }}
            onVerify={kiosk ? undefined : verifyCredential}
          />
        </div>
      )}

      {/* Questions still to answer today */}
      {askNow.length > 0 && (
        <div className="space-y-2">
          <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <ClipboardCheck className="h-3.5 w-3.5" />
            {askNow.length === 1 ? "One quick check" : `${askNow.length} quick checks`}
          </Label>
          <div className="space-y-2">
            {askNow.map((q) =>
              q.input_type === "yesno" ? (
                yesNo(q)
              ) : (
                <div key={q.id} className="space-y-1">
                  <Label className={kiosk ? "text-sm" : "text-[11px]"}>
                    {q.label}
                    {q.required && <span className="text-destructive ml-0.5">*</span>}
                  </Label>
                  <Input
                    value={answers[answerKeyOf(q)] || ""}
                    onChange={(e) => setAnswer(answerKeyOf(q), e.target.value)}
                    onBlur={(e) => {
                      if (q.owner_scope !== "visit") void saveAnswer(q, e.target.value, kiosk ? "Kiosk" : "Staff");
                    }}
                    className={`rounded-lg ${kiosk ? "h-14 text-base" : "h-9 text-sm"}`}
                  />
                </div>
              )
            )}
          </div>
        </div>
      )}

      {failedChecks.length > 0 && blockingNo.length === 0 && (
        <div className="rounded-xl border border-warning/40 bg-warning/5 p-3 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
          <p className="text-[11px] text-foreground">
            A staff member will review: {failedChecks.map((q) => q.label.replace(/\?$/, "")).join("; ")}
          </p>
        </div>
      )}

      {staffPending.length > 0 && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 flex items-start gap-2">
          <ShieldAlert className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <p className="text-[11px] text-foreground">
            Reception will finish {staffPending.length === 1 ? "one item" : `${staffPending.length} items`} with you when you arrive at the desk.
          </p>
        </div>
      )}

      {reason && (
        <div className={`rounded-xl border-2 p-3 flex items-start gap-2 ${blocked ? "border-destructive/40 bg-destructive/5" : "border-amber-500/40 bg-amber-500/5"}`}>
          <ShieldAlert className={`h-4 w-4 shrink-0 mt-0.5 ${blocked ? "text-destructive" : "text-amber-600"}`} />
          <div>
            <p className={`text-[12px] font-bold ${blocked ? "text-destructive" : "text-amber-700"}`}>
              {blocked ? "Please see a staff member" : "Staff review"}
            </p>
            <p className={`text-[11px] ${blocked ? "text-destructive/80" : "text-amber-700/80"}`}>{reason}</p>
          </div>
        </div>
      )}

      {!blocked && !reason && askNow.length === 0 && (
        <div className="rounded-xl border border-success/30 bg-success/5 p-3 flex items-center gap-2">
          <Check className="h-4 w-4 text-success" />
          <p className="text-[12px] font-semibold text-success">Nothing else needed — good to continue</p>
        </div>
      )}
    </div>
  );
}
