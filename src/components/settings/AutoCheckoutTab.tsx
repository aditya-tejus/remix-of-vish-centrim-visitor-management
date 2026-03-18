import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { LogOut, Save, Loader2, Clock, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const HOUR_OPTIONS = [
  { value: "4", label: "4 hours", description: "Short visits only" },
  { value: "8", label: "8 hours", description: "Standard working day" },
  { value: "12", label: "12 hours", description: "Extended visits", isDefault: true },
  { value: "24", label: "24 hours", description: "Full day allowance" },
];

export function AutoCheckoutTab() {
  const [enabled, setEnabled] = useState(false);
  const [hours, setHours] = useState("12");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    Promise.all([
      supabase.from("settings").select("value").eq("key", "auto_checkout_enabled").single(),
      supabase.from("settings").select("value").eq("key", "auto_checkout_hours").single(),
    ]).then(([enabledRes, hoursRes]) => {
      if (enabledRes.data) setEnabled(enabledRes.data.value === "true");
      if (hoursRes.data) setHours(hoursRes.data.value);
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const now = new Date().toISOString();
    const [r1, r2] = await Promise.all([
      supabase.from("settings").update({ value: String(enabled), updated_at: now }).eq("key", "auto_checkout_enabled"),
      supabase.from("settings").update({ value: hours, updated_at: now }).eq("key", "auto_checkout_hours"),
    ]);
    setSaving(false);
    if (r1.error || r2.error) {
      toast({ title: "Error", description: "Failed to save. Check admin permissions.", variant: "destructive" });
    } else {
      toast({ title: "Settings Saved", description: `Auto check-out ${enabled ? `enabled (${hours} hours)` : "disabled"}.` });
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-soft">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <LogOut className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">Auto Check-Out</h2>
            <p className="text-xs text-muted-foreground">Automatically check out visitors after a set time to prevent stale records.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="auto-checkout-toggle" className="text-xs text-muted-foreground">
            {loading ? "Loading..." : enabled ? "Enabled" : "Disabled"}
          </Label>
          <Switch
            id="auto-checkout-toggle"
            checked={enabled}
            onCheckedChange={setEnabled}
            disabled={loading}
          />
        </div>
      </div>

      <div className={`transition-opacity duration-200 ${enabled ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
        <p className="text-xs text-muted-foreground mb-3">
          Visitors who remain checked in longer than the selected period will be automatically checked out.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {HOUR_OPTIONS.map((option) => {
            const isSelected = hours === option.value;
            return (
              <button
                key={option.value}
                type="button"
                disabled={loading}
                onClick={() => setHours(option.value)}
                className={`relative rounded-xl border-2 p-4 text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 ${
                  isSelected
                    ? "border-primary bg-primary/5 shadow-sm shadow-primary/10"
                    : "border-border bg-card hover:border-primary/40 hover:bg-muted/30"
                }`}
              >
                {option.isDefault && (
                  <span className="absolute -top-2.5 left-3 text-[10px] font-semibold uppercase tracking-wider bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                    Default
                  </span>
                )}
                <div className="flex items-center gap-2 mb-2">
                  <Clock className={`h-4 w-4 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                  <span className={`text-lg font-bold ${isSelected ? "text-primary" : "text-foreground"}`}>
                    {option.label}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {option.description}
                </p>
                {isSelected && (
                  <div className="mt-3 flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                    <span className="text-[10px] font-semibold text-primary uppercase tracking-wider">Selected</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-start gap-2 rounded-lg bg-primary/5 border border-primary/10 px-3 py-2.5 mt-4">
          <Info className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground">
            The auto check-out runs every hour. Visitors checked in longer than <span className="font-semibold text-foreground">{hours} hours</span> will be automatically checked out and marked accordingly in the audit log.
          </p>
        </div>
      </div>

      <div className="flex justify-end mt-4 pt-3 border-t border-border">
        <Button onClick={handleSave} size="sm" className="gap-1.5 shadow-sm shadow-primary/20" disabled={saving || loading}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Save
        </Button>
      </div>
    </div>
  );
}
