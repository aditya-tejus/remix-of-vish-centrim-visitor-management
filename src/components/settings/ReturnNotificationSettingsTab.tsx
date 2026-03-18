import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, X, Plus, Save, Loader2, Building2, Users, Mail, Clock, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Branch {
  id: string;
  name: string;
}

interface NotificationTrigger {
  direction: "before" | "after";
  amount: number;
  unit: "minutes" | "hours";
}

interface StaffMember {
  id: string;
  name: string;
  role: string;
}

interface BranchNotifSettings {
  id?: string;
  branch_id: string;
  enabled: boolean;
  notification_emails: string[];
  notification_staff: StaffMember[];
  notification_timing: NotificationTrigger[];
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

function triggerKey(t: NotificationTrigger): string {
  return `${t.amount}_${t.unit}_${t.direction}`;
}

function triggerLabel(t: NotificationTrigger): string {
  const unitLabel = t.amount === 1 ? (t.unit === "minutes" ? "minute" : "hour") : t.unit;
  return `${t.amount} ${unitLabel} ${t.direction.toUpperCase()} expected return`;
}

function sortTriggers(triggers: NotificationTrigger[]): NotificationTrigger[] {
  const toMinutes = (t: NotificationTrigger) => t.amount * (t.unit === "hours" ? 60 : 1);
  const before = triggers.filter(t => t.direction === "before").sort((a, b) => toMinutes(a) - toMinutes(b));
  const after = triggers.filter(t => t.direction === "after").sort((a, b) => toMinutes(a) - toMinutes(b));
  return [...before, ...after];
}

export function ReturnNotificationSettingsTab() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [settings, setSettings] = useState<BranchNotifSettings | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState<string>("");
  const [allBranchSettings, setAllBranchSettings] = useState<Record<string, BranchNotifSettings>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Trigger builder state
  const [triggerDirection, setTriggerDirection] = useState<"before" | "after">("after");
  const [triggerAmount, setTriggerAmount] = useState<string>("");
  const [triggerUnit, setTriggerUnit] = useState<"minutes" | "hours">("minutes");
  const [triggerError, setTriggerError] = useState("");

  // Email input state
  const [newEmail, setNewEmail] = useState("");
  const [emailError, setEmailError] = useState("");

  // Staff search state
  const [staffSearch, setStaffSearch] = useState("");
  const [staffDropdownOpen, setStaffDropdownOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: branchData } = await supabase.from("branches").select("*").eq("is_active", true).order("name");
      const branchesList = (branchData || []) as Branch[];
      setBranches(branchesList);

      const { data: settingsData } = await supabase.from("branch_notification_settings").select("*");
      const settingsMap: Record<string, BranchNotifSettings> = {};
      (settingsData || []).forEach((s: any) => {
        settingsMap[s.branch_id] = {
          id: s.id,
          branch_id: s.branch_id,
          enabled: s.enabled,
          notification_emails: (s.notification_emails as string[]) || [],
          notification_staff: (s.notification_staff as StaffMember[]) || [],
          notification_timing: (s.notification_timing as NotificationTrigger[]) || [],
        };
      });
      setAllBranchSettings(settingsMap);

