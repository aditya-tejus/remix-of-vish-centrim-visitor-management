import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { Shield, Save, Play } from "lucide-react";

interface Notice {
  id?: string;
  controller_name: string;
  controller_contact: string;
  privacy_contact: string;
  notice_url: string;
  notice_text: string;
  notice_version: string;
  jurisdiction: string;
  data_categories: string;
}

interface Policy {
  id: string;
  record_class: string;
  retention_value: number | null;
  retention_unit: string;
  mode: string;
  is_enabled: boolean;
  exception_reason: string | null;
}

const CLASS_LABELS: Record<string, string> = {
  person_identity: "Person identity",
  visit: "Visits",
  screening_answers: "Check-in question answers",
  contractor_credentials: "Contractor documents",
  food_register: "Food register",
  emergency_event: "Emergency events",
  badge_qr: "Badges and QR codes",
  key_history: "Key and fob history",
  audit_log: "Audit log",
};

const AUTOMATED = ["visit", "food_register"];

/** What actually happens today for each record class. No legal periods are supplied. */
const HANDLING: Record<string, { label: string; tone: string }> = {
  visit: { label: "Automated clean-up available", tone: "bg-success/10 text-success border-success/30" },
  food_register: { label: "Automated clean-up available", tone: "bg-success/10 text-success border-success/30" },
  person_identity: { label: "Manual process only", tone: "bg-warning/10 text-warning border-warning/30" },
  screening_answers: { label: "Manual process only", tone: "bg-warning/10 text-warning border-warning/30" },
  contractor_credentials: { label: "Manual process only", tone: "bg-warning/10 text-warning border-warning/30" },
  emergency_event: { label: "Not supported yet — kept as a safety record", tone: "bg-muted text-muted-foreground border-border" },
  badge_qr: { label: "Manual process only", tone: "bg-warning/10 text-warning border-warning/30" },
  key_history: { label: "Manual process only", tone: "bg-warning/10 text-warning border-warning/30" },
  audit_log: { label: "Not supported yet — audit records are never auto-removed", tone: "bg-muted text-muted-foreground border-border" },
};

const emptyNotice: Notice = {
  controller_name: "", controller_contact: "", privacy_contact: "",
  notice_url: "", notice_text: "", notice_version: "v1", jurisdiction: "", data_categories: "",
};

