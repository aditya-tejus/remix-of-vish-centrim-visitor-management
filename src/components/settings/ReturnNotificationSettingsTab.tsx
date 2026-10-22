import { useState, useEffect, useMemo } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Plus, Save, Loader2, Building2, Users, Mail, CheckCircle2, ShieldAlert, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useStaffMembers } from "@/hooks/useStaffMembers";
import {
  ReturnNotificationPolicy,
  ReturnNotifRecipient,
  defaultReturnPolicy,
  policyFromRow,
  policyToRow,
} from "@/hooks/useReturnNotificationPolicy";

interface Branch {
  id: string;
  name: string;
}

const ALL_SITES = "__all__";

const GRACE_OPTIONS = [
  { value: 15, label: "15 minutes" },
  { value: 30, label: "30 minutes" },
  { value: 60, label: "1 hour" },
  { value: 120, label: "2 hours" },
  { value: 240, label: "4 hours" },
];

const ESCALATION_OPTIONS = [
  { value: 0, label: "No escalation" },
  { value: 30, label: "30 minutes after first alert" },
  { value: 60, label: "1 hour after first alert" },
  { value: 120, label: "2 hours after first alert" },
];

function graceLabel(mins: number) {
  return GRACE_OPTIONS.find((o) => o.value === mins)?.label ?? `${mins} minutes`;
}

