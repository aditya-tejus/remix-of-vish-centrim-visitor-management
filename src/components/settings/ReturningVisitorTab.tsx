import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { RotateCcw } from "lucide-react";

interface Props {
  personType: string;
}

const OPTIONS = [
  {
    suffix: "kiosk_returning_mobile",
    title: "Recognise by mobile number",
    description: "Visitor types their mobile and we pre-fill their saved details.",
  },
  {
    suffix: "kiosk_returning_qr",
    title: "Recognise by personal QR card",
    description: "Visitor scans the permanent code issued on their first visit.",
  },
  {
    suffix: "kiosk_returning_name",
    title: "Recognise by name",
    description: "Visitor types their first name and surname to be matched.",
  },
  {
    suffix: "kiosk_suggest_last_resident",
    title: "Suggest the person they visited last time",
    description: "Offers a one-tap shortcut on the 'who are you visiting' step.",
  },
];

export function ReturningVisitorTab({ personType }: Props) {
  const [values, setValues] = useState<Record<string, boolean>>({});
  const [fastLane, setFastLane] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { siteId } = useOperatingContext();

  const keyFor = (suffix: string) => `${suffix}_${personType}`;
  const fastLaneKey = siteId ? siteScopedKey(FAST_LANE_KEY, siteId) : FAST_LANE_KEY;

  useEffect(() => {
    const keys = [...OPTIONS.map((o) => keyFor(o.suffix)), fastLaneKey, FAST_LANE_KEY];
    supabase
      .from("settings")
      .select("key, value")
      .in("key", keys)
      .then(({ data }) => {
        const next: Record<string, boolean> = {};
        for (const o of OPTIONS) {
          next[o.suffix] = data?.find((d) => d.key === keyFor(o.suffix))?.value === "true";
        }
        setValues(next);
        const raw =
          data?.find((d) => d.key === fastLaneKey)?.value ??
          data?.find((d) => d.key === FAST_LANE_KEY)?.value;
        setFastLane(raw === "true");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personType, fastLaneKey]);

  const save = async () => {
    setSaving(true);
    await supabase.from("settings").upsert(
      [
        ...OPTIONS.map((o) => ({ key: keyFor(o.suffix), value: values[o.suffix] ? "true" : "false" })),
        { key: fastLaneKey, value: fastLane ? "true" : "false" },
      ],
      { onConflict: "key" }
    );
    setSaving(false);
    toast({ title: "Returning visitor settings saved" });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/40">
        <RotateCcw className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Regular visitors — family members who come in most days — can be recognised at the kiosk so they don't
          re-type the same details every visit. Check-in questions, terms and food questions are always asked fresh.
          With every option off, the kiosk behaves exactly as it does today.
        </p>
      </div>

      {OPTIONS.map((o) => (
        <div key={o.suffix} className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-foreground">{o.title}</p>
            <p className="text-xs text-muted-foreground">{o.description}</p>
          </div>
          <Switch
            checked={!!values[o.suffix]}
            onCheckedChange={(v) => setValues((prev) => ({ ...prev, [o.suffix]: v }))}
          />
        </div>
      ))}

      <Button size="sm" onClick={save} disabled={saving}>
        {saving ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}
