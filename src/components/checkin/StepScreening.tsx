import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, Thermometer, Syringe, Upload, FileText, X, AlertTriangle, ShieldAlert, ShieldCheck, Ban } from "lucide-react";
import type { ScreeningEvaluation } from "@/lib/screeningOutcome";
import { VisitorType } from "@/types/visitor";
import { ContractorScreening } from "@/components/ContractorScreening";
import { Supplier } from "@/hooks/useSuppliers";

interface HealthQuestion {
  id: string;
  question: string;
  type: string;
  required?: boolean;
  placeholder?: string | null;
  options?: string[];
}

interface StepScreeningProps {
  selectedType: VisitorType;
  healthQuestions: HealthQuestion[];
  healthAnswers: Record<string, any>;
  setHealthAnswers: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  bodyTemperature: string;
  onTemperatureChange: (val: string) => void;
  dbVaccFields: any[];
  jurisdiction: "AU" | "UK";
  contractorScreeningAnswers: Record<string, any>;
  setContractorScreeningAnswers: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  selectedSupplier: Supplier | null;
  setSelectedSupplier: (supplier: Supplier | null) => void;
  onBlockedChange?: (blocked: boolean, reason: string | null) => void;
  workerFirstName?: string;
  workerSurname?: string;
  workerMobile?: string;
  /** Outcome of the configured question rules, shared with the kiosk. */
  evaluation?: ScreeningEvaluation;
}

