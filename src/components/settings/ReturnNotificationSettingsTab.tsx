import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, X, Plus, Save, Loader2, Building2, Users, Mail, Clock, AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Branch {
  id: string;
  name: string;
}

interface StaffMember {
  id: string;
  name: string;
  role: string;
}

interface ReturnNotifSettings {
  id?: string;
  branch_id: string;
  // Overdue section
  overdue_enabled: boolean;
  overdue_grace_minutes: number;
  overdue_escalation_minutes: number;
  overdue_staff: StaffMember[];
  overdue_emails: string[];
  // Safe return section
  safe_return_enabled: boolean;
  safe_return_staff: StaffMember[];
  safe_return_emails: string[];
  notify_nok_on_return: boolean;
}

// Mock staff for selection
const AVAILABLE_STAFF: StaffMember[] = [
  { id: "1", name: "Sarah Mitchell", role: "Care Lead" },
  { id: "2", name: "James Okafor", role: "Nurse" },
  { id: "3", name: "Emily Chen", role: "Nurse Lead" },
  { id: "4", name: "David Thompson", role: "Senior Carer" },
  { id: "5", name: "Maria Santos", role: "Reception" },
  { id: "6", name: "Robert Wilson", role: "Manager" },
];

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

function createDefault(branchId: string): ReturnNotifSettings {
  return {
    branch_id: branchId,
    overdue_enabled: true,
    overdue_grace_minutes: 30,
    overdue_escalation_minutes: 0,
    overdue_staff: [],
    overdue_emails: [],
    safe_return_enabled: false,
    safe_return_staff: [],
    safe_return_emails: [],
    notify_nok_on_return: false,
  };
}

function fromDbRow(row: any): ReturnNotifSettings {
  // Map from existing DB columns to our new shape
  const timing = (row.notification_timing as any[]) || [];
  const graceTrigger = timing.find((t: any) => t.direction === "after");
  const graceMinutes = graceTrigger
    ? graceTrigger.amount * (graceTrigger.unit === "hours" ? 60 : 1)
    : 30;

  // Extract safe return settings from notification_staff metadata if available
  const staffList = (row.notification_staff as any) || {};
  const overdueStaff = Array.isArray(staffList) ? staffList : (staffList.overdue || []);
  const safeReturnStaff = Array.isArray(staffList) ? [] : (staffList.safe_return || []);

  const emailList = (row.notification_emails as any) || {};
  const overdueEmails = Array.isArray(emailList) ? emailList : (emailList.overdue || []);
  const safeReturnEmails = Array.isArray(emailList) ? [] : (emailList.safe_return || []);

  return {
    id: row.id,
    branch_id: row.branch_id,
    overdue_enabled: row.enabled ?? true,
    overdue_grace_minutes: graceMinutes,
    overdue_escalation_minutes: (staffList as any)?.escalation_minutes ?? 0,
    overdue_staff: overdueStaff as StaffMember[],
    overdue_emails: overdueEmails as string[],
    safe_return_enabled: (staffList as any)?.safe_return_enabled ?? false,
    safe_return_staff: safeReturnStaff as StaffMember[],
    safe_return_emails: safeReturnEmails as string[],
    notify_nok_on_return: (staffList as any)?.notify_nok_on_return ?? false,
  };
}

