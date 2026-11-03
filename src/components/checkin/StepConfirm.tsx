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
      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-secondary/80 px-4 py-3">
        <p className="text-base font-extrabold">{`${formData.firstName} ${formData.surname}`.trim() || "Name not entered yet"}</p>
        {evaluation && <StatusBadge status={evaluation.blocked ? "blocked" : evaluation.flagged ? "flagged" : "clear"} />}
        {companions.length > 0 && <span className="text-sm text-muted-foreground">with {companions.length} companion{companions.length === 1 ? "" : "s"}</span>}
      </div>

      {/* Time override */}
      <TimeOverride
        value={checkInTimeOverride}
        onChange={setCheckInTimeOverride}
        label="Adjust check-in time"
      />

      {/* Terms & Privacy */}
      {privacyRequired && <div className="space-y-3">
        <h4 className="flex items-center gap-2 text-sm font-bold text-foreground">
          <ScrollText aria-hidden className="h-4 w-4 text-muted-foreground" /> Terms and privacy
        </h4>
        <div className="whitespace-pre-line rounded-xl border border-border bg-secondary/60 px-4 py-3 text-sm leading-relaxed text-secondary-foreground">
          {tcContent ? (
            tcContent
          ) : (
            <ol className="list-decimal space-y-1 pl-4">
              <li>I agree to follow all care home policies during my visit.</li>
              <li>I agree to sign out when I leave.</li>
              <li>I confirm that all information provided is accurate.</li>
              <li>My visit data will be processed under the applicable data protection rules.</li>
            </ol>
          )}
        </div>
        {(branchTcUrl || branchPrivacyUrl) && (
          <div className="flex flex-wrap gap-4">
            {branchTcUrl && (
              <a href={branchTcUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline font-medium">
                <FileText aria-hidden className="h-3.5 w-3.5" /> Full terms and conditions
              </a>
            )}
            {branchPrivacyUrl && (
              <a href={branchPrivacyUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline font-medium">
                <Shield aria-hidden className="h-3.5 w-3.5" /> Privacy policy
              </a>
            )}
          </div>
        )}
        <label htmlFor="staff-terms" className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${privacyAcknowledged ? "border-primary bg-accent" : "border-input bg-card hover:border-primary/60"}`}>
          <Checkbox id="staff-terms" checked={privacyAcknowledged} className="mt-0.5" onCheckedChange={c => setPrivacyAcknowledged(c === true)} />
          <span className="text-sm font-semibold leading-relaxed text-foreground">The person checking in accepts the terms and conditions and has been shown the privacy notice</span>
        </label>
      </div>}
    </div>
  );
}
