import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
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

const stepLabels: Record<string, string> = {
  identify: "Identify",
  details: "Details",
  screening: "Screening",
  confirm: "Confirm",
};

export function CheckInSheet({ open, onOpenChange, onAdd }: CheckInSheetProps) {
  const flow = useCheckInFlow(open);

  const handleClose = () => {
    flow.resetForm();
    onOpenChange(false);
  };

  const handleSubmit = () => {
    const visitor = flow.buildVisitor();
    onAdd(visitor);
    flow.resetForm();
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="right" className="sm:max-w-[520px] w-full p-0 gap-0 flex flex-col overflow-hidden">
        {/* Header with progress */}
        <SheetHeader className="px-6 pt-5 pb-3 shrink-0 border-b border-border">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-lg font-bold text-foreground">
              Check In
            </SheetTitle>
            <span className="text-[12px] text-muted-foreground font-medium">
              Step {flow.currentStepIndex + 1} of {flow.totalSteps}
            </span>
          </div>

          {/* Progress dots */}
          <div className="flex items-center gap-2 mt-2">
            {flow.steps.map((s, i) => (
              <div key={s} className="flex items-center gap-2 flex-1">
                <div className={`flex-1 h-1 rounded-full transition-all duration-300 ${
                  i <= flow.currentStepIndex ? "bg-primary" : "bg-border"
                }`} />
              </div>
            ))}
          </div>

          {/* Step label */}
          <div className="flex items-center gap-1.5 mt-1">
            {flow.steps.map((s, i) => (
              <span key={s} className={`text-[11px] flex-1 text-center font-medium ${
                i === flow.currentStepIndex ? "text-primary" : "text-muted-foreground/50"
              }`}>
                {stepLabels[s]}
              </span>
            ))}
          </div>
        </SheetHeader>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
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

        {/* Footer */}
        <div className="shrink-0 flex items-center justify-between px-6 py-3 border-t border-border bg-card/80 backdrop-blur-sm">
          <Button variant="ghost" size="sm" onClick={handleClose} className="text-muted-foreground text-[13px]">
            Cancel
          </Button>
          <div className="flex gap-2">
            {!flow.isFirstStep && (
              <Button variant="outline" size="sm" onClick={flow.goBack} className="gap-1.5 rounded-xl text-[13px]">
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </Button>
            )}
            {!flow.isLastStep ? (
              <Button size="sm" onClick={flow.goNext} className="gap-1.5 rounded-xl text-[13px]"
                disabled={!flow.canProceed}>
                Next <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleSubmit}
                className="gap-1.5 rounded-xl text-[13px] h-10 px-6"
                disabled={!flow.canProceed}
              >
                <Check className="h-4 w-4" />
                Check In
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
