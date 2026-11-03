import { useState, useRef } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Check, CheckCircle2, KeyRound, ShieldAlert, ShieldCheck, UtensilsCrossed, Printer } from "lucide-react";
import { Destination } from "./Destination";
import { AdditionalPeople } from "./AdditionalPeople";
import { CHECK_IN_SECTIONS, issuesBySection, type CheckInSectionId } from "@/lib/checkInSections";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { Visitor } from "@/types/visitor";
import { ReviewAction } from "./ReviewAction";
import { VisitPurpose } from "./VisitPurpose";
import { type StaffCheckInPrefill, useCheckInFlow } from "./useCheckInFlow";
import { StepIdentify } from "./StepIdentify";
import { StepDetails } from "./StepDetails";
import { StepScreening } from "./StepScreening";
import { StepConfirm } from "./StepConfirm";
import { FoodFormFields } from "@/components/food/FoodFormFields";
import { insertFoodRecord } from "@/lib/foodRegister";
import { type BadgeData } from "@/lib/printBadge";
import { issueBadge } from "@/lib/badgeIssue";
import { useSite } from "@/contexts/SiteContext";
import { Label } from "@/components/ui/label";

interface CheckInSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Resolves only once the check-in is safely stored. */
  onAdd: (visitor: Omit<Visitor, "id">) => Promise<Visitor>;
  initialType?: Visitor["type"];
  prefill?: StaffCheckInPrefill;

}

