import { KioskInput } from "@/components/kiosk/KioskInput";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle, ClipboardList } from "lucide-react";
import type { FormField } from "@/hooks/useFormFields";

export interface KioskHealthQuestion {
  id: string;
  question: string;
  type: "yesno" | "text" | "textarea" | "select" | "checkbox" | "file";
  required?: boolean;
  placeholder?: string | null;
  options?: string[];
}

interface Props {
  formFields?: FormField[];
  formAnswers?: Record<string, string>;
  onFormAnswerChange?: (key: string, value: string) => void;
  healthQuestions?: KioskHealthQuestion[];
  healthAnswers?: Record<string, any>;
  onHealthAnswerChange?: (id: string, value: any) => void;
  title?: string;
  subtitle?: string;
}

export function KioskDynamicQuestions({
  formFields = [],
  formAnswers = {},
  onFormAnswerChange,
  healthQuestions = [],
  healthAnswers = {},
  onHealthAnswerChange,
  title,
  subtitle,
}: Props) {
  const totalQuestions = formFields.length + healthQuestions.length;
  const answeredForm = formFields.filter((f) => formAnswers[f.field_key]?.trim()).length;
  const answeredHealth = healthQuestions.filter((q) => healthAnswers[q.id] !== undefined && healthAnswers[q.id] !== "").length;
  const totalAnswered = answeredForm + answeredHealth;

  const hasYesFlags = healthQuestions.some((q) => q.type === "yesno" && healthAnswers[q.id] === true);

  return (
    <div className="space-y-4">
      {(title || subtitle) && (
        <div className="text-center space-y-1">
          {title && <h2 className="text-2xl font-bold text-foreground">{title}</h2>}
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          <p className="text-sm text-muted-foreground">{totalAnswered} of {totalQuestions} answered</p>
        </div>
      )}

      <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1 kiosk-scroll-fade">
        {/* Form fields */}
        {formFields.map((f, idx) => {
          const val = formAnswers[f.field_key] || "";
          const answered = !!val.trim();
          return (
            <div
              key={f.id}
              className={`rounded-2xl border-2 p-5 transition-all ${
                answered ? "border-success/30 bg-success/5" : "border-border bg-card"
              }`}
            >
              <div className="flex items-start gap-3 mb-3">
                <span
                  className={`text-sm font-bold shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${
                    answered ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {answered ? "✓" : idx + 1}
                </span>
                <p className="text-base text-foreground font-medium leading-relaxed">
                  {f.label}
                  {f.required && <span className="text-destructive ml-0.5">*</span>}
                </p>
              </div>
              <div className="ml-11">
                {f.field_type === "textarea" ? (
                  <Textarea
                    value={val}
                    onChange={(e) => onFormAnswerChange?.(f.field_key, e.target.value)}
                    placeholder={f.label}
                    className="min-h-[80px] text-base rounded-xl resize-none"
                  />
                ) : f.field_type === "select" ? (
                  <Select value={val} onValueChange={(v) => onFormAnswerChange?.(f.field_key, v)}>
                    <SelectTrigger className="h-14 text-base rounded-xl">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      {/* If field has no stored options, render a text input instead */}
                    </SelectContent>
                  </Select>
                ) : (
                  <KioskInput
                    label={f.label}
                    value={val}
                    onChange={(e) => onFormAnswerChange?.(f.field_key, e.target.value)}
                    required={f.required}
                  />
                )}
              </div>
            </div>
          );
        })}

        {/* Health / compliance questions */}
        {healthQuestions.length > 0 && formFields.length > 0 && (
          <div className="pt-3 mt-2 border-t border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-3">
              <ClipboardList className="h-3.5 w-3.5" /> Compliance Questions
            </p>
          </div>
        )}

        {healthQuestions.map((q, idx) => {
          const answer = healthAnswers[q.id];
          const isYesNo = q.type === "yesno";
          const hasYes = isYesNo && answer === true;
          const hasNo = isYesNo && answer === false;
          const numberOffset = formFields.length + idx + 1;

          return (
            <div
              key={q.id}
              className={`rounded-2xl border-2 p-5 transition-all ${
                hasNo ? "border-success/30 bg-success/5" : hasYes ? "border-destructive/30 bg-destructive/5" : "border-border bg-card"
              }`}
            >
              <div className="flex items-start gap-3 mb-3">
                <span
                  className={`text-sm font-bold shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${
                    hasNo
                      ? "bg-success text-success-foreground"
                      : hasYes
                        ? "bg-destructive text-destructive-foreground"
                        : answer !== undefined && answer !== ""
                          ? "bg-success text-success-foreground"
                          : "bg-muted text-muted-foreground"
                  }`}
                >
                  {hasNo ? "✓" : hasYes ? "✗" : answer !== undefined && answer !== "" ? "✓" : numberOffset}
                </span>
                <p className="text-base text-foreground font-medium leading-relaxed">
                  {q.question}
                  {q.required && <span className="text-destructive ml-0.5">*</span>}
                </p>
              </div>
              <div className="ml-11">
                {q.type === "yesno" && (
                  <div className="flex gap-3">
                    <button
                      onClick={() => onHealthAnswerChange?.(q.id, false)}
                      className={`flex-1 py-4 rounded-xl text-base font-bold transition-all flex items-center justify-center gap-2 min-h-[52px] ${
                        answer === false
                          ? "bg-success text-success-foreground shadow-sm"
                          : "bg-muted text-muted-foreground hover:bg-success/20"
                      }`}
                    >
                      ✓ No
                    </button>
                    <button
                      onClick={() => onHealthAnswerChange?.(q.id, true)}
                      className={`flex-1 py-4 rounded-xl text-base font-bold transition-all flex items-center justify-center gap-2 min-h-[52px] ${
                        answer === true
                          ? "bg-destructive text-destructive-foreground shadow-sm"
                          : "bg-muted text-muted-foreground hover:bg-destructive/20"
                      }`}
                    >
                      ✗ Yes
                    </button>
                  </div>
                )}
                {q.type === "text" && (
                  <KioskInput
                    label={q.placeholder || "Enter response..."}
                    value={answer || ""}
                    onChange={(e) => onHealthAnswerChange?.(q.id, e.target.value)}
                    required={q.required}
                  />
                )}
                {q.type === "textarea" && (
                  <Textarea
                    value={answer || ""}
                    onChange={(e) => onHealthAnswerChange?.(q.id, e.target.value)}
                    placeholder={q.placeholder || "Enter details..."}
                    className="min-h-[80px] text-base rounded-xl resize-none"
                  />
                )}
                {q.type === "select" && q.options && (
                  <Select value={answer || ""} onValueChange={(val) => onHealthAnswerChange?.(q.id, val)}>
                    <SelectTrigger className="h-14 text-base rounded-xl">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      {q.options.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {q.type === "checkbox" && (
                  <div
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 cursor-pointer"
                    onClick={() => onHealthAnswerChange?.(q.id, !answer)}
                  >
                    <Checkbox checked={!!answer} className="h-6 w-6" />
                    <span className="text-base text-foreground font-medium">Yes, I confirm</span>
                  </div>
                )}
                {hasYes && (
                  <div className="mt-3 rounded-xl bg-destructive/10 border border-destructive/20 p-3 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                    <p className="text-sm text-destructive font-medium">This may require staff review.</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {hasYesFlags && (
        <div className="rounded-2xl bg-destructive/10 border-2 border-destructive/20 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-base font-bold text-destructive">Health Concern Flagged</p>
            <p className="text-sm text-muted-foreground mt-0.5">Staff review may be required.</p>
          </div>
        </div>
      )}
    </div>
  );
}
