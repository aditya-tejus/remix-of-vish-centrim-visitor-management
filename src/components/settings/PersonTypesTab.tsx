import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { usePersonTypes, PersonTypeConfigRow, PersonTypeExtras } from "@/hooks/usePersonTypes";
import { useAuth } from "@/hooks/useAuth";
import { useOperatingContext, siteScopedKey } from "@/contexts/OperatingContext";
import { SettingExplainer } from "@/components/settings/SettingExplainer";

const FLAGS: { key: keyof PersonTypeConfigRow; label: string; help: string }[] = [
  { key: "kioskEnabled", label: "On kiosk", help: "Offered as a sign-in choice on the kiosk." },
  { key: "deskEnabled", label: "At front desk", help: "Offered when staff sign someone in." },
  { key: "staffVisible", label: "Visible to staff", help: "Appears in lists and filters." },
  { key: "destinationRequired", label: "Must say who/where", help: "Destination is required at sign-in." },
  { key: "screeningApplies", label: "Check-in questions", help: "Check-in questions are asked." },
  { key: "privacyApplies", label: "Privacy agreement", help: "Privacy acknowledgement is asked." },
  { key: "badgeApplies", label: "Badge and code", help: "A badge and personal code are issued." },
  { key: "rollCallIncluded", label: "In roll call", help: "Counted in the emergency roll call." },
];

