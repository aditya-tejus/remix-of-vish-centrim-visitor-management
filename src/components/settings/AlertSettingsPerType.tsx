import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Save, Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Props {
  personType: string;
}

export function AlertSettingsPerType({ personType }: Props) {
  const { toast } = useToast();
  const [overdueEnabled, setOverdueEnabled] = useState(false);
  const [overdueThreshold, setOverdueThreshold] = useState("60");
  const [watchlistEnabled, setWatchlistEnabled] = useState(true);
  const [emailRecipients, setEmailRecipients] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [overstayHours, setOverstayHours] = useState("8");

  const prefix = `alerts_${personType}`;

  useEffect(() => {
    supabase
      .from("settings")
      .select("key, value")
      .in("key", [
        `${prefix}_overdue_enabled`, `${prefix}_overdue_threshold_mins`,
        `${prefix}_watchlist_enabled`, `${prefix}_email_recipients`,
        "alerts_overdue_enabled", "alerts_overdue_threshold_mins",
        "alerts_watchlist_enabled", "alerts_email_recipients",
        `overstay_hours_${personType}`,
      ])
      .then(({ data }) => {
        if (data) {
          const map: Record<string, string> = {};
          data.forEach((r) => { map[r.key] = r.value; });
          setOverdueEnabled((map[`${prefix}_overdue_enabled`] ?? map.alerts_overdue_enabled ?? "false") === "true");
          setOverdueThreshold(map[`${prefix}_overdue_threshold_mins`] ?? map.alerts_overdue_threshold_mins ?? "60");
          setWatchlistEnabled((map[`${prefix}_watchlist_enabled`] ?? map.alerts_watchlist_enabled ?? "true") === "true");
          try {
            setEmailRecipients(JSON.parse(map[`${prefix}_email_recipients`] ?? map.alerts_email_recipients ?? "[]"));
          } catch { setEmailRecipients([]); }
          setOverstayHours(map[`overstay_hours_${personType}`] ?? "8");
        }
      });
  }, [personType]);

  const addEmail = () => {
    const email = newEmail.trim().toLowerCase();
    if (email && email.includes("@") && !emailRecipients.includes(email)) {
      setEmailRecipients([...emailRecipients, email]);
      setNewEmail("");
    }
  };

  const save = async () => {
    setSaving(true);
    const settings = [
      { key: `${prefix}_overdue_enabled`, value: overdueEnabled ? "true" : "false" },
      { key: `${prefix}_overdue_threshold_mins`, value: overdueThreshold },
      { key: `${prefix}_watchlist_enabled`, value: watchlistEnabled ? "true" : "false" },
      { key: `${prefix}_email_recipients`, value: JSON.stringify(emailRecipients) },
      { key: `overstay_hours_${personType}`, value: String(Math.max(1, Number(overstayHours) || 8)) },
    ];
    for (const s of settings) {
      await supabase.from("settings").upsert(s, { onConflict: "key" });
    }
    toast({ title: "Alert settings saved" });
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Overdue Alert</p>
            <p className="text-xs text-muted-foreground">Alert when visit exceeds threshold</p>
          </div>
          <Switch checked={overdueEnabled} onCheckedChange={setOverdueEnabled} />
        </div>
        {overdueEnabled && (
          <div className="ml-0 flex items-center gap-2">
            <label className="text-xs text-muted-foreground">Threshold (minutes)</label>
            <Input
              type="number"
              value={overdueThreshold}
              onChange={(e) => setOverdueThreshold(e.target.value)}
              className="h-8 w-24 text-sm"
            />
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border p-4 space-y-3">
        <div>
          <p className="text-sm font-medium text-foreground">Still on site after</p>
          <p className="text-xs text-muted-foreground">
            How long is too long for this person type before the desk is warned. Shown as "Overdue" on the visit list.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={1}
            value={overstayHours}
            onChange={(e) => setOverstayHours(e.target.value)}
            className="h-8 w-24 text-sm"
          />
          <span className="text-xs text-muted-foreground">hours</span>
        </div>


      <div className="rounded-lg border border-border p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Watchlist Match</p>
            <p className="text-xs text-muted-foreground">Alert on watchlist name match during check-in</p>
          </div>
          <Switch checked={watchlistEnabled} onCheckedChange={setWatchlistEnabled} />
        </div>
      </div>

      <div className="rounded-lg border border-border p-4 space-y-3">
        <p className="text-sm font-medium text-foreground">Email Recipients</p>
        <div className="flex gap-2">
          <Input
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="email@example.com"
            className="h-8 text-sm flex-1"
            onKeyDown={(e) => { if (e.key === "Enter") addEmail(); }}
          />
          <Button variant="outline" size="sm" onClick={addEmail} className="h-8 gap-1">
            <Plus className="h-3 w-3" /> Add
          </Button>
        </div>
        {emailRecipients.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {emailRecipients.map((email) => (
              <Badge key={email} variant="secondary" className="gap-1 text-xs">
                {email}
                <button onClick={() => setEmailRecipients(emailRecipients.filter((e) => e !== email))}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      <Button onClick={save} disabled={saving} size="sm" className="gap-1.5">
        <Save className="h-3.5 w-3.5" /> {saving ? "Saving..." : "Save"}
      </Button>
    </div>
  );
}
