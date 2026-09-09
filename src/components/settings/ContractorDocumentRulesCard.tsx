import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { FileCheck2, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSite } from "@/contexts/SiteContext";
import { useCredentialTypes } from "@/hooks/useContractorEnforcement";
import { useDocumentRequirements } from "@/hooks/useContractorDocuments";
import { useSectionAccess } from "@/components/settings/SettingsAccessContext";

/**
 * Which contractor documents this site insists on, how long after expiry is
 * tolerated, and whether an outstanding document stops work or only flags it.
 *
 * Nothing here is a legal requirement. Every value starts switched off so the
 * operator makes the decision, including whether background checks or health
 * evidence may lawfully be collected at all.
 */
export function ContractorDocumentRulesCard() {
  const { currentSiteId } = useSite();
  const { activeTypes } = useCredentialTypes();
  const { rows, save } = useDocumentRequirements(currentSiteId);
  const { canEdit } = useSectionAccess();
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  const ruleFor = (typeId: string) =>
    rows.find((r) => r.credential_type_id === typeId && r.branch_id === currentSiteId) ||
    rows.find((r) => r.credential_type_id === typeId && r.branch_id === null) ||
    null;

  const update = async (
    typeId: string,
    patch: { isMandatory?: boolean; graceDays?: number; blockOnFail?: boolean }
  ) => {
    const current = ruleFor(typeId);
    setBusy(typeId);
    try {
      await save({
        credentialTypeId: typeId,
        isMandatory: patch.isMandatory ?? current?.is_mandatory ?? false,
        graceDays: patch.graceDays ?? current?.grace_days ?? 0,
        blockOnFail: patch.blockOnFail ?? current?.block_on_fail ?? false,
      });
    } catch (e: any) {
      toast({ title: "Could not save", description: e?.message || "", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="p-5 space-y-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <FileCheck2 className="h-4 w-4 text-primary" aria-hidden="true" /> Contractor document rules
        </h3>
        <p className="text-[12px] text-muted-foreground">
          Saved for this site only. Everything starts switched off — your organisation decides what
          it requires and what it may lawfully collect.
        </p>
      </div>

      <div className="rounded-xl border border-border divide-y divide-border">
        {activeTypes.map((t) => {
          const rule = ruleFor(t.id);
          const mandatory = rule?.is_mandatory ?? false;
          return (
            <div key={t.id} className="p-3.5 space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-foreground truncate">{t.label}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {t.holder_scope === "person" ? "Held by the person" : "Held by the company"}
                    {rule?.branch_id === null && mandatory ? " · from the account-wide rule" : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!mandatory && <Badge variant="outline" className="text-[10px]">Not required</Badge>}
                  <Switch
                    checked={mandatory}
                    disabled={!canEdit || busy === t.id}
                    aria-label={`Require ${t.label} at this site`}
                    onCheckedChange={(v) => update(t.id, { isMandatory: v })}
                  />
                </div>
              </div>

              {mandatory && (
                <div className="grid grid-cols-2 gap-3 pl-1">
                  <div className="space-y-1">
                    <Label htmlFor={`grace-${t.id}`} className="text-[11px]">Grace period after expiry (days)</Label>
                    <Input
                      id={`grace-${t.id}`}
                      type="number"
                      min={0}
                      max={365}
                      disabled={!canEdit || busy === t.id}
                      defaultValue={rule?.grace_days ?? 0}
                      onBlur={(e) => update(t.id, { graceDays: Math.max(0, Number(e.target.value) || 0) })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`block-${t.id}`} className="text-[11px]">Stop work when outstanding</Label>
                    <div className="flex items-center gap-2 h-10">
                      <Switch
                        id={`block-${t.id}`}
                        checked={rule?.block_on_fail ?? false}
                        disabled={!canEdit || busy === t.id}
                        aria-label={`Stop work when ${t.label} is outstanding`}
                        onCheckedChange={(v) => update(t.id, { blockOnFail: v })}
                      />
                      <span className="text-[12px] text-muted-foreground">
                        {rule?.block_on_fail ? "Blocks check-in" : "Flags only"}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden="true" />
        Police or background checks and vaccination or health evidence should only be switched on
        where your organisation has confirmed it may lawfully collect and keep them.
      </p>
    </Card>
  );
}
