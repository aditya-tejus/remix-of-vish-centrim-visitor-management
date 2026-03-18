import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link2, Zap, FileCheck, Bell, Save, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function IntegrationTab() {
  const [enabled, setEnabled] = useState(false);
  const [approvalMode, setApprovalMode] = useState<"auto" | "draft" | "notify">("draft");
  const [notifyMethod, setNotifyMethod] = useState<"email" | "inapp" | "both">("both");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("settings")
        .select("key, value")
        .in("key", ["integration_enabled", "integration_approval_mode", "integration_notify_method"]);
      
      (data || []).forEach((s: any) => {
        if (s.key === "integration_enabled") setEnabled(s.value === "true");
        if (s.key === "integration_approval_mode") setApprovalMode(s.value as any);
        if (s.key === "integration_notify_method") setNotifyMethod(s.value as any);
      });
      setLoading(false);
    };
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const settings = [
      { key: "integration_enabled", value: String(enabled) },
      { key: "integration_approval_mode", value: approvalMode },
      { key: "integration_notify_method", value: notifyMethod },
    ];
    
    for (const s of settings) {
      await supabase.from("settings").upsert({ key: s.key, value: s.value, updated_at: new Date().toISOString() }, { onConflict: "key" });
    }
    
    toast.success("Integration settings saved");
    setSaving(false);
  };

  if (loading) return <div className="text-sm text-muted-foreground p-4">Loading...</div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Link2 className="h-4 w-4 text-primary" />
                Clinical System Integration
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Connect to external clinical systems like Leecare, AlayaCare, or custom APIs.
              </CardDescription>
            </div>
            <Badge variant={enabled ? "default" : "secondary"} className="text-[10px]">
              {enabled ? "Connected" : "Disabled"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable toggle */}
          <div className="flex items-center justify-between rounded-xl border border-border p-4">
            <div className="space-y-1">
              <Label className="text-sm font-semibold">Enable Integration</Label>
              <p className="text-xs text-muted-foreground">
                Allow external clinical systems to send resident checkout records to this facility.
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <div className={enabled ? "" : "opacity-40 pointer-events-none"}>
            {/* Connected system info */}
            <div className="rounded-xl border border-border p-4 mb-6 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">Connected System</span>
                <Badge variant="outline" className="text-[10px]">Leecare</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">Last Sync</span>
                <span className="text-xs text-foreground">No sync yet</span>
              </div>
            </div>

            {/* Approval Mode */}
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-semibold">Approval Mode</Label>
                <p className="text-xs text-muted-foreground mt-0.5">How should imported records be handled?</p>
              </div>

              <RadioGroup value={approvalMode} onValueChange={(v) => setApprovalMode(v as any)} className="space-y-3">
                <div className="flex items-start gap-3 rounded-xl border border-border p-4 hover:border-primary/30 transition-colors">
                  <RadioGroupItem value="auto" id="auto" className="mt-0.5" />
                  <div className="space-y-0.5">
                    <Label htmlFor="auto" className="text-sm font-medium cursor-pointer flex items-center gap-2">
                      <Zap className="h-3.5 w-3.5 text-amber-500" />
                      Auto-accept
                    </Label>
                    <p className="text-xs text-muted-foreground">Imports become records automatically — no review required.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-xl border border-border p-4 hover:border-primary/30 transition-colors">
                  <RadioGroupItem value="draft" id="draft" className="mt-0.5" />
                  <div className="space-y-0.5">
                    <Label htmlFor="draft" className="text-sm font-medium cursor-pointer flex items-center gap-2">
                      <FileCheck className="h-3.5 w-3.5 text-primary" />
                      Draft review
                    </Label>
                    <p className="text-xs text-muted-foreground">Imports appear as drafts for staff to approve or dismiss.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-xl border border-border p-4 hover:border-primary/30 transition-colors">
                  <RadioGroupItem value="notify" id="notify" className="mt-0.5" />
                  <div className="space-y-0.5">
                    <Label htmlFor="notify" className="text-sm font-medium cursor-pointer flex items-center gap-2">
                      <Bell className="h-3.5 w-3.5 text-info" />
                      Notify only
                    </Label>
                    <p className="text-xs text-muted-foreground">No record created — staff are notified only.</p>
                  </div>
                </div>
              </RadioGroup>
            </div>

            {/* Notification method */}
            <div className="space-y-3 mt-6">
              <Label className="text-sm font-semibold">Notification Method</Label>
              <Select value={notifyMethod} onValueChange={(v) => setNotifyMethod(v as any)}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="inapp">In-app</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Save */}
            <div className="flex justify-end pt-4">
              <Button onClick={handleSave} disabled={saving} className="gap-1.5">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Integration Settings
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