export function CheckInSheet({ open, onOpenChange, onAdd, initialType, prefill }: CheckInSheetProps) {
  const flow = useCheckInFlow(open, initialType, prefill);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successName, setSuccessName] = useState("");
  const [successBadge, setSuccessBadge] = useState<BadgeData | null>(null);
  const [createdVisitorId, setCreatedVisitorId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [approving, setApproving] = useState(false);
  const [overrideError, setOverrideError] = useState<string | null>(null);
  // A ref, not state, so a fast second tap cannot slip through before a re-render.
  const submittingRef = useRef(false);
  const attemptedPayloadRef = useRef<Omit<Visitor, "id"> | null>(null);
  const { currentSite, currentSiteId } = useSite();

  const handleClose = () => {
    if (submittingRef.current) return;
    flow.resetForm();
    attemptedPayloadRef.current = null;
    setShowSuccess(false);
    setSaveFailed(false);
    setOverrideError(null);
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    if (submittingRef.current || !flow.canSubmit) return;
    submittingRef.current = true;
    setSaving(true);
    setSaveFailed(false);

    let visitor: Omit<Visitor, "id">;
    let created: Visitor;
    try {
      visitor = attemptedPayloadRef.current || flow.buildVisitor();
      attemptedPayloadRef.current = visitor;
      // Wait for the server before saying anyone is checked in.
      created = await onAdd(visitor);
    } catch {
      submittingRef.current = false;
      setSaving(false);
      setSaveFailed(true);
      return; // The form stays exactly as it is so the desk can try again.
    }
    submittingRef.current = false;
    setSaving(false);
    setCreatedVisitorId(created?.id ?? null);

    const fullName = `${flow.formData.firstName} ${flow.formData.surname}`.trim();

    // Food register entry (linked to the resident's real record id)
    if (flow.bringingFood && flow.selectedResident) {
      const resident = flow.selectedResident;
      supabase.auth.getUser().then(({ data }) => {
        insertFoodRecord({
          residentVisitorId: resident.id,
          residentName: resident.name,
          visitorId: created?.id ?? null,
          broughtByName: fullName,
          foodDescription: flow.foodForm.foodDescription.trim(),
          foodType: flow.foodForm.foodType,
          sharedWithOthers: flow.foodForm.sharedWithOthers,
          sharedResidentIds: flow.foodForm.sharedResidentIds,
          sharedResidentNames: flow.foodForm.sharedResidentIds
            .map((id) => flow.residentItems.find((r) => r.id === id)?.name)
            .filter(Boolean) as string[],
          notes: flow.foodForm.notes.trim() || null,
          source: "check_in",
          branchId: currentSiteId,
          createdBy: data.user?.email || "Staff",
        }).then(() => undefined);
      });
    }

    // Follow-up audit remains separate from arrival persistence; delivery is
    // not guaranteed by this browser request (see staff check-in review).
    if (flow.screeningFlagged && !flow.screeningBlocked && flow.overrideReason.trim()) {
      const name = `${flow.formData.firstName} ${flow.formData.surname}`.trim();
      supabase.rpc("log_audit", {
        _action: "screening.flag_accepted",
        _details: {
          visitor_name: name,
          visitor_type: flow.selectedType,
          outcome: flow.screeningEvaluation.outcome,
          flags: flow.screeningEvaluation.flags.map((f) => ({ question_id: f.questionId, severity: f.severity })),
        } as any,
        _records: 1,
        _reason: flow.overrideReason.trim(),
      }).then(() => undefined);
    }

    if (flow.keyPolicy.enforcement === "block" && flow.overdueKeys.length > 0 && flow.keyOverrideReason.trim()) {
      void supabase.rpc("log_audit", { _action: "key_overdue_override", _records: 1,
        _reason: flow.keyOverrideReason.trim(), _details: { visitor: fullName, visitor_type: flow.selectedType, outstanding_items: flow.overdueKeys.map(item => item.keyLabel) } as any });
    }
    setSuccessName(fullName);
    setSuccessBadge({
      name: fullName,
      type: flow.selectedType,
      visiting: flow.formData.selectPerson || undefined,
      mobile: flow.formData.mobile || undefined,
      room: [flow.selectedResident?.room, flow.selectedResident?.wing].filter(Boolean).join(" · ") || undefined,
      qrValue: created?.personQr || visitor.personQr || undefined,
      date: visitor.checkInTime,
    });

    setShowSuccess(true);
    if (!flow.badgePrintingEnabled) {
      setTimeout(() => {
        attemptedPayloadRef.current = null;
        flow.resetForm();
        setShowSuccess(false);
        onOpenChange(false);
      }, 2500);
    }
  };

  const bySection = issuesBySection(flow.validationIssues);
  const showChecks = flow.steps.includes("screening") || flow.screeningFlagged || (flow.overdueKeys.length > 0 && flow.keyPolicy.enforcement !== "off");
  const sections = CHECK_IN_SECTIONS.filter((x) => x.id !== "checks" || showChecks);
  const goTo = (id: CheckInSectionId) => {
    document.getElementById(`checkin-section-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const nextIssue = sections.find((x) => bySection[x.id].length > 0)?.id ?? null;
  const visiting = flow.formData.selectPerson || "";
  const fullName = `${flow.formData.firstName} ${flow.formData.surname}`.trim();
  const typeLabel = { visitor: "Visitor", contractor: "Contractor", volunteer: "Volunteer", staff: "Staff", other: "Other" }[flow.selectedType] ?? flow.selectedType;

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent
        side="right"
        className="inset-y-0 right-0 flex h-dvh w-full max-w-full flex-col gap-0 overflow-hidden border-border bg-card p-0 sm:inset-y-auto sm:left-1/2 sm:right-auto sm:top-1/2 sm:h-[min(920px,94dvh)] sm:w-[calc(100%-32px)] sm:max-w-3xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl lg:max-w-[1040px] [&_[role=combobox]]:text-base [&_input]:text-base [&_textarea]:text-base"
      >
        {/* Header */}
        <SheetHeader className="shrink-0 space-y-0 border-b border-border bg-card px-5 py-4 pr-16 text-left sm:px-6">
          <p className="text-[11px] font-extrabold uppercase leading-4 tracking-[0.06em] text-primary">{currentSite?.name || "Current site"}</p>
          <SheetTitle className="mt-0.5 text-2xl font-extrabold leading-8">Check in</SheetTitle>
          <SheetDescription className="sr-only">Record an arrival at {currentSite?.name || "this site"}.</SheetDescription>
        </SheetHeader>

        {showSuccess ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 overflow-y-auto px-6 py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success-subtle">
              <CheckCircle2 aria-hidden className="h-8 w-8 text-success-strong" />
            </div>
            <div className="space-y-1" role="status">
              <p className="text-xl font-extrabold text-foreground">{successName} checked in!</p>
              <p className="text-sm text-muted-foreground">
                {flow.badgePrintingEnabled ? "Print their badge, or close to carry on." : "This window closes on its own."}
              </p>
            </div>
            {flow.badgePrintingEnabled && successBadge && (
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="outline" className="gap-2" onClick={() => issueBadge(successBadge, { visitorId: createdVisitorId, siteId: currentSiteId, siteName: currentSite?.name })}>
                  <Printer aria-hidden className="h-4 w-4" /> Print badge
                </Button>
                <Button onClick={handleClose}>Done</Button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex min-h-0 flex-1">
            {/* Section rail (wide screens): where you are, what is left, and a live summary */}
            <aside aria-label="Check-in sections" className="hidden w-64 shrink-0 flex-col gap-5 overflow-y-auto border-r border-border bg-secondary/60 p-4 lg:flex">
              <nav>
                <ol className="space-y-1">
                  {sections.map((x, i) => {
                    const left = bySection[x.id].length;
                    const done = left === 0;
                    return (
                      <li key={x.id}>
                        <button type="button" onClick={() => goTo(x.id)}
                          className="flex min-h-11 w-full items-center gap-3 rounded-lg px-2.5 text-left transition-colors hover:bg-card">
                          <span aria-hidden className={cn(
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold",
                            done ? "bg-success-subtle text-success-strong" : "border-2 border-input bg-card text-muted-foreground",
                          )}>
                            {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
                          </span>
                          <span className="min-w-0">
                            <span className="block text-sm font-bold text-foreground">{x.title}</span>
                            <span className={cn("block text-xs", done ? "text-success-strong" : "text-muted-foreground")}>
                              {done ? "Done" : `${left} to do`}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </nav>
              <div className="rounded-xl border border-border bg-card p-3.5">
                <p className="text-xs font-bold text-muted-foreground">Summary</p>
                <p className="mt-1 truncate text-base font-extrabold text-foreground">{fullName || "New arrival"}</p>
                <dl className="mt-2 space-y-1 text-[13px]">
                  <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Type</dt><dd className="font-semibold">{typeLabel}</dd></div>
                  <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Visiting</dt><dd className="truncate font-semibold">{visiting || "—"}</dd></div>
                  {flow.companions.length > 0 && <div className="flex justify-between gap-2"><dt className="text-muted-foreground">With</dt><dd className="font-semibold">{flow.companions.length} more</dd></div>}
                  {flow.isReturning && <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Record</dt><dd className="font-semibold text-primary">Returning</dd></div>}
                </dl>
              </div>
            </aside>

            <div className="min-h-0 flex-1 overflow-y-auto bg-secondary/60">
              {/* Section progress (phones and tablets) */}
              <nav aria-label="Check-in sections" className="sticky top-0 z-10 flex gap-1.5 overflow-x-auto border-b border-border bg-card/95 px-4 py-2 backdrop-blur lg:hidden">
                {sections.map((x, i) => {
                  const done = bySection[x.id].length === 0;
                  return (
                    <button key={x.id} type="button" onClick={() => goTo(x.id)}
                      className={cn("flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-bold",
                        done ? "border-transparent bg-success-subtle text-success-strong" : "border-input bg-card text-foreground")}>
                      {done ? <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={3} /> : <span aria-hidden>{i + 1}</span>}
                      {x.short}
                    </button>
                  );
                })}
              </nav>

              <fieldset disabled={saving || saveFailed} className="min-w-0 space-y-4 p-4 sm:p-6">
                <FormSection id="who" n={sections.findIndex((x) => x.id === "who") + 1} title="Who is arriving" left={bySection.who.length}>
                  <StepIdentify
                    selectedType={flow.selectedType}
                    onTypeChange={flow.setSelectedType}
                    searchQuery={flow.searchQuery}
                    onSearchChange={flow.setSearchQuery}
                    searchResults={flow.searchResults}
                    selectedProfile={flow.selectedProfile}
                    onSelectProfile={(profile) => {
                      flow.selectProfile(profile);
                      document.getElementById("staff-detail-core-first-name")?.focus();
                    }}
                    onNewPerson={() => document.getElementById("staff-detail-core-first-name")?.focus()}
                  />
                  <StepDetails
                    formData={flow.formData}
                    updateField={flow.updateField}
                    selectedProfile={flow.selectedProfile}
                    isReturning={flow.isReturning}
                    selectedType={flow.selectedType}
                    activeFields={flow.activeFields}
                    photo={flow.photo}
                    setPhoto={flow.setPhoto}
                    onChangeProfile={() => { flow.setSelectedProfile(null); flow.setIsReturning(false); flow.setSearchQuery(""); }}
                  />
                </FormSection>

                <FormSection id="visit" n={sections.findIndex((x) => x.id === "visit") + 1} title="Their visit" left={bySection.visit.length}>
                  <Destination formData={flow.formData} updateField={flow.updateField} residentItems={flow.residentItems} staffItems={flow.staffItems} activeFields={flow.activeFields} />
                  <VisitPurpose flow={flow} />
                  <AdditionalPeople companions={flow.companions} setCompanions={flow.setCompanions} activeCompanionFields={flow.activeCompanionFields} />
                  {flow.foodStepApplies && (
                    <div className="space-y-3 border-t border-border pt-4">
                      <div>
                        <h4 className="flex items-center gap-2 text-sm font-bold text-foreground">
                          <UtensilsCrossed aria-hidden className="h-4 w-4 text-muted-foreground" /> Food brought in
                        </h4>
                        <p className="text-[13px] text-muted-foreground">For {flow.selectedResident?.name}. Recorded in the food register.</p>
                      </div>
                      <div role="group" aria-label="Are they bringing food into the home?" className="grid grid-cols-2 gap-2 sm:max-w-xs">
                        {[true, false].map((val) => (
                          <button key={String(val)} type="button" aria-pressed={flow.bringingFood === val} onClick={() => flow.setBringingFood(val)}
                            className={cn("min-h-11 rounded-lg border text-sm font-bold transition-colors",
                              flow.bringingFood === val ? "border-primary bg-accent text-accent-foreground" : "border-input bg-card text-foreground hover:border-primary/60")}>
                            {val ? "Bringing food" : "No food"}
                          </button>
                        ))}
                      </div>
                      {flow.bringingFood && (
                        <FoodFormFields state={flow.foodForm} onChange={flow.setFoodForm} residents={flow.residentItems} primaryResidentId={flow.selectedResident?.id || null} />
                      )}
                    </div>
                  )}
                </FormSection>

                {showChecks && (
                  <FormSection id="checks" n={sections.findIndex((x) => x.id === "checks") + 1} title="Checks and questions" left={bySection.checks.length}>
                    {flow.steps.includes("screening") && (
                      <StepScreening
                        selectedType={flow.selectedType}
                        healthQuestions={flow.healthQuestions}
                        healthAnswers={flow.healthAnswers}
                        setHealthAnswers={flow.setHealthAnswers}
                        bodyTemperature={flow.formData.bodyTemperature}
                        onTemperatureChange={(val) => flow.updateField("bodyTemperature", val)}
                        dbVaccFields={flow.dbVaccFields}
                        evaluation={flow.screeningEvaluation}
                        jurisdiction={flow.jurisdiction}
                        contractorScreeningAnswers={flow.contractorScreeningAnswers}
                        setContractorScreeningAnswers={flow.setContractorScreeningAnswers}
                        selectedSupplier={flow.selectedSupplier}
                        setSelectedSupplier={flow.setSelectedSupplier}
                        workerFirstName={flow.formData.firstName}
                        workerSurname={flow.formData.surname}
                        workerMobile={flow.formData.mobile}
                        onBlockedChange={(blocked, reason) => flow.setContractorGate({ blocked, reason })}
                      />
                    )}
                    {flow.overdueKeys.length > 0 && flow.keyPolicy.enforcement !== "off" && (
                      <div className="space-y-2 rounded-xl border border-[hsl(var(--warning)/0.45)] bg-warning-subtle/60 p-4">
                        <h4 className="flex items-center gap-2 text-sm font-bold text-warning-strong"><KeyRound aria-hidden className="h-4 w-4" />Keys not returned</h4>
                        <ul className="list-disc pl-5 text-sm">{flow.overdueKeys.map((item) => <li key={item.id}>{item.keyLabel}</li>)}</ul>
                        {flow.keyPolicy.enforcement === "block" && <>
                          <Label htmlFor="staff-key-reason">Reason for allowing check-in (at least 3 characters)</Label>
                          <Textarea id="staff-key-reason" value={flow.keyOverrideReason} onChange={(e) => flow.setKeyOverrideReason(e.target.value)} />
                        </>}
                      </div>
                    )}
                    {flow.screeningFlagged && (
                      <div className={cn("space-y-3 rounded-xl border p-4",
                        flow.screeningBlocked ? "border-destructive/40 bg-error-subtle/60" : "border-[hsl(var(--warning)/0.45)] bg-warning-subtle/60")}>
                        <div className="flex items-start gap-2">
                          <ShieldAlert aria-hidden="true" className={cn("mt-0.5 h-4 w-4 shrink-0", flow.screeningBlocked ? "text-destructive-strong" : "text-warning-strong")} />
                          <div className="space-y-1">
                            <p className={cn("text-sm font-bold", flow.screeningBlocked ? "text-destructive-strong" : "text-warning-strong")}>
                              {flow.screeningBlocked ? "Check-in blocked by the answers" : "The answers need staff attention"}
                            </p>
                            <ul className="space-y-0.5 text-[13px] text-foreground">
                              {flow.screeningEvaluation.flags.map((f) => (
                                <li key={`${f.questionId}-${f.severity}`}>{f.message}{f.action === "block" ? " — blocks check-in" : ""}</li>
                              ))}
                            </ul>
                            <p className="text-[13px] text-muted-foreground">
                              {flow.overrideApprovedBy
                                ? `Approved by ${flow.overrideApprovedBy} and recorded in the audit trail.`
                                : flow.screeningBlocked
                                  ? "A supervisor with the right permission must approve this, with a reason of at least 10 characters."
                                  : "Give a staff reason of at least 10 characters to continue."}
                            </p>
                          </div>
                        </div>
                        {!flow.overrideApprovedBy && (
                          <>
                            <Textarea value={flow.overrideReason} onChange={(e) => flow.setOverrideReason(e.target.value)}
                              placeholder="Reason for allowing this check-in (at least 10 characters)" aria-label="Reason for allowing this check-in" className="min-h-[72px]" />
                            {overrideError && <p className="text-[13px] text-destructive-strong" role="alert">{overrideError}</p>}
                            {flow.screeningBlocked && (
                              <Button variant="outline" className="gap-2" disabled={!flow.overrideValid || approving}
                                onClick={async () => {
                                  setApproving(true);
                                  const err = await flow.approveBlockedScreening();
                                  setApproving(false);
                                  setOverrideError(err);
                                }}>
                                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                                {approving ? "Recording approval…" : "Supervisor approve"}
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </FormSection>
                )}

                <FormSection id="agree" n={sections.findIndex((x) => x.id === "agree") + 1} title="Agree and check in" left={bySection.agree.length}>
                  <StepConfirm
                    formData={flow.formData}
                    selectedType={flow.selectedType}
                    photo={flow.photo}
                    healthAnswers={flow.healthAnswers}
                    companions={flow.companions}
                    privacyAcknowledged={flow.privacyAcknowledged}
                    setPrivacyAcknowledged={flow.setPrivacyAcknowledged}
                    branchTcUrl={flow.branchTcUrl}
                    branchPrivacyUrl={flow.branchPrivacyUrl}
                    tcContent={flow.tcContent}
                    checkInTimeOverride={flow.checkInTimeOverride}
                    setCheckInTimeOverride={flow.setCheckInTimeOverride}
                    privacyRequired={flow.policy.privacyRequired}
                    evaluation={flow.policy.screeningEnabled ? flow.screeningEvaluation : undefined}
                  />
                </FormSection>
              </fieldset>
            </div>
          </div>
        )}

        {!showSuccess && (
          <ReviewAction
            issues={flow.validationIssues}
            general={bySection.general}
            nextLabel={nextIssue ? CHECK_IN_SECTIONS.find((x) => x.id === nextIssue)!.title : null}
            onFixNext={nextIssue ? () => goTo(nextIssue) : undefined}
            failed={saveFailed}
            saving={saving}
            onCancel={handleClose}
            onSubmit={handleSubmit}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

/** One titled card per part of the form, numbered to match the section rail. */
function FormSection({ id, n, title, left, children }: { id: CheckInSectionId; n: number; title: string; left: number; children: React.ReactNode }) {
  return (
    <section id={`checkin-section-${id}`} aria-labelledby={`checkin-title-${id}`} className="scroll-mt-16 space-y-5 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5 lg:scroll-mt-4">
      <div className="flex items-center gap-3">
        <span aria-hidden className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold",
          left === 0 ? "bg-success-subtle text-success-strong" : "bg-accent text-accent-foreground")}>
          {left === 0 ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : n}
        </span>
        <h3 id={`checkin-title-${id}`} className="text-lg font-extrabold leading-7 text-foreground">{title}</h3>
      </div>
      {children}
    </section>
  );
}
