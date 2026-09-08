import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Users } from "lucide-react";
import { usePersonTypes, PersonTypeConfigRow } from "@/hooks/usePersonTypes";

export function PersonTypesTab() {
  const { personTypes, loading, reload } = usePersonTypes();
  const [rows, setRows] = useState<PersonTypeConfigRow[]>([]);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => { if (!loading) setRows(personTypes); }, [loading, personTypes]);

  const update = (type: string, patch: Partial<PersonTypeConfigRow>) =>
    setRows((prev) => prev.map((r) => (r.type === type ? { ...r, ...patch } : r)));

  const save = async () => {
    setSaving(true);
    const payload = rows.flatMap((r) => [
      { key: `person_type_kiosk_${r.type}`, value: r.kioskEnabled ? "true" : "false" },
      { key: `person_type_desk_${r.type}`, value: r.deskEnabled ? "true" : "false" },
      { key: `person_type_label_${r.type}`, value: r.kioskLabel === r.label ? "" : r.kioskLabel.trim() },
    ]);
    await supabase.from("settings").upsert(payload, { onConflict: "key" });
    await supabase.from("audit_log").insert({
      action: "settings_update",
      performed_by: "Staff",
      records_affected: payload.length,
      details: { setting: "person_types", value: rows.map((r) => ({ type: r.type, kiosk: r.kioskEnabled, desk: r.deskEnabled, label: r.kioskLabel })) } as any,
      change_reason: "Person type availability and kiosk naming updated",
    });
    await reload();
    setSaving(false);
    toast({ title: "Person types saved" });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/40">
        <Users className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Choose which types of people can sign in, and where. Turning a type off only hides it from new sign-ins — existing records, lists and reports are unchanged. The kiosk name is what people see on the kiosk screen; lists and reports keep the standard name.
        </p>
      </div>

      <div className="rounded-xl border border-border divide-y divide-border">
        <div className="hidden sm:grid grid-cols-[1fr_90px_110px_1fr] gap-3 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          <span>Type</span>
          <span className="text-center">Kiosk</span>
          <span className="text-center">Front desk</span>
          <span>Kiosk name</span>
        </div>
        {rows.map((r) => (
          <div key={r.type} className="grid grid-cols-1 sm:grid-cols-[1fr_90px_110px_1fr] gap-3 px-4 py-3 items-center">
            <div>
              <p className="text-sm font-medium text-foreground">{r.label}</p>
              <p className="text-xs text-muted-foreground">{r.description}</p>
            </div>
            <div className="flex sm:justify-center items-center gap-2">
              <span className="sm:hidden text-xs text-muted-foreground">Kiosk</span>
              <Switch checked={r.kioskEnabled} onCheckedChange={(v) => update(r.type, { kioskEnabled: v })} />
            </div>
            <div className="flex sm:justify-center items-center gap-2">
              <span className="sm:hidden text-xs text-muted-foreground">Front desk</span>
              {r.type === "resident" ? (
                <span className="text-xs text-muted-foreground">n/a</span>
              ) : (
                <Switch
                  checked={r.deskEnabled}
                  disabled={r.type === "visitor"}
                  onCheckedChange={(v) => update(r.type, { deskEnabled: v })}
                />
              )}
            </div>
            <Input
              value={r.kioskLabel}
              placeholder={r.label}
              onChange={(e) => update(r.type, { kioskLabel: e.target.value })}
              className="h-9 text-sm"
            />
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Visitors always stay available at the front desk. Residents are not a sign-in type — the switch controls the "Resident Leave" tile on the kiosk.
      </p>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
      </div>
    </div>
  );
}