// ─── Reusable email + staff input section ─────────────────────────
function RecipientSection({
  label,
  description,
  staff,
  emails,
  onAddStaff,
  onRemoveStaff,
  onAddEmail,
  onRemoveEmail,
}: {
  label: string;
  description: string;
  staff: ReturnNotifRecipient[];
  emails: string[];
  onAddStaff: (s: ReturnNotifRecipient) => void;
  onRemoveStaff: (id: string) => void;
  onAddEmail: (e: string) => void;
  onRemoveEmail: (e: string) => void;
}) {
  const { staff: available, loading: staffLoading } = useStaffMembers();
  const [staffSearch, setStaffSearch] = useState("");
  const [staffOpen, setStaffOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailError, setEmailError] = useState("");

  const selectedIds = new Set(staff.map((s) => s.id));
  const activeIds = new Set(available.map((s) => s.id));
  const q = staffSearch.toLowerCase();
  const filtered = available
    .filter(
      (s) =>
        !selectedIds.has(s.id) &&
        (s.name.toLowerCase().includes(q) ||
          (s.role || "").toLowerCase().includes(q) ||
          (s.department || "").toLowerCase().includes(q))
    )
    .slice(0, 8);

  const handleAddEmail = () => {
    const trimmed = newEmail.trim();
    if (!trimmed) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError("Enter a valid email address");
      return;
    }
    if (emails.includes(trimmed)) {
      setEmailError("Already added");
      return;
    }
    setEmailError("");
    onAddEmail(trimmed);
    setNewEmail("");
  };

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>

      {/* Staff search */}
      <div className="relative">
        <Input
          placeholder={staffLoading ? "Loading staff..." : "Search staff name, role or department..."}
          value={staffSearch}
          onChange={(e) => { setStaffSearch(e.target.value); setStaffOpen(true); }}
          onFocus={() => setStaffOpen(true)}
          onBlur={() => setTimeout(() => setStaffOpen(false), 200)}
          className="pr-8 h-9 text-sm"
        />
        <Users className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        {staffOpen && filtered.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-20 max-h-48 overflow-y-auto">
            {filtered.map((s) => (
              <button
                key={s.id}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { onAddStaff({ id: s.id, name: s.name, role: s.role }); setStaffSearch(""); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/50 transition-colors"
              >
                <span className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-semibold shrink-0">
                  {s.name.split(" ").map((n) => n[0]).join("")}
                </span>
                <div>
                  <p className="text-sm font-medium text-foreground">{s.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {s.role}{s.department ? ` • ${s.department}` : ""}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
        {staffOpen && !staffLoading && available.length === 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-20 px-3 py-2 text-xs text-muted-foreground">
            No staff records yet — add staff first, or use an email address below.
          </div>
        )}
      </div>

      {staff.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {staff.map((s) => {
            const inactive = !staffLoading && !activeIds.has(s.id);
            return (
              <Badge
                key={s.id}
                variant={inactive ? "outline" : "secondary"}
                className={`gap-1 text-xs pl-1 pr-1.5 py-0.5 ${inactive ? "border-destructive/40 text-destructive" : ""}`}
              >
                <span className="h-5 w-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[9px] font-semibold">
                  {s.name.split(" ").map((n) => n[0]).join("")}
                </span>
                {s.name}
                {inactive && <span className="text-[10px]">(no longer active — replace)</span>}
                <button onClick={() => onRemoveStaff(s.id)} className="text-muted-foreground hover:text-destructive ml-0.5">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}

      {/* Email input */}
      <div className="flex gap-2">
        <Input
          placeholder="email@example.com"
          value={newEmail}
          onChange={(e) => { setNewEmail(e.target.value); setEmailError(""); }}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddEmail())}
          className={`flex-1 h-9 text-sm ${emailError ? "border-destructive" : ""}`}
        />
        <Button variant="outline" size="sm" onClick={handleAddEmail} disabled={!newEmail.trim()} className="gap-1 h-9">
          <Plus className="h-3 w-3" /> Add
        </Button>
      </div>
      {emailError && <p className="text-xs text-destructive">{emailError}</p>}

      {emails.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {emails.map((email) => (
            <Badge key={email} variant="secondary" className="gap-1 text-xs">
              <Mail className="h-3 w-3 text-muted-foreground" />
              {email}
              <button onClick={() => onRemoveEmail(email)} className="text-muted-foreground hover:text-destructive ml-0.5">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────
export function ReturnNotificationSettingsTab() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>(ALL_SITES);
  const [settings, setSettings] = useState<ReturnNotificationPolicy | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState("");
  const [allSettings, setAllSettings] = useState<Record<string, ReturnNotificationPolicy>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: branchData } = await supabase.from("branches").select("*").eq("is_active", true).order("name");
      const list = (branchData || []) as Branch[];
      setBranches(list);

      const { data: settingsData } = await supabase.from("branch_notification_settings").select("*");
      const map: Record<string, ReturnNotificationPolicy> = {};
      (settingsData || []).forEach((row: any) => {
        const p = policyFromRow(row);
        map[p.branchId ?? ALL_SITES] = p;
      });
      setAllSettings(map);

      const initial = map[ALL_SITES] || defaultReturnPolicy(null);
      setSelectedKey(ALL_SITES);
      setSettings(initial);
      setSavedSnapshot(JSON.stringify(initial));
      setLoading(false);
    };
    load();
  }, []);

  const handleScopeChange = (key: string) => {
    setSelectedKey(key);
    const s = allSettings[key] || defaultReturnPolicy(key === ALL_SITES ? null : key);
    setSettings(s);
    setSavedSnapshot(JSON.stringify(s));
  };

  const hasChanges = useMemo(() => {
    if (!settings) return false;
    return JSON.stringify(settings) !== savedSnapshot;
  }, [settings, savedSnapshot]);

  const update = (patch: Partial<ReturnNotificationPolicy>) => {
    setSettings((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const scopeName =
    selectedKey === ALL_SITES ? "All sites" : branches.find((b) => b.id === selectedKey)?.name || "Branch";

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    const payload = policyToRow(settings);

    let savedId = settings.id;
    if (settings.id) {
      const { error } = await supabase.from("branch_notification_settings").update(payload).eq("id", settings.id);
      if (error) { toast.error("Failed to save"); setSaving(false); return; }
    } else {
      const { data, error } = await supabase.from("branch_notification_settings").insert(payload).select().single();
      if (error) { toast.error("Failed to save"); setSaving(false); return; }
      savedId = (data as any)?.id;
    }

    const updated = { ...settings, id: savedId };
    setSettings(updated);
    setAllSettings((prev) => ({ ...prev, [selectedKey]: updated }));
    setSavedSnapshot(JSON.stringify(updated));

    await supabase.from("audit_log").insert({
      action: "settings_updated",
      performed_by: "Settings",
      change_reason: `Resident return notifications updated for ${scopeName}`,
      details: payload as any,
      records_affected: 1,
    });

    toast.success(`Settings saved for ${scopeName}`);
    setSaving(false);
  };

  if (loading) return <div className="text-sm text-muted-foreground p-4">Loading...</div>;


  return (
    <div className="space-y-5">
      {/* Scope selector */}
      {branches.length > 0 ? (
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground font-medium">Applies to:</span>
          <Select value={selectedKey} onValueChange={handleScopeChange}>
            <SelectTrigger className="w-56 h-9">
              <Building2 className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_SITES}>All sites</SelectItem>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <div className="flex items-start gap-2 rounded-xl border border-border bg-muted/20 px-4 py-3">
          <Building2 className="h-4 w-4 text-muted-foreground mt-0.5" />
          <p className="text-xs text-muted-foreground">
            These settings apply to <span className="font-medium text-foreground">all sites</span>. If you add
            separate sites later, you can set different rules for each.
          </p>
        </div>
      )}

      {settings && (
        <div className="space-y-4">
          {/* ─── Section 1: Overdue Return Alert ─── */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-destructive/10 flex items-center justify-center">
                  <ShieldAlert className="h-4 w-4 text-destructive" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Overdue Return Alert</p>
                  <p className="text-[11px] text-muted-foreground">Alert when a resident has not returned by the expected time</p>
                </div>
              </div>
              <Switch
                checked={settings.overdueEnabled}
                onCheckedChange={(v) => update({ overdueEnabled: v })}
              />
            </div>

            {settings.overdueEnabled && (
              <div className="p-4 space-y-5">
                {/* Grace period */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Grace period</Label>
                  <p className="text-xs text-muted-foreground">
                    How long after the expected return time before an alert fires
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {GRACE_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => update({ graceMinutes: opt.value })}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                          settings.graceMinutes === opt.value
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-card text-foreground border-border hover:bg-muted/50"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Escalation */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Escalation</Label>
                  <p className="text-xs text-muted-foreground">
                    Raise the alert again if the resident is still not back
                  </p>
                  <Select
                    value={String(settings.escalationMinutes)}
                    onValueChange={(v) => update({ escalationMinutes: Number(v) })}
                  >
                    <SelectTrigger className="w-72 h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ESCALATION_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Recipients */}
                <RecipientSection
                  label="Who should follow up an overdue return?"
                  description="Planned contacts only — no email or text is sent"
                  staff={settings.overdueStaff}
                  emails={settings.overdueEmails}
                  onAddStaff={(s) => update({ overdueStaff: [...settings.overdueStaff, s] })}
                  onRemoveStaff={(id) => update({ overdueStaff: settings.overdueStaff.filter((x) => x.id !== id) })}
                  onAddEmail={(e) => update({ overdueEmails: [...settings.overdueEmails, e] })}
                  onRemoveEmail={(e) => update({ overdueEmails: settings.overdueEmails.filter((x) => x !== e) })}
                />

                <div className="flex items-start gap-2 rounded-lg bg-muted/30 px-3 py-2">
                  <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    A resident is flagged overdue {graceLabel(settings.graceMinutes).toLowerCase()} after their
                    expected return time
                    {settings.escalationMinutes
                      ? `, and raised as escalated a further ${graceLabel(settings.escalationMinutes).toLowerCase()} later`
                      : ""}
                    .
                    {settings.overdueStaff.length + settings.overdueEmails.length === 0
                      ? " No one is named yet — the alert will still show on the dashboard."
                      : ` Named for follow-up: ${[...settings.overdueStaff.map((s) => s.name), ...settings.overdueEmails].join(", ")}.`}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ─── Section 2: Safe Return Alert ─── */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-success/10 flex items-center justify-center">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Safe Return Confirmation</p>
                  <p className="text-[11px] text-muted-foreground">Record a confirmation when a resident has safely returned</p>
                </div>
              </div>
              <Switch
                checked={settings.safeReturnEnabled}
                onCheckedChange={(v) => update({ safeReturnEnabled: v })}
              />
            </div>

            {settings.safeReturnEnabled && (
              <div className="p-4 space-y-5">
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">Record next-of-kin contact requirement</p>
                    <p className="text-xs text-muted-foreground">
                      Record that the resident's emergency contact should be told when they return
                    </p>
                  </div>
                  <Switch
                    checked={settings.notifyNokOnReturn}
                    onCheckedChange={(v) => update({ notifyNokOnReturn: v })}
                  />
                </div>

                <RecipientSection
                  label="Who should be told about the return?"
                  description="Planned contacts only — no email or text is sent"
                  staff={settings.safeReturnStaff}
                  emails={settings.safeReturnEmails}
                  onAddStaff={(s) => update({ safeReturnStaff: [...settings.safeReturnStaff, s] })}
                  onRemoveStaff={(id) => update({ safeReturnStaff: settings.safeReturnStaff.filter((x) => x.id !== id) })}
                  onAddEmail={(e) => update({ safeReturnEmails: [...settings.safeReturnEmails, e] })}
                  onRemoveEmail={(e) => update({ safeReturnEmails: settings.safeReturnEmails.filter((x) => x !== e) })}
                />

                <div className="flex items-start gap-2 rounded-lg bg-muted/30 px-3 py-2">
                  <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    When a resident is marked as returned, a confirmation is written to the audit trail naming who
                    should be told. Emails are not sent automatically yet.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Save */}
          <div className="flex items-center justify-end gap-3">
            {hasChanges && <span className="text-xs text-muted-foreground">Unsaved changes</span>}
            <Button onClick={handleSave} disabled={saving || !hasChanges} size="sm" className="gap-1.5">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save Settings
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
