import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { UtensilsCrossed } from "lucide-react";

interface Props {
  personType: string;
}

export function FoodRegisterSettingsTab({ personType }: Props) {
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const settingKey = `food_register_checkin_${personType}`;

  useEffect(() => {
    supabase
      .from("settings")
      .select("key, value")
      .eq("key", settingKey)
      .maybeSingle()
      .then(({ data }) => {
        setEnabled(data?.value !== "false");
      });
  }, [settingKey]);

  const save = async () => {
    setSaving(true);
    await supabase.from("settings").upsert(
      { key: settingKey, value: enabled ? "true" : "false" },
      { onConflict: "key" }
    );
    await supabase.from("audit_log").insert({
      action: "settings_update",
      performed_by: "Staff",
      records_affected: 1,
      details: { setting: settingKey, value: enabled ? "true" : "false" } as any,
      change_reason: `Food question during check-in ${enabled ? "enabled" : "disabled"} for ${personType}`,
    });
    setSaving(false);
    toast({ title: "Food register setting saved" });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/40">
        <UtensilsCrossed className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          When enabled, people visiting a named resident are asked whether they are bringing food, and the details are recorded in the Food Register. When turned off, the question is skipped during sign-in — staff can still add a food record manually from the Food Register page at any time.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">Ask about food during check-in</p>
          <p className="text-xs text-muted-foreground">Applies to the kiosk and the front-desk check-in panel</p>
        </div>
        <Switch checked={enabled} onCheckedChange={setEnabled} />
      </div>

      <Button size="sm" onClick={save} disabled={saving}>
        {saving ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}
