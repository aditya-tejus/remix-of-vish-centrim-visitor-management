import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import type { ScreeningEvaluation } from "@/lib/screeningOutcome";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollText, Shield, FileText } from "lucide-react";
import { CompanionDetail, VisitorType } from "@/types/visitor";
import { CheckInFormData } from "./useCheckInFlow";
import { TimeOverride } from "@/components/TimeOverride";

interface StepConfirmProps {
  privacyRequired?: boolean;
  evaluation?: ScreeningEvaluation;
  formData: CheckInFormData;
  selectedType: VisitorType;
  photo: string | null;
  healthAnswers: Record<string, any>;
  companions: CompanionDetail[];
  privacyAcknowledged: boolean;
  setPrivacyAcknowledged: (val: boolean) => void;
  branchTcUrl: string | null;
  branchPrivacyUrl: string | null;
  tcContent?: string | null;
  checkInTimeOverride: string | null;
  setCheckInTimeOverride: (val: string | null) => void;
}

export function StepConfirm({
  formData,
  privacyRequired = true,
  evaluation,
  selectedType,
  photo,
  healthAnswers,
  companions,
  privacyAcknowledged,
  setPrivacyAcknowledged,
  branchTcUrl,
  branchPrivacyUrl,
  tcContent,
  checkInTimeOverride,
  setCheckInTimeOverride,
}: StepConfirmProps) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <p className="text-base font-semibold">{formData.firstName} {formData.surname}</p>
        {evaluation && <StatusBadge status={evaluation.blocked ? "blocked" : evaluation.flagged ? "flagged" : "clear"} />}
        {companions.length > 0 && <span className="text-sm text-muted-foreground">With {companions.length} companion{companions.length === 1 ? "" : "s"}</span>}
      </div>

      {/* Time override */}
      <TimeOverride
        value={checkInTimeOverride}
        onChange={setCheckInTimeOverride}
        label="Adjust check-in time"
      />

      {/* Terms & Privacy */}
      {privacyRequired && <div className="border-t border-border pt-3 space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <ScrollText className="h-4 w-4 text-primary" />
          </div>
          <h4 className="text-base font-bold text-foreground">Terms & Privacy</h4>
        </div>
        <div className="max-h-[100px] overflow-y-auto rounded-control bg-muted/30 p-4 text-sm text-muted-foreground leading-relaxed space-y-1.5 border border-border whitespace-pre-line">
          {tcContent ? (
            tcContent
          ) : (
            <>
              <p>1. I agree to follow all care home policies during my visit.</p>
              <p>2. I agree to sign out upon leaving the premises.</p>
              <p>3. I confirm that all information provided is accurate.</p>
              <p>4. My visit data will be processed per applicable data protection regulations.</p>
            </>
          )}
        </div>
        {(branchTcUrl || branchPrivacyUrl) && (
          <div className="flex flex-wrap gap-4">
            {branchTcUrl && (
              <a href={branchTcUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline font-medium">
                <FileText className="h-3.5 w-3.5" /> View Terms & Conditions
              </a>
            )}
            {branchPrivacyUrl && (
              <a href={branchPrivacyUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline font-medium">
                <Shield className="h-3.5 w-3.5" /> View Privacy Policy
              </a>
            )}
          </div>
        )}
        <div className="flex items-start gap-3 py-2">
          <Checkbox id="staff-terms" checked={privacyAcknowledged} className="mt-1 h-5 w-5" onCheckedChange={c => setPrivacyAcknowledged(c === true)} />
          <Label htmlFor="staff-terms" className="text-base leading-relaxed">I accept the Terms & Conditions and acknowledge the Privacy Notice</Label>
        </div>
      </div>}
    </div>
  );
}
