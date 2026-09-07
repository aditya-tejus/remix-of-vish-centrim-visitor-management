import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { KeyRound } from "lucide-react";
import { DEFAULT_KEY_POLICY, fetchKeyPolicy, KeyPolicy } from "@/hooks/useKeyPolicy";

const LOAN_OPTIONS = [
  { value: "none", label: "No default — staff set it each time" },
  { value: "2h", label: "2 hours" },
  { value: "eod", label: "End of day (5:00 pm)" },
  { value: "24h", label: "24 hours" },
  { value: "7d", label: "7 days" },
];

const ENFORCEMENT_OPTIONS = [
  { value: "off", label: "Do nothing" },
  { value: "warn", label: "Warn staff, allow entry" },
  { value: "block", label: "Stop check-in until it's returned or renewed" },
];

export function KeysPolicyTab() {
  const { toast } = useToast();
  const [policy, setPolicy] = useState<KeyPolicy>(DEFAULT_KEY_POLICY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchKeyPolicy().then(setPolicy);
  }, []);

  const save = async () => {
    setSaving(true);
    const rows = [
      { key: "key_default_loan_period", value: policy.defaultLoanPeriod },
      { key: "key_overdue_grace_minutes", value: String(policy.graceMinutes || 0) },
      { key: "key_overdue_enforcement", value: policy.enforcement },
      { key: "key_renew_role", value: policy.renewRole },
      { key: "key_permanent_allowed", value: policy.permanentAllowed ? "true" : "false" },
    ];
    const { error } = await supabase.from("settings").upsert(rows, { onConflict: "key" });
    if (!error) {
      await supabase.from("audit_log").insert({
        action: "settings_updated",
        details: { section: "keys_and_fobs", ...Object.fromEntries(rows.map((r) => [r.key, r.value])) } as any,
        records_affected: rows.length,
        performed_by: "admin",
      });
    }
    setSaving(false);
    toast(
      error
        ? { title: "Could not save", description: error.message, variant: "destructive" }
        : { title: "Key & fob policy saved" }
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/40">
        <KeyRound className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Applies to everything on the Keys Register — keys, access fobs and swipe cards. A resident's own key or fob can
          be recorded as <strong>permanent</strong>; permanent holdings never go overdue and never stop anyone entering.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label>Default loan period</Label>
        <Select
          value={policy.defaultLoanPeriod}
          onValueChange={(v) => setPolicy({ ...policy, defaultLoanPeriod: v as KeyPolicy["defaultLoanPeriod"] })}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {LOAN_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">Pre-fills the due-back time when something is handed over.</p>
      </div>

      <div className="space-y-1.5">
        <Label>Grace period before it counts as overdue</Label>
        <div className="flex items-center gap-2">
          <Input
            className="w-24"
            inputMode="numeric"
            value={String(policy.graceMinutes)}
            onChange={(e) => setPolicy({ ...policy, graceMinutes: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 })}
          />
          <span className="text-sm text-muted-foreground">minutes</span>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>When someone arriving already holds an overdue key or fob</Label>
        <Select
          value={policy.enforcement}
          onValueChange={(v) => setPolicy({ ...policy, enforcement: v as KeyPolicy["enforcement"] })}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {ENFORCEMENT_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Staff can always override a block with a written reason, which is saved to the audit trail.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label>Who can extend a due-back date</Label>
        <Select
          value={policy.renewRole}
          onValueChange={(v) => setPolicy({ ...policy, renewRole: v as KeyPolicy["renewRole"] })}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any staff member</SelectItem>
            <SelectItem value="admin">Administrators only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">Allow permanent holdings</p>
          <p className="text-xs text-muted-foreground">For residents who keep their own key or fob indefinitely</p>
        </div>
        <Switch
          checked={policy.permanentAllowed}
          onCheckedChange={(v) => setPolicy({ ...policy, permanentAllowed: v })}
        />
      </div>

      <Button size="sm" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
    </div>
  );
}
