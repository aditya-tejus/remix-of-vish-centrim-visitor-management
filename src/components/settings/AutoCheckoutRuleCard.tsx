import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Clock, Save, Info, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSite } from "@/contexts/SiteContext";
import { useAutoCheckoutRule } from "@/hooks/useAutoCheckoutRules";
import { HOUR_CHOICES, describeRule, AutoCheckoutPersonType, AutoCheckoutMode } from "@/lib/autoCheckout";

const MODE_LABELS: { value: AutoCheckoutMode; label: string }[] = [
  { value: "hours", label: "After a set number of hours" },
  { value: "end_of_day", label: "At the end of the day" },
  { value: "either", label: "Whichever comes first" },
];

/**
 * One site's automatic sign-out rule for one person type. Residents are never
 * offered this, so this card is only rendered for the supported types.
 */
export function AutoCheckoutRuleCard({ personType }: { personType: AutoCheckoutPersonType }) {
  const { rule, loading, saving, update, save } = useAutoCheckoutRule(personType);
  const { currentSite } = useSite();
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);

  const onSave = async () => {
    const message = await save();
    if (message) {
      setError("This rule was not saved. Your choices are still on screen — try again.");
      toast({ title: "Automatic sign-out was not saved", variant: "destructive" });
    } else {
      setError(null);
      toast({ title: "Saved", description: "Automatic sign-out updated for this site." });
    }
  };

  return (
    <div className="rounded-lg border border-border p-4 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Clock className="h-4 w-4 text-primary" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Automatic sign-out</p>
            <p className="text-xs text-muted-foreground">
              Closes off anyone who forgets to sign out{currentSite ? ` at ${currentSite.name}` : ""}.
            </p>
          </div>
        </div>
        <Switch
          aria-label="Sign people out automatically"
          checked={!!rule?.enabled}
          disabled={loading || !rule}
          onCheckedChange={(v) => update({ enabled: v })}
        />
      </div>

      {rule?.enabled && (
        <div className="space-y-3 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor={`auto-mode-${personType}`} className="text-xs text-muted-foreground">Rule</Label>
            <Select value={rule.mode} onValueChange={(v) => update({ mode: v as AutoCheckoutMode })}>
              <SelectTrigger id={`auto-mode-${personType}`} className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODE_LABELS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {(rule.mode === "hours" || rule.mode === "either") && (
              <div className="space-y-1.5">
                <Label htmlFor={`auto-hours-${personType}`} className="text-xs text-muted-foreground">Hours on site</Label>
                <Select value={String(rule.hours)} onValueChange={(v) => update({ hours: parseInt(v, 10) })}>
                  <SelectTrigger id={`auto-hours-${personType}`} className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HOUR_CHOICES.map((h) => (
                      <SelectItem key={h} value={String(h)}>{h} hours</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {(rule.mode === "end_of_day" || rule.mode === "either") && (
              <div className="space-y-1.5">
                <Label htmlFor={`auto-eod-${personType}`} className="text-xs text-muted-foreground">End of day</Label>
                <Input
                  id={`auto-eod-${personType}`}
                  type="time"
                  className="h-9 text-xs"
                  value={rule.endOfDayTime}
                  onChange={(e) => update({ endOfDayTime: e.target.value || "22:00" })}
                />
              </div>
            )}
          </div>

          <div className="flex items-start gap-2 rounded-lg bg-primary/5 border border-primary/10 px-3 py-2.5">
            <Info className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" aria-hidden="true" />
            <p className="text-xs text-muted-foreground">
              {describeRule(rule)} The record shows it was an automatic sign-out, and the real departure time is not known.
              The check runs every hour, so a sign-out can be up to an hour later than the time set here.
            </p>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex justify-end">
        <Button onClick={onSave} size="sm" className="gap-1.5" disabled={saving || loading || !rule}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Save className="h-3.5 w-3.5" aria-hidden="true" />}
          Save
        </Button>
      </div>
    </div>
  );
}
