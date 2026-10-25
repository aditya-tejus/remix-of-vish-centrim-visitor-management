import { useState, useRef } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { CheckCircle2, UserPlus, ShieldAlert, ShieldCheck, UtensilsCrossed, Printer } from "lucide-react";
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
  const { currentSite, currentSiteId } = useSite();

  const handleClose = () => {
    if (submittingRef.current) return;
    flow.resetForm();
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
      visitor = flow.buildVisitor();
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

    // Flagged (not blocked) sign-ins are recorded server-side, so the entry
    // cannot be skipped from the browser.
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
        flow.resetForm();
        setShowSuccess(false);
        onOpenChange(false);
      }, 2500);
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent
        side="right"
        className="inset-y-0 right-0 h-dvh w-full max-w-full border-border bg-card p-0 gap-0 flex flex-col overflow-hidden sm:inset-y-auto sm:top-1/2 sm:left-1/2 sm:right-auto sm:h-[min(900px,92dvh)] sm:w-[calc(100%-32px)] sm:max-w-2xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl [&_input]:text-base [&_textarea]:text-base [&_[role=combobox]]:text-base"
      >
        {/* Header */}
        <SheetHeader className="px-6 pt-5 pb-4 shrink-0 border-b border-border bg-card">
          <SheetTitle className="flex items-center gap-2 pr-8 text-xl font-semibold"><UserPlus aria-hidden="true" className="h-5 w-5 text-primary" /> Check In</SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">{currentSite?.name || "Current site"}</SheetDescription>
        </SheetHeader>

        {/* Step content */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {showSuccess ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 px-6 py-16">
              <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-success" />
              </div>
              <div className="text-center space-y-1" role="status">
                <p className="text-[18px] font-bold text-foreground">{successName} checked in!</p>
                <p className="text-[14px] text-muted-foreground">Welcome to the facility.</p>
              </div>
              {flow.badgePrintingEnabled && successBadge && (
                <div className="flex gap-2.5 pt-2">
                  <Button variant="outline" className="gap-2 rounded-xl" onClick={() => issueBadge(successBadge, { visitorId: createdVisitorId, siteId: currentSiteId, siteName: currentSite?.name })}>
                    <Printer className="h-4 w-4" /> Print Badge
                  </Button>
                  <Button className="rounded-xl" onClick={handleClose}>Done</Button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-5 px-4 py-4 sm:px-6">
              {(
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
              )}

              {(
                <StepDetails
                  formData={flow.formData}
                  updateField={flow.updateField}
                  selectedProfile={flow.selectedProfile}
                  isReturning={flow.isReturning}
                  selectedType={flow.selectedType}
                  residentItems={flow.residentItems}
                  staffItems={flow.staffItems}
                  companions={flow.companions}
                  setCompanions={flow.setCompanions}
                  activeCompanionFields={flow.activeCompanionFields}
                  activeFields={flow.activeFields}
                  photo={flow.photo}
                  setPhoto={flow.setPhoto}
                  onChangeProfile={() => { flow.setSelectedProfile(null); flow.setIsReturning(false); flow.setSearchQuery(""); }}
                />
              )}

              <VisitPurpose flow={flow} />
              {flow.foodStepApplies && (
                <div className="space-y-5">
                  <div className="space-y-1">
                    <h3 className="text-[16px] font-bold text-foreground flex items-center gap-2">
                      <UtensilsCrossed className="h-4 w-4 text-primary" /> Food Register
                    </h3>
                    <p className="text-[13px] text-muted-foreground">
                      Recording food brought in for {flow.selectedResident?.name}.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[12px] font-medium">Are you bringing food into the home?</Label>
                    <div className="flex gap-3">
                      {[true, false].map((val) => (
                        <Button variant="outline"
                          key={String(val)}
                          type="button"
                          onClick={() => flow.setBringingFood(val)}
                          className={`flex-1 h-10 rounded-xl border text-[13px] font-semibold transition-all active:scale-[0.98] ${
                            flow.bringingFood === val
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background text-muted-foreground border-border"
                          }`}
                        >
                          {val ? "Yes" : "No"}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {flow.bringingFood && (
                    <FoodFormFields
                      state={flow.foodForm}
                      onChange={flow.setFoodForm}
                      residents={flow.residentItems}
                      primaryResidentId={flow.selectedResident?.id || null}
                    />
                  )}
                </div>
              )}

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

              {(
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
              )}

              {flow.overdueKeys.length > 0 && flow.keyPolicy.enforcement !== "off" && <section className="border-l-2 border-warning px-3 py-2 space-y-2">
                <h3 className="text-base font-semibold text-warning-strong">Outstanding keys / fobs</h3>
                <ul className="text-sm">{flow.overdueKeys.map(item => <li key={item.id}>{item.keyLabel}</li>)}</ul>
                {flow.keyPolicy.enforcement === "block" && <><Label htmlFor="staff-key-reason">Reason for allowing check-in (at least 3 characters)</Label><Textarea id="staff-key-reason" value={flow.keyOverrideReason} onChange={e => flow.setKeyOverrideReason(e.target.value)} /></>}
              </section>}
              {flow.screeningFlagged && (
                <div
                  className={`mt-4 rounded-xl border p-4 space-y-3 ${
                    flow.screeningBlocked ? "border-destructive/40 bg-destructive/5" : "border-warning/40 bg-warning/5"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <ShieldAlert
                      className={`h-4 w-4 mt-0.5 shrink-0 ${flow.screeningBlocked ? "text-destructive" : "text-warning"}`}
                      aria-hidden="true"
                    />
                    <div className="space-y-1">
                      <p className={`text-[13px] font-semibold ${flow.screeningBlocked ? "text-destructive" : "text-warning-foreground"}`}>
                        {flow.screeningBlocked ? "Sign-in blocked by check-in questions" : "Check-in questions need staff attention"}
                      </p>
                      <ul className="text-[12px] text-muted-foreground space-y-0.5">
                        {flow.screeningEvaluation.flags.map((f) => (
                          <li key={`${f.questionId}-${f.severity}`}>
                            {f.message}
                            {f.action === "block" ? " — blocks sign-in" : ""}
                          </li>
                        ))}
                      </ul>
                      <p className="text-[12px] text-muted-foreground">
                        {flow.overrideApprovedBy
                          ? `Approved by ${flow.overrideApprovedBy} and recorded in the audit trail.`
                          : flow.screeningBlocked
                            ? "A supervisor with the right permission must approve this, with a reason of at least 10 characters."
                            : "A staff reason of at least 10 characters is required to continue, and it is recorded in the audit trail."}
                      </p>
                    </div>
                  </div>
                  {!flow.overrideApprovedBy && (
                    <>
                      <Textarea
                        value={flow.overrideReason}
                        onChange={(e) => flow.setOverrideReason(e.target.value)}
                        placeholder="Reason for allowing this check-in (at least 10 characters)"
                        aria-label="Reason for allowing this check-in"
                        className="min-h-[64px] text-[13px] rounded-lg"
                      />
                      {overrideError && (
                        <p className="text-[12px] text-destructive" role="alert">{overrideError}</p>
                      )}
                      {flow.screeningBlocked && (
                        <Button
                          variant="outline"
                          className="gap-2 rounded-xl text-[13px] h-10"
                          disabled={!flow.overrideValid || approving}
                          onClick={async () => {
                            setApproving(true);
                            const err = await flow.approveBlockedScreening();
                            setApproving(false);
                            setOverrideError(err);
                          }}
                        >
                          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                          {approving ? "Recording approval…" : "Supervisor approve"}
                        </Button>
                      )}
                    </>
                  )}
                </div>
              )}

            </div>
          )}
        </div>

        {!showSuccess && <ReviewAction issues={flow.validationIssues} failed={saveFailed} saving={saving} onCancel={handleClose} onSubmit={handleSubmit} />}
      </SheetContent>
    </Sheet>
  );
}
