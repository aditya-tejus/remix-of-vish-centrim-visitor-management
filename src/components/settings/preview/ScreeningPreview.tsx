/**
 * Phase 7E — the check-in questions in the order they are asked, with the
 * answers that stop a sign-in marked. Read from the live question settings.
 */
import { useActiveHealthQuestions, VisitorType } from "@/hooks/useHealthQuestions";
import { useFormFields } from "@/hooks/useFormFields";
import { CheckCircle2, AlertTriangle, ClipboardList } from "lucide-react";

export function ScreeningPreview({ personType }: { personType: string }) {
  const vt = personType as VisitorType;
  const { data: questions = [], isLoading } = useActiveHealthQuestions(vt);
  const { data: fields = [] } = useFormFields(vt, "");

  if (isLoading) return <p className="text-[13px] text-muted-foreground">Loading preview…</p>;

  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <h4 className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
          <ClipboardList className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          Details asked first
        </h4>
        {fields.filter((f) => f.is_active).length === 0 ? (
          <p className="text-[13px] text-muted-foreground">No extra details are collected for this type.</p>
        ) : (
          <ul className="space-y-1">
            {fields
              .filter((f) => f.is_active)
              .map((f) => (
                <li key={f.id} className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2">
                  <span className="text-[13px] text-foreground">{f.label}</span>
                  <span className="text-[11px] text-muted-foreground">{f.required ? "Required" : "Optional"}</span>
                </li>
              ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h4 className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
          <CheckCircle2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          Check-in questions
        </h4>
        {questions.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">No check-in questions are switched on for this type.</p>
        ) : (
          <ol className="space-y-1">
            {questions.map((q, i) => (
              <li key={q.id} className="rounded-lg border border-border bg-card px-3 py-2">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-[13px] text-foreground">
                    {i + 1}. {q.question}
                  </span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {q.type === "yesno" ? "Yes / No" : q.type}
                  </span>
                </div>
                {q.required && (
                  <p className="mt-1 flex items-center gap-1.5 text-[11px] text-warning">
                    <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                    Must be answered before sign-in can finish.
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      <p className="text-[12px] text-muted-foreground">
        These settings decide what is asked. They do not, on their own, meet any legal or accreditation requirement.
      </p>
    </div>
  );
}
