import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ShieldAlert, Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { useCredentialTypes } from "@/hooks/useContractorEnforcement";
import { useMandatoryCredentials } from "@/hooks/useMandatoryCredentials";
import { useSite } from "@/contexts/SiteContext";
import type { CredentialType } from "@/lib/contractorCredentials";


const JURISDICTION_LABEL: Record<string, string> = {
  ALL: "All regions",
  AU: "Australia",
  UK: "United Kingdom",
};

function slugify(label: string) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);
}

const ENTRY_POLICY_LABEL: Record<string, string> = {
  unsupervised: "Only stop them if they will be alone with residents",
  provisional: "Let them in, but flagged as escorted until staff confirm",
  reception: "Stop at the kiosk — a staff member must complete it",
};

export function ContractorEnforcementTab() {
  const { types, loading, refetch } = useCredentialTypes();
  const { mandatoryKeys, setForSite } = useMandatoryCredentials();
  const { currentSite } = useSite();

  const { toast } = useToast();
  const [entryPolicy, setEntryPolicy] = useState<string>("unsupervised");

  useEffect(() => {
    supabase
      .from("settings")
      .select("value")
      .eq("key", "contractor_entry_on_fail")
      .maybeSingle()
      .then(({ data }) => { if (data?.value) setEntryPolicy(data.value); });
  }, []);

  const saveEntryPolicy = async (value: string) => {
    setEntryPolicy(value);
    await supabase.from("settings").upsert({ key: "contractor_entry_on_fail", value }, { onConflict: "key" });
    const { data: auth } = await supabase.auth.getUser();
    await supabase.from("audit_log").insert({
      action: "setting_changed",
      performed_by: auth.user?.email || "Staff",
      user_id: auth.user?.id ?? null,
      records_affected: 1,
      change_reason: "Contractor entry rule updated",
      details: { key: "contractor_entry_on_fail", value } as any,
    });
    toast({ title: "Entry rule saved" });
  };
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newShort, setNewShort] = useState("");
  const [newJurisdiction, setNewJurisdiction] = useState<"ALL" | "AU" | "UK">("ALL");
  const [newRequired, setNewRequired] = useState(false);
  const [busy, setBusy] = useState(false);

  const patch = async (id: string, fields: Partial<CredentialType>) => {
    const { error } = await supabase.from("credential_types").update(fields as any).eq("id", id);
    if (error) {
      toast({ title: "Could not save", description: error.message, variant: "destructive" });
      return;
    }
    await refetch();
  };

  const addCredential = async () => {
    const label = newLabel.trim();
    if (!label) return;
    setBusy(true);
    const key = slugify(label) || `credential_${Date.now()}`;
    const { error } = await supabase.from("credential_types").insert({
      key,
      label,
      short_label: (newShort.trim() || label).slice(0, 24),
      jurisdiction: newJurisdiction,
      is_required: newRequired,
      sort_order: (types.at(-1)?.sort_order ?? 0) + 1,
    } as any);
    setBusy(false);
    if (error) {
      toast({
        title: "Could not add credential",
        description: error.message.includes("duplicate") ? "A credential with that name already exists." : error.message,
        variant: "destructive",
      });
      return;
    }
    setNewLabel(""); setNewShort(""); setNewJurisdiction("ALL"); setNewRequired(false); setAdding(false);
    await refetch();
    toast({ title: "Credential added" });
  };

  const remove = async (t: CredentialType) => {
    const { error } = await supabase.from("credential_types").delete().eq("id", t.id);
    if (error) {
      toast({ title: "Could not remove", description: error.message, variant: "destructive" });
      return;
    }
    await refetch();
    toast({ title: `${t.label} removed` });
  };

  const move = async (index: number, dir: -1 | 1) => {
    const a = types[index];
    const b = types[index + dir];
    if (!a || !b) return;
    await supabase.from("credential_types").update({ sort_order: b.sort_order } as any).eq("id", a.id);
    await supabase.from("credential_types").update({ sort_order: a.sort_order } as any).eq("id", b.id);
    await refetch();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/40">
        <ShieldAlert className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Build the list of credentials your contractors must hold. Tick <strong>Required</strong> on any credential
          that must be current before check-in can be completed. Entry is only actually stopped when the contractor is
          marked as having <strong>unsupervised access to residents</strong> during screening. For escorted contractors,
          or those with no resident contact, a missing or expired credential is shown to staff and the exemption must be
          explained — but check-in can proceed.
        </p>
      </div>

      <div className="rounded-xl border border-border p-3 space-y-2">
        <Label className="text-sm font-medium">
          If a required check is missing, expired or not yet confirmed
        </Label>
        <Select value={entryPolicy} onValueChange={saveEntryPolicy}>
          <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="unsupervised">{ENTRY_POLICY_LABEL.unsupervised}</SelectItem>
            <SelectItem value="provisional">{ENTRY_POLICY_LABEL.provisional}</SelectItem>
            <SelectItem value="reception">{ENTRY_POLICY_LABEL.reception}</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          A document a contractor uploads themselves never counts as valid until a staff member has seen the original
          and confirmed it.
        </p>
      </div>

      {/* What this particular site insists on */}
      <div className="rounded-xl border border-border p-3 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Label className="text-sm font-medium">Must be current at {currentSite?.name || "this site"}</Label>
            <p className="text-xs text-muted-foreground">
              Tick the checks this site insists on. Leave all unticked to follow the “Required” setting on each
              credential below. These are your own policy choices, not legal requirements.
            </p>
          </div>
          {mandatoryKeys && (
            <Button variant="ghost" size="sm" onClick={() => setForSite(null)}>
              Use the default list
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-3 pt-1">
          {types.filter((t) => t.is_active).map((t) => {
            const on = mandatoryKeys ? mandatoryKeys.includes(t.key) : t.is_required;
            return (
              <label key={t.id} className="flex items-center gap-2 cursor-pointer text-xs text-foreground">
                <Checkbox
                  checked={on}
                  onCheckedChange={(v) => {
                    const base = mandatoryKeys ?? types.filter((x) => x.is_required).map((x) => x.key);
                    const next = v === true ? [...new Set([...base, t.key])] : base.filter((k) => k !== t.key);
                    void setForSite(next);
                  }}
                />
                {t.short_label || t.label}
              </label>
            );
          })}
        </div>
      </div>



      <div className="space-y-2">
        {loading && <p className="text-xs text-muted-foreground">Loading…</p>}
        {!loading && types.length === 0 && (
          <p className="text-xs text-muted-foreground">No credentials yet — add your first one below.</p>
        )}

        {types.map((t, i) => (
          <div key={t.id} className="rounded-xl border border-border p-3 space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{t.label}</p>
                <p className="text-xs text-muted-foreground">
                  {JURISDICTION_LABEL[t.jurisdiction]} · {t.holder_scope === "person" ? "personal check" : "company check"} · short label “{t.short_label}”
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8" disabled={i === 0} onClick={() => move(i, -1)}>
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" disabled={i === types.length - 1} onClick={() => move(i, 1)}>
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(t)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={t.is_required} onCheckedChange={(v) => patch(t.id, { is_required: v === true })} />
                <span className="text-xs text-foreground">Required before check-in can proceed</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Switch checked={t.is_active} onCheckedChange={(v) => patch(t.id, { is_active: v })} />
                <span className="text-xs text-muted-foreground">{t.is_active ? "Active" : "Hidden"}</span>
              </label>
              <Select
                value={t.holder_scope === "person" ? "person" : "company"}
                onValueChange={(v) => patch(t.id, { holder_scope: v as "person" | "company" })}
              >
                <SelectTrigger className="h-8 w-[190px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="person">Held by the person</SelectItem>
                  <SelectItem value="company">Held by the company</SelectItem>
                </SelectContent>
              </Select>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={t.requires_document === true}
                  onCheckedChange={(v) => patch(t.id, { requires_document: v === true })}
                />
                <span className="text-xs text-foreground">Document must be on file</span>
              </label>
              <Select value={t.jurisdiction} onValueChange={(v) => patch(t.id, { jurisdiction: v as CredentialType["jurisdiction"] })}>
                <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All regions</SelectItem>
                  <SelectItem value="AU">Australia</SelectItem>
                  <SelectItem value="UK">United Kingdom</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        ))}
      </div>

      {adding ? (
        <div className="rounded-xl border border-border p-3 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Credential name</Label>
              <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="e.g. Working with Children Check" className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Short label</Label>
              <Input value={newShort} onChange={(e) => setNewShort(e.target.value)} placeholder="e.g. WWCC" className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Applies to</Label>
              <Select value={newJurisdiction} onValueChange={(v) => setNewJurisdiction(v as any)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All regions</SelectItem>
                  <SelectItem value="AU">Australia</SelectItem>
                  <SelectItem value="UK">United Kingdom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 cursor-pointer sm:mt-6">
              <Checkbox checked={newRequired} onCheckedChange={(v) => setNewRequired(v === true)} />
              <span className="text-xs text-foreground">Required before check-in</span>
            </label>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={addCredential} disabled={busy || !newLabel.trim()}>
              {busy ? "Adding…" : "Add credential"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setAdding(true)} className="gap-1.5">
          <Plus className="h-4 w-4" /> Add credential
        </Button>
      )}
    </div>
  );
}
