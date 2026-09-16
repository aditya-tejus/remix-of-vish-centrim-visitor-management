import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AutoCheckoutRuleCard } from "@/components/settings/AutoCheckoutRuleCard";
import { supportsAutoCheckout } from "@/lib/autoCheckout";

interface Props {
  personType: string;
}

export function AutomationSettingsPerType({ personType }: Props) {
  const { toast } = useToast();
  const [dataCleanup, setDataCleanup] = useState(false);
  const [cleanupDays, setCleanupDays] = useState("60");
  const [saving, setSaving] = useState(false);

  const prefix = personType;

  useEffect(() => {
    supabase
      .from("settings")
      .select("key, value")
      .in("key", [
        `data_cleanup_enabled_${prefix}`, `data_cleanup_days_${prefix}`,
        "data_cleanup_enabled", "data_cleanup_days",
      ])
      .then(({ data }) => {
        if (data) {
          const map: Record<string, string> = {};
          data.forEach((r) => { map[r.key] = r.value; });
          setDataCleanup((map[`data_cleanup_enabled_${prefix}`] ?? map.data_cleanup_enabled ?? "false") === "true");
          setCleanupDays(map[`data_cleanup_days_${prefix}`] ?? map.data_cleanup_days ?? "60");
        }
      });
  }, [personType]);

  const save = async () => {
    setSaving(true);
    const settings = [
      { key: `data_cleanup_enabled_${prefix}`, value: dataCleanup ? "true" : "false" },
      { key: `data_cleanup_days_${prefix}`, value: cleanupDays },
    ];
    for (const s of settings) {
      await supabase.from("settings").upsert(s, { onConflict: "key" });
    }
    toast({ title: "Automation settings saved" });
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Auto Check-Out</p>
            <p className="text-xs text-muted-foreground">Automatically check out after a set period</p>
          </div>
          <Switch checked={autoCheckout} onCheckedChange={setAutoCheckout} />
        </div>
        {autoCheckout && (
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">After</label>
            <Select value={autoCheckoutHours} onValueChange={setAutoCheckoutHours}>
              <SelectTrigger className="h-8 w-24 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="4">4 hours</SelectItem>
                <SelectItem value="8">8 hours</SelectItem>
                <SelectItem value="12">12 hours</SelectItem>
                <SelectItem value="24">24 hours</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Data Cleanup</p>
            <p className="text-xs text-muted-foreground">Auto-delete records after retention period</p>
          </div>
          <Switch checked={dataCleanup} onCheckedChange={setDataCleanup} />
        </div>
        {dataCleanup && (
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">Retention</label>
            <Select value={cleanupDays} onValueChange={setCleanupDays}>
              <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 days</SelectItem>
                <SelectItem value="60">60 days</SelectItem>
                <SelectItem value="90">90 days</SelectItem>
                <SelectItem value="180">180 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <Button onClick={save} disabled={saving} size="sm" className="gap-1.5">
        <Save className="h-3.5 w-3.5" /> {saving ? "Saving..." : "Save"}
      </Button>
    </div>
  );
}
