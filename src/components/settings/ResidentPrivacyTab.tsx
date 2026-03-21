import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck } from "lucide-react";

interface Props {
  personType: string;
}

export function ResidentPrivacyTab({ personType }: Props) {
  const [searchFirst, setSearchFirst] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const settingKey = `kiosk_resident_lookup_mode_${personType}`;

  useEffect(() => {
    supabase
      .from("settings")
      .select("key, value")
      .in("key", [settingKey, "kiosk_resident_lookup_mode"])
      .then(({ data }) => {
        const specific = data?.find((d) => d.key === settingKey);
        const global = data?.find((d) => d.key === "kiosk_resident_lookup_mode");
        const mode = specific?.value || global?.value || "search_first";
        setSearchFirst(mode === "search_first");
      });
  }, [settingKey]);

  const save = async () => {
    setSaving(true);
    await supabase.from("settings").upsert(
      { key: settingKey, value: searchFirst ? "search_first" : "show_all" },
      { onConflict: "key" }
    );
    setSaving(false);
    toast({ title: "Resident privacy setting saved" });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/40">
        <ShieldCheck className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          When enabled, resident names are hidden on the kiosk until the visitor types at least 3 characters. This protects resident privacy and is recommended for care homes that prefer not to display a full resident directory publicly.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">Require search before showing residents</p>
          <p className="text-xs text-muted-foreground">Visitors must type 3+ characters to see matching residents</p>
        </div>
        <Switch checked={searchFirst} onCheckedChange={setSearchFirst} />
      </div>

      <Button size="sm" onClick={save} disabled={saving}>
        {saving ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}
