/**
 * NOT IN USE (Phase 7E).
 *
 * This screen is not reachable from Settings. Its controls are covered by the
 * per-visitor-type screens that Settings does show, so keeping it visible would
 * mean the same decision existed in two places. The file is kept, unchanged in
 * behaviour, so nothing is lost if a control here still needs a home.
 */
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Bell, Save, Plus, X, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function AlertsTab() {
  const { toast } = useToast();
  const [overdueEnabled, setOverdueEnabled] = useState(true);
  const [overdueThresholdMins, setOverdueThresholdMins] = useState("30");
  const [watchlistEnabled, setWatchlistEnabled] = useState(true);
  const [emailRecipients, setEmailRecipients] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("settings")
      .select("key, value")
      .in("key", ["alerts_overdue_enabled", "alerts_overdue_threshold_mins", "alerts_watchlist_enabled", "alerts_email_recipients"])
      .then(({ data }) => {
        if (data) {
          const map: Record<string, string> = {};
          data.forEach((r) => { map[r.key] = r.value; });
          setOverdueEnabled(map.alerts_overdue_enabled !== "false");
          setOverdueThresholdMins(map.alerts_overdue_threshold_mins || "30");
          setWatchlistEnabled(map.alerts_watchlist_enabled !== "false");
          try { setEmailRecipients(JSON.parse(map.alerts_email_recipients || "[]")); } catch { setEmailRecipients([]); }
        }
      });
  }, []);

  const addEmail = () => {
    const trimmed = newEmail.trim();
    if (trimmed && !emailRecipients.includes(trimmed)) {
      setEmailRecipients((prev) => [...prev, trimmed]);
      setNewEmail("");
    }
  };

  const save = async () => {
    setSaving(true);
    const settings = [
      { key: "alerts_overdue_enabled", value: overdueEnabled ? "true" : "false" },
      { key: "alerts_overdue_threshold_mins", value: overdueThresholdMins },
      { key: "alerts_watchlist_enabled", value: watchlistEnabled ? "true" : "false" },
      { key: "alerts_email_recipients", value: JSON.stringify(emailRecipients) },
    ];
    for (const s of settings) {
      await supabase.from("settings").upsert(s, { onConflict: "key" });
    }
    toast({ title: "Alert settings saved" });
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" /> Alert Configuration
          </CardTitle>
          <CardDescription className="text-xs">Configure when and how alerts are triggered for overdue visitors and watchlist matches.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Overdue alerts */}
          <div className="rounded-lg border border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Overdue Visitor Alerts</p>
                <p className="text-xs text-muted-foreground">Trigger alerts when visitors exceed their expected stay</p>
              </div>
              <Switch checked={overdueEnabled} onCheckedChange={setOverdueEnabled} />
            </div>
            {overdueEnabled && (
              <div className="flex items-center gap-2 pl-1">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <Label className="text-xs text-muted-foreground">Threshold:</Label>
                <Input type="number" value={overdueThresholdMins} onChange={(e) => setOverdueThresholdMins(e.target.value)}
                  className="w-20 h-8 text-sm" min={5} />
                <span className="text-xs text-muted-foreground">minutes</span>
              </div>
            )}
          </div>

          {/* Watchlist alerts */}
          <div className="rounded-lg border border-border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Watchlist Match Alerts</p>
                <p className="text-xs text-muted-foreground">Alert staff when a checked-in visitor matches the watchlist</p>
              </div>
              <Switch checked={watchlistEnabled} onCheckedChange={setWatchlistEnabled} />
            </div>
          </div>

          {/* Email recipients */}
          <div className="rounded-lg border border-border p-4 space-y-3">
            <p className="text-sm font-medium text-foreground">Email Recipients</p>
            <p className="text-xs text-muted-foreground">Staff who receive alert email notifications</p>
            <div className="flex gap-2">
              <Input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="staff@example.com"
                className="text-sm h-8" onKeyDown={(e) => e.key === "Enter" && addEmail()} />
              <Button variant="outline" size="sm" className="h-8 gap-1" onClick={addEmail}><Plus className="h-3 w-3" /> Add</Button>
            </div>
            {emailRecipients.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {emailRecipients.map((email) => (
                  <span key={email} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-foreground">
                    {email}
                    <button onClick={() => setEmailRecipients((prev) => prev.filter((e) => e !== email))} className="text-muted-foreground hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <Button onClick={save} disabled={saving} className="gap-1.5">
            <Save className="h-3.5 w-3.5" /> {saving ? "Saving..." : "Save Changes"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
