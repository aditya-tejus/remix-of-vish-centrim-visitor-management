import { useQuestionLabels } from "@/hooks/useQuestionLabels";
import { AlertTriangle, Check } from "lucide-react";

interface ScreeningAnswersProps {
  answers?: Record<string, any> | null;
  emptyText?: string;
  className?: string;
}

function renderValue(value: any) {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function isFlagged(value: any) {
  if (typeof value === "boolean") return value === true;
  if (typeof value === "string") return value.trim().toLowerCase() === "yes";
  return false;
}

/** One shared way of showing check-in answers wherever they appear. */
export function ScreeningAnswers({ answers, emptyText = "No answers recorded for this visit.", className = "" }: ScreeningAnswersProps) {
  const { labelFor } = useQuestionLabels();
  const entries = Object.entries(answers || {});

  if (entries.length === 0) {
    return <p className={`text-[13px] text-muted-foreground ${className}`}>{emptyText}</p>;
  }

  return (
    <div className={`rounded-xl border border-border divide-y divide-border overflow-hidden ${className}`}>
      {entries.map(([key, value]) => {
        const flagged = isFlagged(value);
        return (
          <div key={key} className="px-3.5 py-2.5 flex items-start justify-between gap-4">
            <p className="text-[13px] text-foreground leading-snug">{labelFor(key)}</p>
            <span
              className={`shrink-0 inline-flex items-center gap-1 text-[12px] font-medium ${
                flagged ? "text-destructive" : "text-muted-foreground"
              }`}
            >
              {flagged ? <AlertTriangle className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
              {renderValue(value)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
