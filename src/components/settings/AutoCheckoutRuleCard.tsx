import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Clock, Save, Info, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSite } from "@/contexts/SiteContext";
import { useAutoCheckoutRule } from "@/hooks/useAutoCheckoutRules";
import { END_OF_DAY_CHOICES, describeRule, formatClock, AutoCheckoutPersonType } from "@/lib/autoCheckout";

/**
 * One site's automatic sign-out rule for one person type: a single closing
 * time each day. Residents are never offered this, so this card is only
 * rendered for the supported types.
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
          <div className="space-y-1.5 sm:max-w-xs">
            <Label htmlFor={`auto-eod-${personType}`} className="text-xs text-muted-foreground">
              Closing time
            </Label>
            <Select value={rule.endOfDayTime} onValueChange={(v) => update({ endOfDayTime: v })}>
              <SelectTrigger id={`auto-eod-${personType}`} className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {END_OF_DAY_CHOICES.map((t) => (
                  <SelectItem key={t} value={t}>{formatClock(t)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-start gap-2 rounded-lg bg-primary/5 border border-primary/10 px-3 py-2.5">
            <Info className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" aria-hidden="true" />
            <p className="text-xs text-muted-foreground">
              {describeRule(rule)} This uses the site's own local time. The record shows it was an automatic
              sign-out, and the real departure time is not known. The check runs shortly after the closing time.
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