/** Site privacy notice details and per-record-class retention. No legal periods are pre-set. */
export function PrivacyRetentionCard() {
  const { toast } = useToast();
  const { can } = usePermissions();
  const editable = can("privacy.manage");

  const [notice, setNotice] = useState<Notice>(emptyNotice);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState<string | null>(null);

  const load = async () => {
    const [{ data: n }, { data: p }] = await Promise.all([
      supabase.from("privacy_notices" as any).select("*").is("branch_id", null).limit(1),
      supabase.from("retention_policies" as any).select("*").is("branch_id", null).order("record_class"),
    ]);
    const row = (n as any[])?.[0];
    if (row) {
      setNotice({
        id: row.id,
        controller_name: row.controller_name || "",
        controller_contact: row.controller_contact || "",
        privacy_contact: row.privacy_contact || "",
        notice_url: row.notice_url || "",
        notice_text: row.notice_text || "",
        notice_version: row.notice_version || "v1",
        jurisdiction: row.jurisdiction || "",
        data_categories: Array.isArray(row.data_categories) ? row.data_categories.join(", ") : "",
      });
    }
    setPolicies(((p as any[]) || []) as Policy[]);
  };

  useEffect(() => { void load(); }, []);

  const saveNotice = async () => {
    setSaving(true);
    const payload = {
      branch_id: null,
      controller_name: notice.controller_name || null,
      controller_contact: notice.controller_contact || null,
      privacy_contact: notice.privacy_contact || null,
      notice_url: notice.notice_url || null,
      notice_text: notice.notice_text || null,
      notice_version: notice.notice_version || "v1",
      jurisdiction: notice.jurisdiction || null,
      data_categories: notice.data_categories
        ? notice.data_categories.split(",").map((s) => s.trim()).filter(Boolean)
        : [],
      is_active: true,
    };
    const { error } = notice.id
      ? await supabase.from("privacy_notices" as any).update(payload as any).eq("id", notice.id)
      : await supabase.from("privacy_notices" as any).insert(payload as any);
    setSaving(false);
    if (error) {
      toast({ title: "Could not save", description: error.message, variant: "destructive" });
      return;
    }
    await (supabase as any).rpc("log_audit", { _action: "privacy.notice_updated", _details: { version: payload.notice_version } });
    toast({ title: "Privacy details saved" });
    void load();
  };

  const savePolicy = async (policy: Policy) => {
    const { error } = await supabase
      .from("retention_policies" as any)
      .update({
        retention_value: policy.retention_value,
        retention_unit: policy.retention_unit,
        mode: policy.mode,
        is_enabled: policy.is_enabled,
        exception_reason: policy.exception_reason,
      } as any)
      .eq("id", policy.id);
    if (error) {
      toast({ title: "Could not save", description: error.message, variant: "destructive" });
      return;
    }
    await (supabase as any).rpc("log_audit", {
      _action: "retention.policy_updated",
      _details: { record_class: policy.record_class, value: policy.retention_value, unit: policy.retention_unit, mode: policy.mode, enabled: policy.is_enabled },
    });
    toast({ title: `${CLASS_LABELS[policy.record_class]} retention saved` });
  };

  const runNow = async (policy: Policy) => {
    setRunning(policy.record_class);
    const { data, error } = await (supabase as any).rpc("run_retention", { p_record_class: policy.record_class });
    setRunning(null);
    if (error) {
      toast({ title: "Retention did not run", description: error.message, variant: "destructive" });
      return;
    }
    const row = (data as any[])?.[0];
    toast({
      title: "Retention run recorded",
      description: `${row?.affected ?? 0} records handled, ${row?.skipped ?? 0} skipped because they are on legal hold.`,
    });
  };

  const update = (id: string, patch: Partial<Policy>) =>
    setPolicies((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Shield className="h-4 w-4 text-primary" /> Privacy notice details</CardTitle>
          <CardDescription>
            Shown to people when they check in and recorded with every acknowledgement, including the version they saw.
            {!editable && " You can view these but not change them."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Who holds the data</Label>
            <Input disabled={!editable} value={notice.controller_name} onChange={(e) => setNotice({ ...notice, controller_name: e.target.value })} placeholder="Organisation name" />
          </div>
          <div className="space-y-1.5">
            <Label>Contact for that organisation</Label>
            <Input disabled={!editable} value={notice.controller_contact} onChange={(e) => setNotice({ ...notice, controller_contact: e.target.value })} placeholder="Email or phone" />
          </div>
          <div className="space-y-1.5">
            <Label>Privacy contact</Label>
            <Input disabled={!editable} value={notice.privacy_contact} onChange={(e) => setNotice({ ...notice, privacy_contact: e.target.value })} placeholder="Privacy officer or DPO" />
          </div>
          <div className="space-y-1.5">
            <Label>Full privacy notice link</Label>
            <Input disabled={!editable} value={notice.notice_url} onChange={(e) => setNotice({ ...notice, notice_url: e.target.value })} placeholder="https://…" />
          </div>
          <div className="space-y-1.5">
            <Label>Notice version</Label>
            <Input disabled={!editable} value={notice.notice_version} onChange={(e) => setNotice({ ...notice, notice_version: e.target.value })} placeholder="v1" />
          </div>
          <div className="space-y-1.5">
            <Label>Information collected</Label>
            <Input disabled={!editable} value={notice.data_categories} onChange={(e) => setNotice({ ...notice, data_categories: e.target.value })} placeholder="Name, phone, who they are visiting" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Short notice shown on screen</Label>
            <Textarea disabled={!editable} rows={3} value={notice.notice_text} onChange={(e) => setNotice({ ...notice, notice_text: e.target.value })} />
          </div>
          {editable && (
            <div className="sm:col-span-2">
              <Button onClick={saveNotice} disabled={saving} className="gap-2"><Save className="h-4 w-4" /> Save privacy details</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">How long records are kept</CardTitle>
          <CardDescription>
            These rules apply to <span className="font-medium text-foreground">all sites</span> unless a site sets its own.
            Nothing is removed until you set a period and switch it on, and only the classes marked
            "Automated clean-up available" can be actioned here — the rest are a manual process you carry out yourself.
            Records on legal hold or safeguarding hold are always skipped, and every run is recorded in the audit trail.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {policies.map((p) => (
            <div key={p.id} className="rounded-xl border border-border p-3 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground">{CLASS_LABELS[p.record_class] || p.record_class}</p>
                  <Badge variant="outline" className={`text-[10px] ${HANDLING[p.record_class]?.tone || ""}`}>
                    {HANDLING[p.record_class]?.label || "Manual process only"}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">All sites</Badge>
                </div>
                <Switch disabled={!editable} checked={p.is_enabled} onCheckedChange={(v) => update(p.id, { is_enabled: v })} />
              </div>
              <div className="grid gap-2 sm:grid-cols-4">
                <Input
                  type="number" min={1} disabled={!editable}
                  value={p.retention_value ?? ""}
                  placeholder="Not set"
                  onChange={(e) => update(p.id, { retention_value: e.target.value ? Number(e.target.value) : null })}
                />
                <Select disabled={!editable} value={p.retention_unit} onValueChange={(v) => update(p.id, { retention_unit: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="days">Days</SelectItem>
                    <SelectItem value="months">Months</SelectItem>
                    <SelectItem value="years">Years</SelectItem>
                  </SelectContent>
                </Select>
                <Select disabled={!editable} value={p.mode} onValueChange={(v) => update(p.id, { mode: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="anonymise">Remove personal details</SelectItem>
                    <SelectItem value="delete">Delete the record</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  disabled={!editable}
                  value={p.exception_reason || ""}
                  placeholder="Exception reason (optional)"
                  onChange={(e) => update(p.id, { exception_reason: e.target.value })}
                />
              </div>
              {editable && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => savePolicy(p)}>Save</Button>
                  {AUTOMATED.includes(p.record_class) && (
                    <Button size="sm" variant="ghost" disabled={running === p.record_class} onClick={() => runNow(p)} className="gap-1.5">
                      <Play className="h-3.5 w-3.5" /> Run now
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
