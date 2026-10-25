import { Button } from "@/components/ui/button";
import { Check, Loader2 } from "lucide-react";

export function ReviewAction({ issues, failed, saving, onCancel, onSubmit }: {
  issues: string[]; failed: boolean; saving: boolean; onCancel: () => void; onSubmit: () => void;
}) {
  return <div className="shrink-0 border-t border-border bg-card px-4 py-3 sm:px-6">
    {failed && <p role="alert" className="mb-2 text-sm text-destructive-strong">Check-in could not be confirmed. Your answers are kept unchanged for a safe retry. Check the connection and try again.</p>}
    {issues.length > 0 && <div aria-live="polite" className="mb-2 max-h-24 overflow-y-auto text-sm text-muted-foreground"><ul className="list-disc pl-4">{issues.map(issue => <li key={issue}>{issue}</li>)}</ul></div>}
    <div className="flex items-center justify-between gap-2">
      <Button variant="ghost" className="min-h-touch" onClick={onCancel} disabled={saving}>Cancel</Button>
      <Button className="min-h-touch gap-2 text-base" onClick={onSubmit} disabled={saving || issues.length > 0}>
        {saving ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Check aria-hidden="true" className="h-4 w-4" />}
        {saving ? "Saving…" : failed ? "Try again" : "Check In"}
      </Button>
    </div>
  </div>;
}