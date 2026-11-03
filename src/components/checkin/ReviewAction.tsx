import { Button } from "@/components/ui/button";
import { ArrowDown, Check, Loader2 } from "lucide-react";
import { shortIssue } from "@/lib/checkInSections";

/**
 * Check-in footer: one short line saying what is still needed (with a jump to
 * it) instead of a list that ate the form's space, then Cancel and Check in.
 */
export function ReviewAction({ issues, general = [], nextLabel, onFixNext, failed, saving, onCancel, onSubmit }: {
  issues: string[]; general?: string[]; nextLabel?: string | null; onFixNext?: () => void;
  failed: boolean; saving: boolean; onCancel: () => void; onSubmit: () => void;
}) {
  const fieldIssues = issues.filter((i) => !general.includes(i));
  const shown = fieldIssues.slice(0, 3).map(shortIssue);
  const more = fieldIssues.length - shown.length;
  return <div className="shrink-0 border-t border-border bg-card px-4 py-3 sm:px-6">
    {failed && <p role="alert" className="mb-2 rounded-lg bg-error-subtle px-3 py-2 text-sm font-semibold text-destructive-strong">Check-in could not be confirmed. Your answers are kept unchanged for a safe retry. Check the connection and try again.</p>}
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <div aria-live="polite" className="min-w-0 flex-1 basis-full text-sm sm:basis-0">
        {general.length > 0 ? (
          <p className="text-muted-foreground">{general[0]}</p>
        ) : fieldIssues.length === 0 ? (
          <p className="flex items-center gap-1.5 font-bold text-success-strong"><Check aria-hidden className="h-4 w-4" strokeWidth={3} />Ready to check in</p>
        ) : (
          <p className="text-muted-foreground">
            <span className="font-bold text-foreground">{fieldIssues.length} still needed:</span>{" "}
            {shown.join(", ")}{more > 0 ? ` and ${more} more` : ""}
            {onFixNext && <> · <button type="button" onClick={onFixNext} className="inline-flex items-center gap-1 font-bold text-primary-hover underline-offset-4 hover:underline">Go to {nextLabel?.toLowerCase()}<ArrowDown aria-hidden className="h-3.5 w-3.5" /></button></>}
          </p>
        )}
      </div>
      <div className="ml-auto flex items-center gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={saving}>Cancel</Button>
        <Button className="gap-2 px-6 text-base" onClick={onSubmit} disabled={saving || issues.length > 0}>
          {saving ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Check aria-hidden="true" className="h-4 w-4" />}
          {saving ? "Saving…" : failed ? "Try again" : "Check in"}
        </Button>
      </div>
    </div>
  </div>;
}