      if (branchesList.length > 0) {
        const firstId = branchesList[0].id;
        setSelectedBranchId(firstId);
        const initial = settingsMap[firstId] || createDefault(firstId);
        setSettings(initial);
        setSavedSnapshot(JSON.stringify(initial));
      }
      setLoading(false);
    };
    load();
  }, []);

  const createDefault = (branchId: string): BranchNotifSettings => ({
    branch_id: branchId,
    enabled: true,
    notification_emails: [],
    notification_staff: [],
    notification_timing: [],
  });

  const handleBranchChange = (branchId: string) => {
    setSelectedBranchId(branchId);
    const s = allBranchSettings[branchId] || createDefault(branchId);
    setSettings(s);
    setSavedSnapshot(JSON.stringify(s));
  };

  const hasChanges = useMemo(() => {
    if (!settings) return false;
    return JSON.stringify(settings) !== savedSnapshot;
  }, [settings, savedSnapshot]);

  // --- Trigger builder ---
  const addTrigger = () => {
    const amount = parseInt(triggerAmount);
    if (!amount || amount < 1 || amount > 999) return;
    if (!settings) return;

    const newTrigger: NotificationTrigger = { direction: triggerDirection, amount, unit: triggerUnit };

    if (settings.notification_timing.some(t => triggerKey(t) === triggerKey(newTrigger))) {
      setTriggerError("This trigger already exists");
      return;
    }
    if (settings.notification_timing.length >= 10) {
      setTriggerError("Maximum 10 triggers per branch");
      return;
    }

    setTriggerError("");
    setSettings(prev => prev ? { ...prev, notification_timing: [...prev.notification_timing, newTrigger] } : prev);
    setTriggerAmount("");
  };

  const removeTrigger = (key: string) => {
    setSettings(prev => prev ? { ...prev, notification_timing: prev.notification_timing.filter(t => triggerKey(t) !== key) } : prev);
  };

  // --- Email ---
  const addEmail = () => {
    if (!newEmail.trim()) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail.trim())) {
      setEmailError("Enter a valid email address");
      return;
    }
    if (settings?.notification_emails.includes(newEmail.trim())) {
      setEmailError("This email is already in the list");
      return;
    }
    setEmailError("");
    setSettings(prev => prev ? { ...prev, notification_emails: [...prev.notification_emails, newEmail.trim()] } : prev);
    setNewEmail("");
  };

  const removeEmail = (email: string) => {
    setSettings(prev => prev ? { ...prev, notification_emails: prev.notification_emails.filter(e => e !== email) } : prev);
  };

  // --- Staff ---
  const filteredStaff = useMemo(() => {
    const selectedIds = new Set(settings?.notification_staff.map(s => s.id) || []);
    return AVAILABLE_STAFF.filter(s =>
      !selectedIds.has(s.id) &&
      (s.name.toLowerCase().includes(staffSearch.toLowerCase()) || s.role.toLowerCase().includes(staffSearch.toLowerCase()))
    );
  }, [staffSearch, settings?.notification_staff]);

  const addStaff = (staff: StaffMember) => {
    setSettings(prev => prev ? { ...prev, notification_staff: [...prev.notification_staff, staff] } : prev);
    setStaffSearch("");
  };

  const removeStaff = (id: string) => {
    setSettings(prev => prev ? { ...prev, notification_staff: prev.notification_staff.filter(s => s.id !== id) } : prev);
  };

  // --- Save ---
  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    const branchName = branches.find(b => b.id === selectedBranchId)?.name || "Branch";

    const payload = {
      branch_id: settings.branch_id,
      enabled: settings.enabled,
      notification_emails: settings.notification_emails as any,
      notification_staff: settings.notification_staff as any,
      notification_timing: settings.notification_timing as any,
      updated_at: new Date().toISOString(),
    };

    if (settings.id) {
      const { error } = await supabase.from("branch_notification_settings").update(payload).eq("id", settings.id);
      if (error) { toast.error("Failed to save — please try again"); setSaving(false); return; }
    } else {
      const { data, error } = await supabase.from("branch_notification_settings").insert(payload).select().single();
      if (error) { toast.error("Failed to save — please try again"); setSaving(false); return; }
      if (data) setSettings(prev => prev ? { ...prev, id: (data as any).id } : prev);
    }

    const updatedSettings = { ...settings };
    setAllBranchSettings(prev => ({ ...prev, [settings.branch_id]: updatedSettings }));
    setSavedSnapshot(JSON.stringify(updatedSettings));
    toast.success(`Settings saved for ${branchName}`);
    setSaving(false);
  };

  // --- Summary stats ---
  const summaryStats = useMemo(() => {
    const allSettings = Object.values(allBranchSettings);
    const enabledCount = allSettings.filter(s => s.enabled).length;
    const totalTriggers = allSettings.reduce((sum, s) => sum + (s.notification_timing?.length || 0), 0);
    const totalStaff = new Set(allSettings.flatMap(s => (s.notification_staff || []).map(st => st.id))).size;
    const totalEmails = new Set(allSettings.flatMap(s => s.notification_emails || [])).size;
    return { enabledCount, totalBranches: branches.length, totalTriggers, totalStaff, totalEmails };
  }, [allBranchSettings, branches]);

  if (loading) return <div className="text-sm text-muted-foreground p-4">Loading...</div>;

  const branchName = branches.find(b => b.id === selectedBranchId)?.name || "Branch";
  const canAddTrigger = triggerAmount && parseInt(triggerAmount) >= 1 && parseInt(triggerAmount) <= 999;

  return (
    <div className="space-y-6">
      {/* Branch Selector — always visible */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground font-medium">Configuring returns for:</span>
          <Select value={selectedBranchId} onValueChange={handleBranchChange}>
            <SelectTrigger className="w-64">
              <Building2 className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {branches.map(b => {
                const bs = allBranchSettings[b.id];
                return (
                  <SelectItem key={b.id} value={b.id}>
                    <div className="flex items-center gap-2">
                      <span>{b.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${bs?.enabled ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                        {bs?.enabled ? "Enabled" : "Disabled"}
                      </span>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-4">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Branches Enabled</p>
            <p className="text-2xl font-bold text-foreground mt-1">{summaryStats.enabledCount} <span className="text-sm font-normal text-muted-foreground">/ {summaryStats.totalBranches}</span></p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-4">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Total Triggers</p>
            <p className="text-2xl font-bold text-foreground mt-1">{summaryStats.totalTriggers}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-teal-500">
          <CardContent className="p-4">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Total Notified</p>
            <p className="text-2xl font-bold text-foreground mt-1">
              {summaryStats.totalStaff} <span className="text-sm font-normal text-muted-foreground">staff</span>
              {", "}
              {summaryStats.totalEmails} <span className="text-sm font-normal text-muted-foreground">email</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Config Card */}
      {settings && (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-4 w-4 text-primary" />
              Return Notification Settings — {branchName}
            </CardTitle>
            <CardDescription className="text-xs">
              Trigger alerts when a resident has not returned by their expected time.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-0">
            {/* Enable toggle */}
            <div className="flex items-center justify-between rounded-xl border border-border p-4 mb-2">
              <div className="space-y-0.5">
                <Label className="text-sm font-semibold">Enable overdue return notifications</Label>
                <p className="text-xs text-muted-foreground">Trigger alerts when a resident has not returned by expected time</p>
              </div>
              <Switch
                checked={settings.enabled}
                onCheckedChange={(checked) => setSettings(prev => prev ? { ...prev, enabled: checked } : prev)}
              />
            </div>

            {/* Disabled banner */}
            {!settings.enabled && (
              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3 mt-3">
                <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30 shrink-0" />
                <div>
                  <p className="text-sm text-muted-foreground">Notifications are disabled for this branch.</p>
                  <p className="text-xs text-muted-foreground">Toggle on to configure and activate alerts.</p>
                </div>
              </div>
            )}

            {/* Config sections — grayed out when disabled */}
            <div className={`space-y-6 mt-6 ${!settings.enabled ? "opacity-40 pointer-events-none" : ""}`}>

              {/* === WHEN TO NOTIFY === */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">When to notify</span>
                  <div className="h-px flex-1 bg-border" />
                </div>

                <p className="text-xs text-muted-foreground">Add notification triggers relative to the expected return time.</p>

                {/* Trigger builder */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Select value={triggerDirection} onValueChange={(v: "before" | "after") => { setTriggerDirection(v); setTriggerError(""); }}>
                    <SelectTrigger className="w-28 h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="before">Before</SelectItem>
                      <SelectItem value="after">After</SelectItem>
                    </SelectContent>
                  </Select>

                  <Input
                    type="number"
                    min={1}
                    max={999}
                    placeholder="30"
                    value={triggerAmount}
                    onChange={e => { setTriggerAmount(e.target.value); setTriggerError(""); }}
                    className="w-20 h-9"
                  />

                  <Select value={triggerUnit} onValueChange={(v: "minutes" | "hours") => { setTriggerUnit(v); setTriggerError(""); }}>
                    <SelectTrigger className="w-28 h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="minutes">Minutes</SelectItem>
                      <SelectItem value="hours">Hours</SelectItem>
                    </SelectContent>
                  </Select>

                  <span className="text-xs text-muted-foreground hidden sm:inline">the expected return time</span>

                  <Button size="sm" onClick={addTrigger} disabled={!canAddTrigger} className="gap-1 h-9">
                    <Plus className="h-3.5 w-3.5" />Add Trigger
                  </Button>
                </div>

                {triggerError && <p className="text-xs text-destructive">{triggerError}</p>}

                {/* Active triggers list */}
                {settings.notification_timing.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border p-4 text-center">
                    <p className="text-sm text-muted-foreground">No triggers added yet — add at least one to enable notifications</p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-border divide-y divide-border">
                    {sortTriggers(settings.notification_timing).map(t => (
                      <div key={triggerKey(t)} className="flex items-center gap-3 px-4 py-2.5">
                        <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm flex-1">
                          {t.amount} {t.amount === 1 ? (t.unit === "minutes" ? "minute" : "hour") : t.unit}{" "}
                          <span className={`font-semibold ${t.direction === "before" ? "text-amber-600" : "text-destructive"}`}>
                            {t.direction.toUpperCase()}
                          </span>{" "}
                          expected return
                        </span>
                        <button onClick={() => removeTrigger(triggerKey(t))} className="text-muted-foreground hover:text-destructive transition-colors">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* === WHO TO NOTIFY === */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Who to notify</span>
                  <div className="h-px flex-1 bg-border" />
                </div>

                {/* Staff selector */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Notify staff members</Label>
                  <p className="text-xs text-muted-foreground">Search and select staff who will receive this alert</p>
                  <div className="relative">
                    <Input
                      placeholder="Search staff name or role..."
                      value={staffSearch}
                      onChange={e => { setStaffSearch(e.target.value); setStaffDropdownOpen(true); }}
                      onFocus={() => setStaffDropdownOpen(true)}
                      onBlur={() => setTimeout(() => setStaffDropdownOpen(false), 200)}
                      className="pr-8"
                    />
                    <Users className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    {staffDropdownOpen && filteredStaff.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-20 max-h-48 overflow-y-auto">
                        {filteredStaff.map(staff => (
                          <button
                            key={staff.id}
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => addStaff(staff)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors"
                          >
                            <span className="h-7 w-7 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center text-xs font-semibold shrink-0">
                              {staff.name.split(" ").map(n => n[0]).join("")}
                            </span>
                            <div>
                              <p className="text-sm font-medium text-foreground">{staff.name}</p>
                              <p className="text-[11px] text-muted-foreground">{staff.role}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Selected staff chips */}
                  {settings.notification_staff.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {settings.notification_staff.map(staff => (
                        <div key={staff.id} className="inline-flex items-center gap-2 rounded-full bg-teal-50 border border-teal-200 pl-1 pr-2 py-1">
                          <span className="h-6 w-6 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-[10px] font-semibold">
                            {staff.name.split(" ").map(n => n[0]).join("")}
                          </span>
                          <span className="text-xs font-medium text-teal-900">{staff.name}</span>
                          <span className="text-[10px] text-teal-600">{staff.role}</span>
                          <button onClick={() => removeStaff(staff.id)} className="text-teal-400 hover:text-destructive transition-colors ml-0.5">
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Email recipients */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Additional email recipients</Label>
                  <p className="text-xs text-muted-foreground">Add any email address — family liaison, external coordinators etc</p>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter email address..."
                      value={newEmail}
                      onChange={e => { setNewEmail(e.target.value); setEmailError(""); }}
                      onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addEmail())}
                      className={`flex-1 ${emailError ? "border-destructive" : ""}`}
                    />
                    <Button variant="outline" size="sm" onClick={addEmail} disabled={!newEmail.trim()} className="gap-1 h-9">
                      <Plus className="h-3.5 w-3.5" />Add
                    </Button>
                  </div>
                  {emailError && <p className="text-xs text-destructive">{emailError}</p>}

                  {settings.notification_emails.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {settings.notification_emails.map(email => (
                        <div key={email} className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200 px-3 py-1">
                          <Mail className="h-3.5 w-3.5 text-blue-600" />
                          <span className="text-xs text-blue-800">{email}</span>
                          <button onClick={() => removeEmail(email)} className="text-blue-400 hover:text-destructive transition-colors ml-0.5">
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* === NOTIFICATION CONTENT === */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notification content</span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Email subject preview</p>
                  <p className="text-sm text-foreground font-medium">
                    ⚠ Overdue Return — [Resident Name] — {branchName}
                  </p>
                </div>
              </div>

              {/* Save */}
              <div className="flex justify-end pt-2 border-t border-border">
                <Button
                  onClick={handleSave}
                  disabled={saving || !hasChanges}
                  className="gap-1.5 bg-[hsl(210,55%,24%)] hover:bg-[hsl(210,55%,30%)]"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Settings
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
