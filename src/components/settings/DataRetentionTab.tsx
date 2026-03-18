import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, Save, Loader2, Calendar, Trash2, Users, HardHat, Home } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const ALLOWED_RETENTION_VALUES = ["30", "60", "90", "180"];

const retentionOptions = [
  { value: "30", label: "30 Days", description: "Maximum security. Ideal for short-term visits." },
  { value: "60", label: "60 Days", description: "Recommended default. Balances compliance and access.", isDefault: true },
  { value: "90", label: "90 Days", description: "Extended access. Good for recurring visitors." },
  { value: "180", label: "180 Days", description: "Long-term retention. For audit-heavy facilities." },
];

type VisitorTypeKey = "visitor" | "contractor" | "resident";

const typeConfig: { value: VisitorTypeKey; label: string; icon: typeof Users; settingsKey: string }[] = [
  { value: "visitor", label: "Visitors", icon: Users, settingsKey: "retention_period_days_visitor" },
  { value: "contractor", label: "Contractors", icon: HardHat, settingsKey: "retention_period_days_contractor" },
  { value: "resident", label: "Residents", icon: Home, settingsKey: "retention_period_days_resident" },
];

function RetentionPicker({ settingsKey, typeLabel }: { settingsKey: string; typeLabel: string }) {
  const [retentionPeriod, setRetentionPeriod] = useState("60");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    supabase
      .from("settings")
      .select("value")
      .eq("key", settingsKey)
      .single()
      .then(({ data }) => {
        if (data && ALLOWED_RETENTION_VALUES.includes(data.value)) {
          setRetentionPeriod(data.value);
        }
        setLoading(false);
      });
  }, [settingsKey]);

  const handleSave = async () => {
    if (!ALLOWED_RETENTION_VALUES.includes(retentionPeriod)) return;
    setSaving(true);
    const { error } = await supabase
      .from("settings")
      .update({ value: retentionPeriod, updated_at: new Date().toISOString() })
      .eq("key", settingsKey);
    setSaving(false);
    if (error) {
      toast({ title: "Error", description: "Failed to save retention setting.", variant: "destructive" });
    } else {
      toast({ title: "Settings Saved", description: `${typeLabel} retention set to ${retentionPeriod} days.` });
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {retentionOptions.map((option) => {
          const isSelected = retentionPeriod === option.value;
          return (
            <button
              key={option.value}
              type="button"
              disabled={loading}
              onClick={() => setRetentionPeriod(option.value)}
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
                <Calendar className={`h-4 w-4 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
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

      <div className="flex items-center justify-between pt-3 border-t border-border">
        <div className="flex items-center gap-2">
          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            {typeLabel} records older than <span className="font-semibold text-foreground">{retentionPeriod} days</span> are automatically and securely deleted.
          </p>
        </div>
        <Button onClick={handleSave} size="sm" className="gap-1.5 shadow-sm shadow-primary/20" disabled={saving || loading}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Save
        </Button>
      </div>
    </div>
  );
}

export function DataRetentionTab() {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-soft">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Clock className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="font-semibold text-foreground">Data Retention Policy</h2>
          <p className="text-xs text-muted-foreground">Configure retention periods per visitor type. Records are automatically deleted after each period.</p>
        </div>
      </div>

      <Tabs defaultValue="visitor">
        <TabsList className="grid w-full grid-cols-3">
          {typeConfig.map((t) => {
            const Icon = t.icon;
            return (
              <TabsTrigger key={t.value} value={t.value} className="gap-2 text-xs">
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {typeConfig.map((t) => (
          <TabsContent key={t.value} value={t.value} className="mt-4">
            <RetentionPicker settingsKey={t.settingsKey} typeLabel={t.label} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
