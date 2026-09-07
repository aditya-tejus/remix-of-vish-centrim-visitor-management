import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ShieldAlert } from "lucide-react";
import type { CredentialKey } from "@/lib/contractorCredentials";
import { MANDATORY_CREDENTIALS_KEY, parseMandatoryCredentials } from "@/hooks/useContractorEnforcement";

export function ContractorEnforcementTab() {
  const [jurisdiction, setJurisdiction] = useState<"AU" | "UK">("UK");
  const [selected, setSelected] = useState<CredentialKey[]>([]);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    supabase
      .from("settings")
      .select("key, value")
      .in("key", [MANDATORY_CREDENTIALS_KEY, "jurisdiction"])
      .then(({ data }) => {
        const jur = data?.find((d) => d.key === "jurisdiction")?.value;
        if (jur === "AU" || jur === "UK") setJurisdiction(jur);
        setSelected(parseMandatoryCredentials(data?.find((d) => d.key === MANDATORY_CREDENTIALS_KEY)?.value));
      });
  }, []);

  const options: { key: CredentialKey; label: string; hint: string }[] = [
    jurisdiction === "UK"
      ? { key: "dbs", label: "DBS Check", hint: "Criminal records check (United Kingdom)" }
      : { key: "acws", label: "Aged Care Worker Screening", hint: "Worker screening clearance (Australia)" },
    { key: "insurance", label: "Public Liability Insurance", hint: "Current cover held by the supplier" },
  ];

  const toggle = (key: CredentialKey, on: boolean) =>
    setSelected((prev) => (on ? [...new Set([...prev, key])] : prev.filter((k) => k !== key)));

  const save = async () => {
    setSaving(true);
    await supabase.from("settings").upsert(
      { key: MANDATORY_CREDENTIALS_KEY, value: JSON.stringify(selected) },
      { onConflict: "key" }
    );
    setSaving(false);
    toast({
      title: selected.length
        ? "Required credentials updated"
        : "No credentials are required — warnings only",
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/40">
        <ShieldAlert className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Tick the credentials a contractor must hold before check-in can be completed. Entry is only
          actually stopped when the contractor is marked as having <strong>unsupervised access to
          residents</strong> during screening. For escorted contractors, or those with no resident
          contact, a missing or expired credential is still shown to staff — but check-in can proceed.
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Required before check-in can proceed</p>
        {options.map((o) => (
          <label
            key={o.key}
            className="flex items-start gap-3 rounded-xl border border-border p-3 cursor-pointer"
          >
            <Checkbox
              checked={selected.includes(o.key)}
              onCheckedChange={(v) => toggle(o.key, v === true)}
              className="mt-0.5"
            />
            <span>
              <span className="block text-sm font-medium text-foreground">{o.label}</span>
              <span className="block text-xs text-muted-foreground">{o.hint}</span>
            </span>
          </label>
        ))}
      </div>

      <Button size="sm" onClick={save} disabled={saving}>
        {saving ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}
