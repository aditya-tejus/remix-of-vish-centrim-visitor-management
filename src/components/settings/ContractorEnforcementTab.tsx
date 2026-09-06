import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ShieldAlert } from "lucide-react";

export function ContractorEnforcementTab() {
  const [block, setBlock] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    supabase
      .from("settings")
      .select("value")
      .eq("key", "contractor_credential_enforcement")
      .maybeSingle()
      .then(({ data }) => setBlock(data?.value === "block"));
  }, []);

  const save = async () => {
    setSaving(true);
    await supabase.from("settings").upsert(
      { key: "contractor_credential_enforcement", value: block ? "block" : "warn" },
      { onConflict: "key" }
    );
    setSaving(false);
    toast({ title: block ? "Entry will be blocked on missing credentials" : "Staff will be warned only" });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/40">
        <ShieldAlert className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Controls what happens when a contractor's highest-risk credential (DBS check in the UK,
          Aged Care Worker Screening in Australia) is missing or expired. The warning is always shown
          to staff — this only decides whether check-in can still be completed.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">Block entry on missing or expired credential</p>
          <p className="text-xs text-muted-foreground">
            {block ? "Check-in cannot be completed until the credential is recorded and current" : "Warn staff only — check-in can still proceed"}
          </p>
        </div>
        <Switch checked={block} onCheckedChange={setBlock} />
      </div>

      <Button size="sm" onClick={save} disabled={saving}>
        {saving ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}