export function PersonTypesTab() {
  const { personTypes, extras, loading, reload } = usePersonTypes();
  const { role } = useAuth();
  const { siteId, siteName, pack } = useOperatingContext();
  const [rows, setRows] = useState<PersonTypeConfigRow[]>([]);
  const [extraRows, setExtraRows] = useState<PersonTypeExtras>(extras);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const access = useSettingsAccess("person-types");
  const canEdit = access.canEdit || role === "admin";
  const [dirty, setDirty] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  useUnsavedGuard(dirty && canEdit);

  useEffect(() => { if (!loading) { setRows(personTypes); setExtraRows(extras); setDirty(false); } }, [loading, personTypes, extras]);

  const update = (type: string, patch: Partial<PersonTypeConfigRow>) => {
    setDirty(true);
    setRows((prev) => prev.map((r) => (r.type === type ? { ...r, ...patch } : r)));
  };

  /** A kiosk name has to be usable on a tile. */
  const nameError = (r: PersonTypeConfigRow) => {
    const v = r.kioskLabel.trim();
    if (v.length === 0) return null; // empty falls back to the built-in name
    if (v.length > 30) return "Keep the kiosk name to 30 characters or fewer.";
    return null;
  };
  const validationError = rows.map(nameError).find(Boolean) || null;

  const resetRowToDefault = (type: string) => {
    const d = PERSON_TYPE_DEFAULTS.find((x) => x.type === type);
    if (!d) return;
    update(type, {
      kioskLabel: d.label,
      destinationRequired: d.destinationRequired,
      screeningApplies: d.screeningApplies,
      privacyApplies: d.privacyApplies,
      badgeApplies: d.badgeApplies,
      rollCallIncluded: d.rollCallIncluded,
    });
  };

  const save = async () => {
    if (validationError) return;
    setSaving(true);
    setSaveError(null);

    const k = (key: string) => siteScopedKey(key, siteId);
    const payload = rows.flatMap((r) => [
      { key: k(`person_type_kiosk_${r.type}`), value: r.kioskEnabled ? "true" : "false" },
      { key: k(`person_type_desk_${r.type}`), value: r.deskEnabled ? "true" : "false" },
      { key: k(`person_type_staffvisible_${r.type}`), value: r.staffVisible ? "true" : "false" },
      { key: k(`person_type_destination_${r.type}`), value: r.destinationRequired ? "true" : "false" },
      { key: k(`person_type_screening_${r.type}`), value: r.screeningApplies ? "true" : "false" },
      { key: k(`person_type_privacy_${r.type}`), value: r.privacyApplies ? "true" : "false" },
      { key: k(`person_type_badge_${r.type}`), value: r.badgeApplies ? "true" : "false" },
      { key: k(`person_type_rollcall_${r.type}`), value: r.rollCallIncluded ? "true" : "false" },
      { key: k(`person_type_label_${r.type}`), value: r.kioskLabel === r.label ? "" : r.kioskLabel.trim() },
    ]);
    payload.push(
      { key: k("volunteer_field_role"), value: extraRows.volunteerRoleEnabled ? "true" : "false" },
      { key: k("volunteer_field_supervisor"), value: extraRows.volunteerSupervisorEnabled ? "true" : "false" },
      { key: k("volunteer_field_expected_end"), value: extraRows.volunteerExpectedEndEnabled ? "true" : "false" },
      { key: k("group_attendee_phone"), value: extraRows.groupAttendeePhoneEnabled ? "true" : "false" },
      { key: k("group_organiser_declared_terms"), value: extraRows.organiserDeclaredTermsEnabled ? "true" : "false" },
    );
    await supabase.from("settings").upsert(payload, { onConflict: "key" });
    await supabase.from("audit_log").insert({
      action: "settings_update",
      performed_by: "Staff",
      records_affected: payload.length,
      details: { setting: "person_types", site: siteName ?? "account default", value: rows.map((r) => ({ type: r.type, kiosk: r.kioskEnabled, desk: r.deskEnabled, label: r.kioskLabel })) } as any,
      change_reason: "Person type availability and workflow rules updated",
    });
    await reload();
    setSaving(false);
    toast({ title: "Visitor types saved" });
  };

  return (
    <div className="space-y-5">
      <SettingExplainer
        title="Visitor types"
        controls="Which types of people can sign in, what the kiosk calls them, and which parts of the sign-in apply to each."
        appliesTo={siteName ? `${siteName} only` : "This account"}
        changeableBy="Administrators and senior staff."
        inherited={`${pack.label} defaults, with your changes on top`}
        kioskEffect="Turning a type off removes its tile from the kiosk straight away."
        deskEffect="Turning a type off removes it from new sign-ins at the desk. Lists and reports keep the standard name."
        existingRecords="People already signed in stay on the list and in every report."
      />

      <div className="rounded-xl border border-border divide-y divide-border">
        {rows.map((r) => (
          <div key={r.type} className="p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-3 justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">{r.label}</p>
                <p className="text-xs text-muted-foreground">{r.description}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Kiosk name</span>
                <Input
                  value={r.kioskLabel}
                  placeholder={r.label}
                  disabled={!canEdit}
                  onChange={(e) => update(r.type, { kioskLabel: e.target.value })}
                  className="h-9 w-44 text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2">
              {FLAGS.map((f) => {
                const disabled =
                  !canEdit ||
                  (r.type === "visitor" && f.key === "deskEnabled") ||
                  (r.type === "resident" && (f.key === "deskEnabled" || f.key === "badgeApplies"));
                return (
                  <label key={String(f.key)} title={f.help} className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-2.5 py-2">
                    <span className="text-xs text-foreground">{f.label}</span>
                    <Switch
                      checked={!!r[f.key]}
                      disabled={disabled}
                      onCheckedChange={(v) => update(r.type, { [f.key]: v } as Partial<PersonTypeConfigRow>)}
                    />
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border p-4 space-y-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Volunteers and group arrivals</p>
          <p className="text-xs text-muted-foreground">Extra details your site collects. All of these are optional for the person signing in.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
          {([
            ["volunteerRoleEnabled", "Ask a volunteer's role or programme"],
            ["volunteerSupervisorEnabled", "Ask which staff member is supervising"],
            ["volunteerExpectedEndEnabled", "Ask what time the volunteer expects to finish"],
            ["groupAttendeePhoneEnabled", "Ask each group attendee for a phone number"],
            ["organiserDeclaredTermsEnabled", "Allow an organiser to confirm the terms for assisted or child attendees"],
          ] as [keyof PersonTypeExtras, string][]).map(([key, label]) => (
            <label key={key} className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-2.5 py-2">
              <span className="text-xs text-foreground">{label}</span>
              <Switch
                checked={extraRows[key]}
                disabled={!canEdit}
                onCheckedChange={(v) => setExtraRows((prev) => ({ ...prev, [key]: v }))}
              />
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          A group organiser's name and contact number are always required. Organiser-declared terms are recorded as the organiser's
          confirmation, never as the attendee's own.
        </p>
      </div>

      <p className="text-xs text-muted-foreground">
        Visitors always stay available at the front desk. Staff are kept separate from visitors everywhere people can see —
        they are never described as visitors. Residents are not a sign-in type: their switch controls the resident leave tile on the kiosk.
      </p>

      {canEdit && (
        <div className="flex justify-end">
          <Button onClick={save} disabled={saving || !canEdit}>{saving ? "Saving…" : "Save changes"}</Button>
        </div>
      )}
    </div>
  );
}
