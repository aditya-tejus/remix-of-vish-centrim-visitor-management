import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Lock, Save, ShieldCheck, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { PermissionMatrixCard } from "@/components/settings/PermissionMatrixCard";

const lockableSections = [
  { key: "lock_presence", label: "Presence", description: "Jurisdiction and person type settings" },
  { key: "lock_terms", label: "Terms & Conditions", description: "Legal documents and terms" },
  { key: "lock_alerts", label: "Alerts", description: "Alert thresholds and recipients" },
  { key: "lock_automation", label: "Automation", description: "Auto check-out and data cleanup" },
  { key: "lock_printing", label: "Printing", description: "Badge printing configuration" },
  { key: "lock_profiles", label: "Profiles & Badges", description: "Photo and signature settings" },
  { key: "lock_resident_leave", label: "Resident Leave", description: "Leave types and approval settings" },
  { key: "lock_gdpr", label: "GDPR & Compliance", description: "Data protection settings" },
];

export function LockGovernanceTab() {
  const { toast } = useToast();
  const [locks, setLocks] = useState<Record<string, boolean>>({});
  const [requireChangeReason, setRequireChangeReason] = useState(true);
  const [auditSettingsChanges, setAuditSettingsChanges] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const keys = [...lockableSections.map(s => s.key), "require_change_reason", "audit_settings_changes"];
    supabase
      .from("settings")
      .select("key, value")
      .in("key", keys)
      .then(({ data }) => {
        if (data) {
          const map: Record<string, string> = {};
          data.forEach((r) => { map[r.key] = r.value; });
          const lockState: Record<string, boolean> = {};
          lockableSections.forEach((s) => { lockState[s.key] = map[s.key] === "true"; });
          setLocks(lockState);
          setRequireChangeReason(map.require_change_reason !== "false");
          setAuditSettingsChanges(map.audit_settings_changes !== "false");
        }
      });
  }, []);

  const toggleLock = (key: string) => {
    setLocks((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const save = async () => {
    setSaving(true);
    const settings = [
      ...lockableSections.map((s) => ({ key: s.key, value: locks[s.key] ? "true" : "false" })),
      { key: "require_change_reason", value: requireChangeReason ? "true" : "false" },
      { key: "audit_settings_changes", value: auditSettingsChanges ? "true" : "false" },
    ];
    for (const s of settings) {
      await supabase.from("settings").upsert(s, { onConflict: "key" });
    }
    toast({ title: "Governance settings saved" });
    setSaving(false);
  };

  const lockedCount = Object.values(locks).filter(Boolean).length;

  return (
    <div className="space-y-6">
      <PermissionMatrixCard />
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="h-4 w-4 text-primary" /> Lock & Governance
          </CardTitle>
          <CardDescription className="text-xs">Lock settings sections to prevent changes without admin override. Configure audit requirements for all settings changes.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Governance policies */}
          <div className="rounded-lg border border-border p-4 space-y-3">
            <p className="text-sm font-medium text-foreground flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5" /> Governance Policies
            </p>
            <div className="flex items-center justify-between py-1">
              <div>
                <p className="text-xs font-medium text-foreground">Require change reason</p>
                <p className="text-[10px] text-muted-foreground">Every settings change must include a reason for the change</p>
              </div>
              <Switch checked={requireChangeReason} onCheckedChange={setRequireChangeReason} />
            </div>
            <div className="flex items-center justify-between py-1">
              <div>
                <p className="text-xs font-medium text-foreground">Audit all settings changes</p>
                <p className="text-[10px] text-muted-foreground">Write to audit log on every settings save. If log write fails, the change is rolled back.</p>
              </div>
              <Switch checked={auditSettingsChanges} onCheckedChange={setAuditSettingsChanges} />
            </div>
          </div>

          {/* Lockable sections */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">Section Locks</p>
              <Badge variant="secondary" className="text-[10px]">
                {lockedCount} of {lockableSections.length} locked
              </Badge>
            </div>
            <div className="space-y-1.5">
              {lockableSections.map((section) => (
                <div key={section.key} className={`rounded-lg border p-3 flex items-center justify-between transition-colors ${
                  locks[section.key] ? "border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20" : "border-border"
                }`}>
                  <div className="flex items-center gap-2.5">
                    {locks[section.key] ? (
                      <Lock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                    ) : (
                      <div className="h-3.5 w-3.5" />
                    )}
                    <div>
                      <p className="text-xs font-medium text-foreground">{section.label}</p>
                      <p className="text-[10px] text-muted-foreground">{section.description}</p>
                    </div>
                  </div>
                  <Switch checked={locks[section.key] || false} onCheckedChange={() => toggleLock(section.key)} />
                </div>
              ))}
            </div>
          </div>

          {lockedCount > 0 && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Locked sections require admin override</p>
                <p className="text-[10px] text-amber-600 dark:text-amber-500 mt-0.5">Changes to locked sections will require an admin to provide an override reason before saving.</p>
              </div>
            </div>
          )}

          <Button onClick={save} disabled={saving} className="gap-1.5">
            <Save className="h-3.5 w-3.5" /> {saving ? "Saving..." : "Save Changes"}
          </Button>
        </CardContent>
      </Card>
    </div>
    </div>
  );
}