export function StepScreening({
  selectedType,
  healthQuestions,
  healthAnswers,
  setHealthAnswers,
  bodyTemperature,
  onTemperatureChange,
  dbVaccFields,
  jurisdiction,
  contractorScreeningAnswers,
  setContractorScreeningAnswers,
  selectedSupplier,
  setSelectedSupplier,
  onBlockedChange,
  workerFirstName = "",
  workerSurname = "",
  workerMobile = "",
  evaluation,
}: StepScreeningProps) {
  const isContractor = selectedType === "contractor";

  const answeredCount = healthQuestions.filter((q) => {
    const a = healthAnswers[q.id];
    return a !== undefined && a !== null && a !== "";
  }).length;

  const hasYesFlags = healthQuestions.some((q) => q.type === "yesno" && healthAnswers[q.id] === true);

  return (
    <div className="space-y-4">
      {isContractor && (      <ContractorScreening
        jurisdiction={jurisdiction}
        answers={contractorScreeningAnswers}
        onAnswersChange={setContractorScreeningAnswers}
        selectedSupplier={selectedSupplier}
        onSupplierChange={setSelectedSupplier}
        workerFirstName={workerFirstName}
        workerSurname={workerSurname}
        workerMobile={workerMobile}
        onBlockedChange={onBlockedChange}
      />
      )}
      {/* Header section */}
      {healthQuestions.length > 0 && <div className="border-t border-border pt-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Shield className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">Check-in Questions</h3>
              <p className="text-sm text-muted-foreground">Complete all required questions before proceeding.</p>
            </div>
          </div>
          <div className={`text-sm font-bold px-2.5 py-1 rounded-lg ${
            answeredCount === healthQuestions.length
              ? hasYesFlags ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"
              : "bg-muted text-muted-foreground"
          }`}>
            {answeredCount}/{healthQuestions.length}
          </div>
        </div>
      </div>}

      {/* Health questions */}
      <div className="space-y-3">
        {healthQuestions.map((q, idx) => {
          const answer = healthAnswers[q.id];
          const isYesNo = q.type === "yesno";
          const hasYes = isYesNo && answer === true;
          const hasNo = isYesNo && answer === false;
          const isFilled = answer !== undefined && answer !== null && answer !== "";

          return (
            <div key={q.id} className={`rounded-xl border-2 p-4 transition-all duration-200 ${
              hasNo ? "border-success/30 bg-success/5"
                : hasYes ? "border-destructive/30 bg-destructive/5"
                : isFilled ? "border-primary/20 bg-primary/5" : "border-border bg-card"
            }`}>
              <div className="flex items-start gap-3 mb-3">
                <span className={`text-sm font-bold mt-0.5 shrink-0 h-7 w-7 rounded-full flex items-center justify-center transition-colors ${
                  hasNo ? "bg-success text-success-foreground"
                    : hasYes ? "bg-destructive text-destructive-foreground"
                    : isFilled ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}>{isFilled ? <Check aria-hidden="true" className="h-4 w-4" /> : idx + 1}</span>
                <p className="text-base text-foreground flex-1 leading-relaxed font-medium">
                  {q.question}{q.required && <span className="text-destructive ml-0.5">*</span>}
                </p>
              </div>
              <div className="ml-10">
                {q.type === "yesno" && (
                  <div className="flex gap-2.5">
                    <Button type="button" variant="outline" onClick={() => setHealthAnswers((prev) => ({ ...prev, [q.id]: false }))}
                      className={`flex-1 py-3 rounded-xl text-base font-bold transition-all ${answer === false ? "bg-success text-success-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-success/20"}`}>No</Button>
                    <Button type="button" variant="outline" onClick={() => setHealthAnswers((prev) => ({ ...prev, [q.id]: true }))}
                      className={`flex-1 py-3 rounded-xl text-base font-bold transition-all ${answer === true ? "bg-destructive text-destructive-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-destructive/20"}`}>Yes</Button>
                  </div>
                )}
                {q.type === "text" && (
                  <Input aria-label={q.question} value={answer || ""} onChange={(e) => setHealthAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                    placeholder={q.placeholder || "Enter response..."} className="rounded-xl h-10 text-base" />
                )}
                {q.type === "textarea" && (
                  <Textarea aria-label={q.question} value={answer || ""} onChange={(e) => setHealthAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                    placeholder={q.placeholder || "Enter details..."} className="min-h-[60px] resize-none rounded-xl text-base" />
                )}
                {q.type === "select" && q.options && (
                  <Select value={answer || ""} onValueChange={(val) => setHealthAnswers((prev) => ({ ...prev, [q.id]: val }))}>
                    <SelectTrigger aria-label={q.question} className="rounded-xl min-h-touch text-base"><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>{q.options.map((opt) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent>
                  </Select>
                )}
                {q.type === "checkbox" && (
                  <label className="flex min-h-touch items-center gap-3 p-2.5">
                    <Checkbox checked={!!answer} aria-label={q.question} className="h-5 w-5" onCheckedChange={c => setHealthAnswers(prev => ({ ...prev, [q.id]: c === true }))} />
                    <span className="text-base">Yes, I confirm</span>
                  </label>
                )}
                {q.type === "file" && (
                  <div>
                    {answer ? (
                      <div className="flex items-center gap-2.5 p-3 rounded-xl bg-muted/50 border border-border">
                        <FileText className="h-4 w-4 text-primary shrink-0" />
                        <span className="text-sm text-foreground flex-1 truncate">{answer.name || "File uploaded"}</span>
                        <Button type="button" variant="outline" onClick={() => setHealthAnswers((prev) => ({ ...prev, [q.id]: null }))} aria-label={`Remove file for ${q.question}`} className="text-muted-foreground hover:text-destructive"><X className="h-3.5 w-3.5" /></Button>
                      </div>
                    ) : (
                      <label className="flex items-center gap-2.5 p-3.5 rounded-xl border-2 border-dashed border-border hover:border-primary/30 cursor-pointer transition-colors">
                        <Upload className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Choose file to upload</span>
                        <input type="file" className="hidden" accept="image/*,.pdf,.doc,.docx"
                          onChange={(e) => { const file = e.target.files?.[0]; if (file) setHealthAnswers((prev) => ({ ...prev, [q.id]: { name: file.name, file } })); e.target.value = ""; }} />
                      </label>
                    )}
                  </div>
                )}

                {/* Inline warning for "Yes" answers */}
                {hasYes && (
                  <div className="mt-2.5 rounded-lg bg-destructive/10 border border-destructive/20 p-2.5 flex items-center gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
                    <p className="text-sm text-destructive font-medium">This answer may require staff review.</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Outcome of the configured question rules */}
      {evaluation && evaluation.flagged && (
        <div
          className={`rounded-xl border-2 p-4 flex items-start gap-3 ${
            evaluation.blocked ? "bg-destructive/10 border-destructive/25" : "bg-warning/10 border-warning/25"
          }`}
        >
          {evaluation.blocked ? (
            <Ban className="h-5 w-5 text-destructive shrink-0 mt-0.5" aria-hidden="true" />
          ) : (
            <ShieldAlert className="h-5 w-5 text-warning shrink-0 mt-0.5" aria-hidden="true" />
          )}
          <div>
            <p className={`text-base font-bold ${evaluation.blocked ? "text-destructive" : "text-warning-strong"}`}>
              {evaluation.blocked ? "Sign-in blocked" : "Staff attention needed"}
            </p>
            <ul className="text-sm text-muted-foreground mt-0.5 space-y-0.5">
              {evaluation.flags.map((f) => (
                <li key={`${f.questionId}-${f.severity}`}>{f.message}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Temperature */}
      {healthQuestions.length > 0 && <div className="border-t border-border pt-4 space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Thermometer className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h4 className="text-base font-bold text-foreground">Body Temperature</h4>
            <p className="text-sm text-muted-foreground">Optional — enter reading if taken</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Input aria-label="Body temperature" type="number" step="0.1" value={bodyTemperature} placeholder="36.5"
            onChange={(e) => onTemperatureChange(e.target.value)} className="h-10 rounded-xl text-base w-32" />
          <span className="text-base text-muted-foreground font-semibold">°C</span>
          {bodyTemperature && parseFloat(bodyTemperature) <= 37.8 && (
            <span className="text-sm text-success font-semibold inline-flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Normal
            </span>
          )}
        </div>
        {bodyTemperature && parseFloat(bodyTemperature) > 37.8 && (
          <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3 flex items-center gap-2.5">
            <Thermometer className="h-4 w-4 text-destructive shrink-0" aria-hidden="true" />
            <p className="text-sm text-destructive font-semibold">High temperature ({bodyTemperature}°C) — staff review required.</p>
          </div>
        )}
      </div>}

      {/* Vaccination */}
      {dbVaccFields.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Syringe className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h4 className="text-base font-bold text-foreground">Vaccination Records</h4>
              <p className="text-sm text-muted-foreground">Optional — enter if available</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {dbVaccFields.map((vf: any) => (
              <div key={vf.id} className="space-y-1">
                <Label className="text-sm font-medium">{vf.label}{vf.required && <span className="text-destructive ml-0.5">*</span>}</Label>
                {vf.field_type === "date" && <Input aria-label={vf.label} type="date" value={healthAnswers[`vacc_${vf.name}`] || ""} onChange={(e) => setHealthAnswers((prev) => ({ ...prev, [`vacc_${vf.name}`]: e.target.value }))} className="rounded-xl text-sm h-10" />}
                {vf.field_type === "text" && <Input aria-label={vf.label} value={healthAnswers[`vacc_${vf.name}`] || ""} onChange={(e) => setHealthAnswers((prev) => ({ ...prev, [`vacc_${vf.name}`]: e.target.value }))} className="rounded-xl text-sm h-10" />}
                {vf.field_type === "select" && vf.options && (
                  <Select value={healthAnswers[`vacc_${vf.name}`] || ""} onValueChange={(val) => setHealthAnswers((prev) => ({ ...prev, [`vacc_${vf.name}`]: val }))}>
                    <SelectTrigger aria-label={vf.label} className="rounded-xl min-h-touch text-base"><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>{vf.options.map((opt: string) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent>
                  </Select>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
