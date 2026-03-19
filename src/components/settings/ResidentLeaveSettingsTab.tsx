import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const [residentLookupMode, setResidentLookupMode] = useState<"show_all" | "search_first">("search_first");
  const [staffLookupMode, setStaffLookupMode] = useState<"search_first" | "by_department" | "free_text">("search_first");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("settings")
      .select("key, value")
      .in("key", ["leave_global_name_search", "leave_require_approval", "leave_default_return_hours", "kiosk_resident_lookup_mode", "kiosk_staff_lookup_mode"])
      .then(({ data }) => {
        if (data) {
          const map: Record<string, string> = {};
          data.forEach((r) => { map[r.key] = r.value; });
          setGlobalNameSearchEnabled(map.leave_global_name_search === "true");
          setRequireApproval(map.leave_require_approval === "true");
          setDefaultReturnHours(map.leave_default_return_hours || "4");
          if (map.kiosk_resident_lookup_mode === "show_all" || map.kiosk_resident_lookup_mode === "search_first") setResidentLookupMode(map.kiosk_resident_lookup_mode);
          if (map.kiosk_staff_lookup_mode === "search_first" || map.kiosk_staff_lookup_mode === "by_department" || map.kiosk_staff_lookup_mode === "free_text") setStaffLookupMode(map.kiosk_staff_lookup_mode);
        }
      });
  }, []);

  const save = async () => {
    setSaving(true);
    const settings = [
      { key: "leave_global_name_search", value: globalNameSearchEnabled ? "true" : "false" },
      { key: "leave_require_approval", value: requireApproval ? "true" : "false" },
      { key: "leave_default_return_hours", value: defaultReturnHours },
      { key: "kiosk_resident_lookup_mode", value: residentLookupMode },
      { key: "kiosk_staff_lookup_mode", value: staffLookupMode },
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
          <CardDescription className="text-xs">Configure how resident leave requests are handled, including self-service kiosk behaviour.</CardDescription>
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

      {/* Kiosk Lookup Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="h-4 w-4 text-primary" /> Kiosk Lookup Settings
          </CardTitle>
          <CardDescription className="text-xs">Configure how visitors find residents and staff on the self-service kiosk.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-border p-4 space-y-2">
            <p className="text-sm font-medium text-foreground">Resident Lookup Mode</p>
            <p className="text-xs text-muted-foreground">How residents are displayed when a visitor selects "Resident" on the kiosk check-in.</p>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setResidentLookupMode("show_all")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  residentLookupMode === "show_all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-primary/10"
                }`}
              >
                Show All
              </button>
              <button
                onClick={() => setResidentLookupMode("search_first")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  residentLookupMode === "search_first" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-primary/10"
                }`}
              >
                Search First (3+ chars)
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-border p-4 space-y-2">
            <p className="text-sm font-medium text-foreground">Staff Lookup Mode</p>
            <p className="text-xs text-muted-foreground">How staff members are displayed when a visitor selects "Staff" on the kiosk check-in.</p>
            <div className="flex gap-2 pt-1 flex-wrap">
              <button
                onClick={() => setStaffLookupMode("search_first")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  staffLookupMode === "search_first" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-primary/10"
                }`}
              >
                Search First
              </button>
              <button
                onClick={() => setStaffLookupMode("by_department")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  staffLookupMode === "by_department" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-primary/10"
                }`}
              >
                Group by Department
              </button>
              <button
                onClick={() => setStaffLookupMode("free_text")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  staffLookupMode === "free_text" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-primary/10"
                }`}
              >
                Free Text Only
              </button>
            </div>
          </div>

          <Button onClick={save} disabled={saving} className="gap-1.5">
            <Save className="h-3.5 w-3.5" /> {saving ? "Saving..." : "Save Changes"}
          </Button>
        </CardContent>
      </Card>

      {/* Leave Types management */}
      <LeaveTypesTab />
    </div>
  );
}
