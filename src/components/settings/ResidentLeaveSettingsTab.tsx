import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { DoorOpen, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LeaveTypesTab } from "./LeaveTypesTab";

export function ResidentLeaveSettingsTab() {
  const { toast } = useToast();
  const [globalNameSearchEnabled, setGlobalNameSearchEnabled] = useState(false);
  const [requireApproval, setRequireApproval] = useState(false);
  const [defaultReturnHours, setDefaultReturnHours] = useState("4");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("settings")
      .select("key, value")
      .in("key", ["leave_global_name_search", "leave_require_approval", "leave_default_return_hours"])
      .then(({ data }) => {
        if (data) {
          const map: Record<string, string> = {};
          data.forEach((r) => { map[r.key] = r.value; });
          setGlobalNameSearchEnabled(map.leave_global_name_search === "true");
          setRequireApproval(map.leave_require_approval === "true");
          setDefaultReturnHours(map.leave_default_return_hours || "4");
        }
      });
  }, []);

  const save = async () => {
    setSaving(true);
    const settings = [
      { key: "leave_global_name_search", value: globalNameSearchEnabled ? "true" : "false" },
      { key: "leave_require_approval", value: requireApproval ? "true" : "false" },
      { key: "leave_default_return_hours", value: defaultReturnHours },
    ];
    for (const s of settings) {
      await supabase.from("settings").upsert(s, { onConflict: "key" });
    }
    toast({ title: "Resident Leave settings saved" });
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <DoorOpen className="h-4 w-4 text-primary" /> Resident Leave Settings
          </CardTitle>
          <CardDescription className="text-xs">Configure how resident leave requests are handled.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Global Resident Name Search</p>
                <p className="text-xs text-muted-foreground">Allow searching all residents by name on kiosk. OFF by default for privacy.</p>
              </div>
              <Switch checked={globalNameSearchEnabled} onCheckedChange={setGlobalNameSearchEnabled} />
            </div>
          </div>

          <div className="rounded-lg border border-border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Require Approval</p>
                <p className="text-xs text-muted-foreground">Leave requests require staff approval before resident can depart</p>
              </div>
              <Switch checked={requireApproval} onCheckedChange={setRequireApproval} />
            </div>
          </div>

          <div className="rounded-lg border border-border p-4 space-y-2">
            <p className="text-sm font-medium text-foreground">Default Return Time</p>
            <p className="text-xs text-muted-foreground">Default expected return period from departure</p>
            <div className="flex items-center gap-2">
              <Input type="number" value={defaultReturnHours} onChange={(e) => setDefaultReturnHours(e.target.value)}
                className="w-20 h-8 text-sm" min={1} />
              <span className="text-xs text-muted-foreground">hours</span>
            </div>
          </div>

          <Button onClick={save} disabled={saving} className="gap-1.5">
            <Save className="h-3.5 w-3.5" /> {saving ? "Saving..." : "Save Changes"}
          </Button>
        </CardContent>
      </Card>

      <LeaveTypesTab />
    </div>
  );
}