function toDbPayload(s: ReturnNotifSettings) {
  return {
    branch_id: s.branch_id,
    enabled: s.overdue_enabled,
    notification_emails: {
      overdue: s.overdue_emails,
      safe_return: s.safe_return_emails,
    } as any,
    notification_staff: {
      overdue: s.overdue_staff,
      safe_return: s.safe_return_staff,
      safe_return_enabled: s.safe_return_enabled,
      notify_nok_on_return: s.notify_nok_on_return,
      escalation_minutes: s.overdue_escalation_minutes,
    } as any,
    notification_timing: [
      { direction: "after" as const, amount: s.overdue_grace_minutes, unit: "minutes" as const },
    ] as any,
    updated_at: new Date().toISOString(),
  };
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
  staff: StaffMember[];
  emails: string[];
  onAddStaff: (s: StaffMember) => void;
  onRemoveStaff: (id: string) => void;
  onAddEmail: (e: string) => void;
  onRemoveEmail: (e: string) => void;
}) {
  const [staffSearch, setStaffSearch] = useState("");
  const [staffOpen, setStaffOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailError, setEmailError] = useState("");

  const selectedIds = new Set(staff.map(s => s.id));
  const filtered = AVAILABLE_STAFF.filter(s =>
    !selectedIds.has(s.id) &&
    (s.name.toLowerCase().includes(staffSearch.toLowerCase()) || s.role.toLowerCase().includes(staffSearch.toLowerCase()))
  );

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
          placeholder="Search staff name or role..."
          value={staffSearch}
          onChange={e => { setStaffSearch(e.target.value); setStaffOpen(true); }}
          onFocus={() => setStaffOpen(true)}
          onBlur={() => setTimeout(() => setStaffOpen(false), 200)}
          className="pr-8 h-9 text-sm"
        />
        <Users className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        {staffOpen && filtered.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-20 max-h-40 overflow-y-auto">
            {filtered.map(s => (
              <button
                key={s.id}
                onMouseDown={e => e.preventDefault()}
                onClick={() => { onAddStaff(s); setStaffSearch(""); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/50 transition-colors"
              >
                <span className="h-6 w-6 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center text-[10px] font-semibold shrink-0">
                  {s.name.split(" ").map(n => n[0]).join("")}
                </span>
                <div>
                  <p className="text-sm font-medium text-foreground">{s.name}</p>
                  <p className="text-[11px] text-muted-foreground">{s.role}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {staff.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {staff.map(s => (
            <Badge key={s.id} variant="secondary" className="gap-1 text-xs pl-1 pr-1.5 py-0.5">
              <span className="h-5 w-5 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-[9px] font-semibold">
                {s.name.split(" ").map(n => n[0]).join("")}
              </span>
              {s.name}
              <button onClick={() => onRemoveStaff(s.id)} className="text-muted-foreground hover:text-destructive ml-0.5">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Email input */}
      <div className="flex gap-2">
        <Input
          placeholder="email@example.com"
          value={newEmail}
          onChange={e => { setNewEmail(e.target.value); setEmailError(""); }}
          onKeyDown={e => e.key === "Enter" && (e.preventDefault(), handleAddEmail())}
          className={`flex-1 h-9 text-sm ${emailError ? "border-destructive" : ""}`}
        />
        <Button variant="outline" size="sm" onClick={handleAddEmail} disabled={!newEmail.trim()} className="gap-1 h-9">
          <Plus className="h-3 w-3" /> Add
        </Button>
      </div>
      {emailError && <p className="text-xs text-destructive">{emailError}</p>}

      {emails.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {emails.map(email => (
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
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [settings, setSettings] = useState<ReturnNotifSettings | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState("");
  const [allSettings, setAllSettings] = useState<Record<string, ReturnNotifSettings>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: branchData } = await supabase.from("branches").select("*").eq("is_active", true).order("name");
      const list = (branchData || []) as Branch[];
      setBranches(list);

      const { data: settingsData } = await supabase.from("branch_notification_settings").select("*");
      const map: Record<string, ReturnNotifSettings> = {};
      (settingsData || []).forEach((row: any) => {
        map[row.branch_id] = fromDbRow(row);
      });
      setAllSettings(map);

      if (list.length > 0) {
        const firstId = list[0].id;
        setSelectedBranchId(firstId);
        const initial = map[firstId] || createDefault(firstId);
        setSettings(initial);
        setSavedSnapshot(JSON.stringify(initial));
      }
      setLoading(false);
    };
    load();
  }, []);

  const handleBranchChange = (branchId: string) => {
    setSelectedBranchId(branchId);
    const s = allSettings[branchId] || createDefault(branchId);
    setSettings(s);
    setSavedSnapshot(JSON.stringify(s));
  };

  const hasChanges = useMemo(() => {
    if (!settings) return false;
    return JSON.stringify(settings) !== savedSnapshot;
  }, [settings, savedSnapshot]);

  const update = (patch: Partial<ReturnNotifSettings>) => {
    setSettings(prev => prev ? { ...prev, ...patch } : prev);
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    const branchName = branches.find(b => b.id === selectedBranchId)?.name || "Branch";
    const payload = toDbPayload(settings);

    if (settings.id) {
      const { error } = await supabase.from("branch_notification_settings").update(payload).eq("id", settings.id);
      if (error) { toast.error("Failed to save"); setSaving(false); return; }
    } else {
      const { data, error } = await supabase.from("branch_notification_settings").insert(payload).select().single();
      if (error) { toast.error("Failed to save"); setSaving(false); return; }
      if (data) update({ id: (data as any).id });
    }

    const updated = { ...settings };
    setAllSettings(prev => ({ ...prev, [settings.branch_id]: updated }));
    setSavedSnapshot(JSON.stringify(updated));
    toast.success(`Settings saved for ${branchName}`);
    setSaving(false);
  };

  if (loading) return <div className="text-sm text-muted-foreground p-4">Loading...</div>;

  const branchName = branches.find(b => b.id === selectedBranchId)?.name || "Branch";

  return (
    <div className="space-y-5">
      {/* Branch selector */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground font-medium">Branch:</span>
        <Select value={selectedBranchId} onValueChange={handleBranchChange}>
          <SelectTrigger className="w-56 h-9">
            <Building2 className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {branches.map(b => (
              <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

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
                checked={settings.overdue_enabled}
                onCheckedChange={v => update({ overdue_enabled: v })}
              />
            </div>

            {settings.overdue_enabled && (
              <div className="p-4 space-y-5">
                {/* Grace period */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Grace period</Label>
                  <p className="text-xs text-muted-foreground">
                    How long after the expected return time before an alert fires
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {GRACE_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => update({ overdue_grace_minutes: opt.value })}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                          settings.overdue_grace_minutes === opt.value
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
                    Send a second alert to the manager if the resident is still not returned
                  </p>
                  <Select
                    value={String(settings.overdue_escalation_minutes)}
                    onValueChange={v => update({ overdue_escalation_minutes: Number(v) })}
                  >
                    <SelectTrigger className="w-72 h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ESCALATION_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Recipients */}
                <RecipientSection
                  label="Who gets the overdue alert?"
                  description="Staff and email addresses to notify when a resident is overdue"
                  staff={settings.overdue_staff}
                  emails={settings.overdue_emails}
                  onAddStaff={s => update({ overdue_staff: [...settings.overdue_staff, s] })}
                  onRemoveStaff={id => update({ overdue_staff: settings.overdue_staff.filter(x => x.id !== id) })}
                  onAddEmail={e => update({ overdue_emails: [...settings.overdue_emails, e] })}
                  onRemoveEmail={e => update({ overdue_emails: settings.overdue_emails.filter(x => x !== e) })}
                />
              </div>
            )}
          </div>

          {/* ─── Section 2: Safe Return Alert ─── */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Safe Return Confirmation</p>
                  <p className="text-[11px] text-muted-foreground">Notify staff when a resident has safely returned</p>
                </div>
              </div>
              <Switch
                checked={settings.safe_return_enabled}
                onCheckedChange={v => update({ safe_return_enabled: v })}
              />
            </div>

            {settings.safe_return_enabled && (
              <div className="p-4 space-y-5">
                {/* NOK toggle */}
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">Notify next-of-kin</p>
                    <p className="text-xs text-muted-foreground">
                      Automatically email the resident's emergency contact when they return
                    </p>
                  </div>
                  <Switch
                    checked={settings.notify_nok_on_return}
                    onCheckedChange={v => update({ notify_nok_on_return: v })}
                  />
                </div>

                {/* Recipients */}
                <RecipientSection
                  label="Who gets the return confirmation?"
                  description="Staff and email addresses to notify when a resident returns safely"
                  staff={settings.safe_return_staff}
                  emails={settings.safe_return_emails}
                  onAddStaff={s => update({ safe_return_staff: [...settings.safe_return_staff, s] })}
                  onRemoveStaff={id => update({ safe_return_staff: settings.safe_return_staff.filter(x => x.id !== id) })}
                  onAddEmail={e => update({ safe_return_emails: [...settings.safe_return_emails, e] })}
                  onRemoveEmail={e => update({ safe_return_emails: settings.safe_return_emails.filter(x => x !== e) })}
                />
              </div>
            )}
          </div>

          {/* Save */}
          <div className="flex justify-end">
            <Button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              size="sm"
              className="gap-1.5"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save Settings
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
