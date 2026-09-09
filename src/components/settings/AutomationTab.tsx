/**
 * NOT IN USE (Phase 7E).
 *
 * This screen is not reachable from Settings. Its controls are covered by the
 * per-visitor-type screens that Settings does show, so keeping it visible would
 * mean the same decision existed in two places. The file is kept, unchanged in
 * behaviour, so nothing is lost if a control here still needs a home.
 */
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Zap, Save, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function AutomationTab() {
  const { toast } = useToast();
  const [autoCheckoutEnabled, setAutoCheckoutEnabled] = useState(false);
  const [autoCheckoutTime, setAutoCheckoutTime] = useState("22:00");
  const [autoCheckoutScope, setAutoCheckoutScope] = useState("visitors_only");
  const [dataCleanupEnabled, setDataCleanupEnabled] = useState(false);
  const [cleanupDays, setCleanupDays] = useState("90");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("settings")
      .select("key, value")
      .in("key", ["auto_checkout_enabled", "auto_checkout_time", "auto_checkout_scope", "data_cleanup_enabled", "data_cleanup_days"])
      .then(({ data }) => {
        if (data) {
          const map: Record<string, string> = {};
          data.forEach((r) => { map[r.key] = r.value; });
          setAutoCheckoutEnabled(map.auto_checkout_enabled === "true");
          setAutoCheckoutTime(map.auto_checkout_time || "22:00");
          setAutoCheckoutScope(map.auto_checkout_scope || "visitors_only");
          setDataCleanupEnabled(map.data_cleanup_enabled === "true");
          setCleanupDays(map.data_cleanup_days || "90");
        }
      });
  }, []);

  const save = async () => {
    setSaving(true);
    const settings = [
      { key: "auto_checkout_enabled", value: autoCheckoutEnabled ? "true" : "false" },
      { key: "auto_checkout_time", value: autoCheckoutTime },
      { key: "auto_checkout_scope", value: autoCheckoutScope },
      { key: "data_cleanup_enabled", value: dataCleanupEnabled ? "true" : "false" },
      { key: "data_cleanup_days", value: cleanupDays },
    ];
    for (const s of settings) {
      await supabase.from("settings").upsert(s, { onConflict: "key" });
    }
    toast({ title: "Automation settings saved" });
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" /> Automation
          </CardTitle>
          <CardDescription className="text-xs">Configure automatic actions for check-out, data cleanup, and scheduled tasks.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Auto-checkout */}
          <div className="rounded-lg border border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Auto Check-Out</p>
                <p className="text-xs text-muted-foreground">Automatically check out remaining visitors at a set time each day</p>
              </div>
              <Switch checked={autoCheckoutEnabled} onCheckedChange={setAutoCheckoutEnabled} />
            </div>
            {autoCheckoutEnabled && (
              <div className="grid grid-cols-2 gap-3 pl-1">
                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1"><Clock className="h-3 w-3" /> Check-out time</Label>
                  <Input type="time" value={autoCheckoutTime} onChange={(e) => setAutoCheckoutTime(e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Scope</Label>
                  <Select value={autoCheckoutScope} onValueChange={setAutoCheckoutScope}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="visitors_only">Visitors only</SelectItem>
                      <SelectItem value="visitors_contractors">Visitors & Contractors</SelectItem>
                      <SelectItem value="all">All person types</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          {/* Data cleanup */}
          <div className="rounded-lg border border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Data Cleanup</p>
                <p className="text-xs text-muted-foreground">Automatically anonymise or remove old visitor data after a retention period</p>
              </div>
              <Switch checked={dataCleanupEnabled} onCheckedChange={setDataCleanupEnabled} />
            </div>
            {dataCleanupEnabled && (
              <div className="flex items-center gap-2 pl-1">
                <Label className="text-xs text-muted-foreground">Retain data for:</Label>
                <Input type="number" value={cleanupDays} onChange={(e) => setCleanupDays(e.target.value)}
                  className="w-20 h-8 text-sm" min={7} />
                <span className="text-xs text-muted-foreground">days</span>
              </div>
            )}
          </div>

          <Button onClick={save} disabled={saving} className="gap-1.5">
            <Save className="h-3.5 w-3.5" /> {saving ? "Saving..." : "Save Changes"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
