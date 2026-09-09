import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSectionAccess } from "@/components/settings/SettingsAccessContext";
import { useSite } from "@/contexts/SiteContext";
import { useOperatingContext } from "@/contexts/OperatingContext";
import { SEGMENT_PACK_LIST, SegmentPackId, packById } from "@/lib/segmentPacks";
import { SettingExplainer } from "@/components/settings/SettingExplainer";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Check, Lock, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

const HIERARCHY = [
  { level: "Country", note: "Privacy wording and document names." },
  { level: "Organisation", note: "Shared decisions across every site." },
  { level: "Site", note: "The kind of place this is, and its wording." },
  { level: "Area", note: "Wing, stage or property differences." },
  { level: "Person type", note: "What each type of person is asked." },
  { level: "Role", note: "What a staff role is allowed to change." },
];

export function OperatingContextTab() {
  const { canEdit } = useSectionAccess();
  const { currentSite } = useSite();
  const { pack, siteName, source, refresh, loading } = useOperatingContext();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [choice, setChoice] = useState<SegmentPackId | null>(null);

  const isAdmin = canEdit;
  const selected = packById(choice ?? pack.id);

  const save = async () => {
    if (!isAdmin) return;
    setSaving(true);
    const next = selected;
    if (currentSite) {
      await supabase
        .from("branches")
        .update({ jurisdiction: next.jurisdiction, site_structure: next.structure })
        .eq("id", currentSite.id);
    } else {
      await supabase.from("settings").upsert(
        [
          { key: "jurisdiction", value: next.jurisdiction },
          { key: "site_structure", value: next.structure },
        ],
        { onConflict: "key" }
      );
    }
    await supabase.from("audit_log").insert({
      action: "settings_update",
      performed_by: "Admin",
      records_affected: 1,
      details: { setting: "operating_context", site: currentSite?.name ?? "account default", value: next.id } as any,
      change_reason: "Operating context changed",
    });
    setSaving(false);
    setChoice(null);
    refresh();
    toast({ title: "Operating context saved", description: `${next.label} now applies to ${currentSite?.name ?? "this account"}.` });
  };

  return (
    <div className="space-y-5">
      <SettingExplainer
        title="Operating context"
        controls="The words this site uses, which optional registers appear, which questions are offered and which privacy wording is shown."
        appliesTo={siteName ? `${siteName} only` : "This account, until sites are set up"}
        changeableBy="Administrators only. Reception users see the result, not the choice."
        inherited={`${pack.label} (from ${source})`}
        kioskEffect="Kiosk wording, the tiles offered and the questions asked change immediately."
        deskEffect="Lists, resident details, roll call and privacy pages change wording immediately."
        existingRecords="No saved visit, resident or document record is altered or deleted."
      />

      {!isAdmin && (
        <div className="flex items-start gap-2 rounded-xl border border-border bg-muted/40 p-3">
          <Lock className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
          <p className="text-[13px] text-muted-foreground">
            Only an administrator can change the operating context. This site is currently set up as{" "}
            <span className="font-medium text-foreground">{pack.label}</span>.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {SEGMENT_PACK_LIST.map((p) => {
          const active = selected.id === p.id;
          return (
            <button
              key={p.id}
              type="button"
              disabled={!isAdmin || loading}
              onClick={() => setChoice(p.id)}
              className={cn(
                "w-full text-left rounded-xl border p-4 transition-colors",
                active ? "border-primary bg-primary/5" : "border-border bg-card",
                !isAdmin && "cursor-default opacity-90"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{p.label}</p>
                  <p className="text-[13px] text-muted-foreground mt-0.5">{p.description}</p>
                </div>
                {active && <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />}
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {[p.terms.site, p.terms.area, p.terms.place, ...(p.terms.property ? [p.terms.property] : []), ...(p.terms.household ? [p.terms.household] : [])].map((t) => (
                  <span key={t} className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                    {t}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>

      {isAdmin && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Choosing a context changes wording and which optional registers appear. It does not, on its own, prove legal compliance.
          </p>
          <Button onClick={save} disabled={saving || (choice ?? pack.id) === pack.id}>
            {saving ? "Saving…" : "Save context"}
          </Button>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">How a setting is decided</h3>
        </div>
        <ol className="space-y-1.5">
          {HIERARCHY.map((h, i) => (
            <li key={h.level} className="grid grid-cols-[20px_120px_1fr] gap-2 items-baseline">
              <span className="text-[11px] text-muted-foreground">{i + 1}.</span>
              <span className="text-[13px] font-medium text-foreground">{h.level}</span>
              <span className="text-[13px] text-muted-foreground">{h.note}</span>
            </li>
          ))}
        </ol>
        <p className="text-xs text-muted-foreground mt-3">
          The most specific value wins: an area setting beats a site setting, a site setting beats the account default.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 space-y-2">
        <h3 className="text-sm font-semibold text-foreground">What this context shows today</h3>
        <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-[13px]">
          <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Site is called</dt><dd className="text-foreground">{pack.terms.site}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Areas are called</dt><dd className="text-foreground">{pack.terms.areaPlural}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Places are called</dt><dd className="text-foreground">{pack.terms.placePlural}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Roll call grouped by</dt><dd className="text-foreground">{pack.emergencyGrouping.join(" → ")}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Keys and fobs register</dt><dd className="text-foreground">{pack.modules.keysRegister ? "On" : "Off"}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Food register</dt><dd className="text-foreground">{pack.modules.foodRegister ? "On" : "Off"}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Care support details</dt><dd className="text-foreground">{pack.modules.clinicalSupportFields ? "Shown" : "Hidden"}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Privacy wording</dt><dd className="text-foreground">{pack.privacy.regimeName}</dd></div>
        </dl>
        <p className="text-xs text-muted-foreground pt-1">{pack.privacy.retentionNote}</p>
      </div>
    </div>
  );
}
