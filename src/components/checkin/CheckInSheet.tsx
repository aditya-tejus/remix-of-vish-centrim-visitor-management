import { useState } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, UserPlus } from "lucide-react";
import { Visitor } from "@/types/visitor";
import { useCheckInFlow } from "./useCheckInFlow";
import { StepIdentify } from "./StepIdentify";
import { StepDetails } from "./StepDetails";
import { StepScreening } from "./StepScreening";
import { StepConfirm } from "./StepConfirm";

interface CheckInSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (visitor: Omit<Visitor, "id">) => Visitor;
}

const stepConfig: Record<string, { label: string; icon: string }> = {
  identify: { label: "Identify", icon: "1" },
  details: { label: "Details", icon: "2" },
  screening: { label: "Screening", icon: "3" },
  confirm: { label: "Confirm", icon: "4" },
};

export function CheckInSheet({ open, onOpenChange, onAdd }: CheckInSheetProps) {
  const flow = useCheckInFlow(open);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successName, setSuccessName] = useState("");

  const handleClose = () => {
    flow.resetForm();
    setShowSuccess(false);
    onOpenChange(false);
  };

  const handleSubmit = () => {
    const visitor = flow.buildVisitor();
    onAdd(visitor);
    setSuccessName(`${flow.formData.firstName} ${flow.formData.surname}`);
    setShowSuccess(true);
    setTimeout(() => {
      flow.resetForm();
      setShowSuccess(false);
      onOpenChange(false);
    }, 2500);
  };

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[50vw] min-w-[480px] p-0 gap-0 flex flex-col overflow-hidden"
      >
        {/* Header */}
        <SheetHeader className="px-6 pt-5 pb-4 shrink-0 border-b border-border bg-card">
          <div className="flex items-center justify-between mb-3">
            <SheetTitle className="flex items-center gap-2.5 text-[18px] font-bold text-foreground">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <UserPlus className="h-4 w-4 text-primary" />
              </div>
              Check In
            </SheetTitle>
            <span className="text-[12px] text-muted-foreground font-medium bg-muted px-2.5 py-1 rounded-lg">
              Step {flow.currentStepIndex + 1} of {flow.totalSteps}
            </span>
          </div>
          <SheetDescription className="sr-only">Check in a visitor</SheetDescription>

          {/* Progress stepper */}
          <div className="flex items-center gap-1">
            {flow.steps.map((s, i) => {
              const isActive = i === flow.currentStepIndex;
              const isComplete = i < flow.currentStepIndex;
              const cfg = stepConfig[s] || { label: s, icon: `${i + 1}` };
              return (
                <div key={s} className="flex items-center flex-1 gap-1">
                  <div className="flex items-center gap-2 flex-1">
                    {/* Step indicator */}
                    <div className={`h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 transition-all duration-300 ${
                      isComplete ? "bg-success text-success-foreground"
                        : isActive ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      {isComplete ? <Check className="h-3.5 w-3.5" /> : cfg.icon}
                    </div>
                    {/* Label */}
                    <span className={`text-[12px] font-medium transition-colors hidden sm:inline ${
                      isActive ? "text-primary" : isComplete ? "text-success" : "text-muted-foreground/60"
                    }`}>
                      {cfg.label}
                    </span>
                  </div>
                  {/* Connector line */}
                  {i < flow.steps.length - 1 && (
                    <div className={`h-[2px] flex-1 min-w-[16px] rounded-full transition-all duration-300 ${
                      isComplete ? "bg-success" : "bg-border"
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
        </SheetHeader>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto">
          {showSuccess ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 px-6 py-16">
              <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-success" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-[18px] font-bold text-foreground">{successName} checked in!</p>
                <p className="text-[14px] text-muted-foreground">Welcome to the facility.</p>
              </div>
            </div>
          ) : (
            <div className="px-6 py-6">
              {flow.step === "identify" && (
                <StepIdentify
                  selectedType={flow.selectedType}
                  onTypeChange={flow.setSelectedType}
                  searchQuery={flow.searchQuery}
                  onSearchChange={flow.setSearchQuery}
                  searchResults={flow.searchResults}
                  selectedProfile={flow.selectedProfile}
                  onSelectProfile={(profile) => {
                    flow.selectProfile(profile);
                    flow.goNext();
                  }}
                  onNewPerson={flow.goNext}
                />
              )}

              {flow.step === "details" && (
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
                  photo={flow.photo}
                  setPhoto={flow.setPhoto}
                  onChangeProfile={() => flow.setStep("identify")}
                />
              )}

              {flow.step === "screening" && (
                <StepScreening
                  selectedType={flow.selectedType}
                  healthQuestions={flow.healthQuestions}
                  healthAnswers={flow.healthAnswers}
                  setHealthAnswers={flow.setHealthAnswers}
                  bodyTemperature={flow.formData.bodyTemperature}
                  onTemperatureChange={(val) => flow.updateField("bodyTemperature", val)}
                  dbVaccFields={flow.dbVaccFields}
                  jurisdiction={flow.jurisdiction}
                  contractorScreeningAnswers={flow.contractorScreeningAnswers}
                  setContractorScreeningAnswers={flow.setContractorScreeningAnswers}
                  selectedSupplier={flow.selectedSupplier}
                  setSelectedSupplier={flow.setSelectedSupplier}
                />
              )}

              {flow.step === "confirm" && (
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
                />
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {!showSuccess && (
          <div className="shrink-0 border-t border-border bg-card px-6 py-4">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={handleClose} className="text-muted-foreground text-[13px] h-10">
                Cancel
              </Button>
              <div className="flex gap-2.5">
                {!flow.isFirstStep && (
                  <Button variant="outline" onClick={flow.goBack} className="gap-2 rounded-xl text-[13px] h-10 px-5">
                    <ArrowLeft className="h-3.5 w-3.5" /> Back
                  </Button>
                )}
                {!flow.isLastStep ? (
                  <Button onClick={flow.goNext} className="gap-2 rounded-xl text-[13px] h-10 px-6"
                    disabled={!flow.canProceed}>
                    Next <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                ) : (
                  <Button
                    onClick={handleSubmit}
                    className="gap-2 rounded-xl text-[14px] h-12 px-8 bg-success hover:bg-success/90 text-success-foreground font-semibold shadow-sm"
                    disabled={!flow.canProceed}
                  >
                    <Check className="h-4.5 w-4.5" />
                    Complete Check In
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
