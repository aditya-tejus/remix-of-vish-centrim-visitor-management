import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Users } from "lucide-react";

interface Props {
  personType: string;
}

const modes = [
  { value: "search_first", label: "Search First", description: "Staff names appear only after typing 3+ characters" },
  { value: "by_department", label: "Group by Department", description: "Staff grouped by department for browsing" },
  { value: "free_text", label: "Free Text Only", description: "Visitor types a name manually — no staff list shown" },
] as const;

type StaffMode = "search_first" | "by_department" | "free_text";

export function StaffPrivacyTab({ personType }: Props) {
  const [mode, setMode] = useState<StaffMode>("search_first");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const settingKey = `kiosk_staff_lookup_mode_${personType}`;

  useEffect(() => {
    supabase
      .from("settings")
      .select("key, value")
      .in("key", [settingKey, "kiosk_staff_lookup_mode"])
      .then(({ data }) => {
        const specific = data?.find((d) => d.key === settingKey);
        const global = data?.find((d) => d.key === "kiosk_staff_lookup_mode");
        const val = specific?.value || global?.value || "search_first";
        if (val === "search_first" || val === "by_department" || val === "free_text") setMode(val);
      });
  }, [settingKey]);

  const save = async () => {
    setSaving(true);
    await supabase.from("settings").upsert(
      { key: settingKey, value: mode },
      { onConflict: "key" }
    );
    setSaving(false);
    toast({ title: "Staff lookup setting saved" });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/40">
        <Users className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Controls how staff members are displayed when a {personType} selects "Staff" during kiosk check-in. "Search First" is recommended for larger teams.
        </p>
      </div>

      <div className="space-y-2">
        {modes.map((m) => (
          <button
            key={m.value}
            onClick={() => setMode(m.value)}
            className={`w-full text-left rounded-lg border p-3 transition-all ${
              mode === m.value
                ? "border-primary bg-primary/5"
                : "border-border hover:border-muted-foreground/30"
            }`}
          >
            <p className={`text-sm font-medium ${mode === m.value ? "text-primary" : "text-foreground"}`}>{m.label}</p>
            <p className="text-xs text-muted-foreground">{m.description}</p>
          </button>
        ))}
      </div>

      <Button size="sm" onClick={save} disabled={saving}>
        {saving ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}
