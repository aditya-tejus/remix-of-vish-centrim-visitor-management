/**
 * NOT IN USE (Phase 7E).
 *
 * This screen is not reachable from Settings. Its controls are covered by the
 * per-visitor-type screens that Settings does show, so keeping it visible would
 * mean the same decision existed in two places. The file is kept, unchanged in
 * behaviour, so nothing is lost if a control here still needs a home.
 */
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Shield, ExternalLink, Loader2, Save, Users, HardHat, Home, Briefcase } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const USER_TYPES = [
  { key: "visitor", label: "Visitors", icon: Users },
  { key: "contractor", label: "Contractors", icon: HardHat },
  { key: "resident", label: "Residents", icon: Home },
  { key: "staff", label: "Staff", icon: Briefcase },
] as const;

type UserTypeKey = (typeof USER_TYPES)[number]["key"];

interface TypeDocSettings {
  tc_url: string;
  privacy_url: string;
  show_in_form: boolean;
}

type AllSettings = Record<UserTypeKey, TypeDocSettings>;

const defaultTypeSettings = (): TypeDocSettings => ({
  tc_url: "",
  privacy_url: "",
  show_in_form: true,
});

const settingsKeys = (type: UserTypeKey) => ({
  tc: `branch_tc_url_${type}`,
  privacy: `branch_privacy_url_${type}`,
  show: `show_branch_docs_in_form_${type}`,
});

export function BranchDocumentsTab() {
  const [settings, setSettings] = useState<AllSettings>({
    visitor: defaultTypeSettings(),
    contractor: defaultTypeSettings(),
    resident: defaultTypeSettings(),
    staff: defaultTypeSettings(),
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetchSettings = async () => {
      const allKeys = USER_TYPES.flatMap((t) => {
        const k = settingsKeys(t.key);
        return [k.tc, k.privacy, k.show];
      });
      // Also fetch legacy keys
      allKeys.push("branch_tc_url", "branch_privacy_url", "show_branch_docs_in_form");

      const { data } = await supabase
        .from("settings")
        .select("key, value")
        .in("key", allKeys);

      if (data) {
        const map: Record<string, string> = {};
        data.forEach((r: any) => { map[r.key] = r.value; });

        const next = { ...settings };
        for (const t of USER_TYPES) {
          const k = settingsKeys(t.key);
          next[t.key] = {
            tc_url: map[k.tc] || (t.key === "visitor" ? map["branch_tc_url"] || "" : ""),
            privacy_url: map[k.privacy] || (t.key === "visitor" ? map["branch_privacy_url"] || "" : ""),
            show_in_form: map[k.show] !== undefined ? map[k.show] !== "false" : (t.key === "visitor" && map["show_branch_docs_in_form"] !== undefined ? map["show_branch_docs_in_form"] !== "false" : true),
          };
        }
        setSettings(next);
      }
      setLoading(false);
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const entries: { key: string; value: string }[] = [];
    for (const t of USER_TYPES) {
      const k = settingsKeys(t.key);
      const s = settings[t.key];
      entries.push(
        { key: k.tc, value: s.tc_url },
        { key: k.privacy, value: s.privacy_url },
        { key: k.show, value: String(s.show_in_form) },
      );
    }

    for (const entry of entries) {
      const { data: existing } = await supabase
        .from("settings")
        .select("id")
        .eq("key", entry.key)
        .maybeSingle();

      if (existing) {
        await supabase.from("settings").update({ value: entry.value, updated_at: new Date().toISOString() }).eq("key", entry.key);
      } else {
        await supabase.from("settings").insert(entry);
      }
    }

    setSaving(false);
    toast({ title: "Saved", description: "Branch document settings updated for all user types." });
  };

  const updateTypeSettings = (type: UserTypeKey, field: keyof TypeDocSettings, value: string | boolean) => {
    setSettings((prev) => ({
      ...prev,
      [type]: { ...prev[type], [field]: value },
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-5 shadow-soft">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">Branch Documents</h2>
            <p className="text-xs text-muted-foreground">
              Attach branch-specific Terms & Conditions and Privacy Policy per user type. These links are displayed in check-in/check-out forms.
            </p>
          </div>
        </div>

        <Tabs defaultValue="visitor" className="space-y-4">
          <TabsList className="bg-muted/50 p-1 rounded-xl h-auto flex-wrap">
            {USER_TYPES.map((t) => {
              const Icon = t.icon;
              return (
                <TabsTrigger key={t.key} value={t.key} className="gap-1.5 rounded-lg text-xs data-[state=active]:shadow-sm">
                  <Icon className="h-3.5 w-3.5" />
                  {t.label}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {USER_TYPES.map((t) => {
            const s = settings[t.key];
            return (
              <TabsContent key={t.key} value={t.key} className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-primary" />
                    Terms & Conditions URL
                  </Label>
                  <Input
                    value={s.tc_url}
                    onChange={(e) => updateTypeSettings(t.key, "tc_url", e.target.value)}
                    placeholder={`https://example.com/${t.key}-terms`}
                    className="rounded-lg"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Link to T&C document for {t.label.toLowerCase()} (PDF or webpage).
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5 text-primary" />
                    Privacy Policy URL
                  </Label>
                  <Input
                    value={s.privacy_url}
                    onChange={(e) => updateTypeSettings(t.key, "privacy_url", e.target.value)}
                    placeholder={`https://example.com/${t.key}-privacy`}
                    className="rounded-lg"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Link to Privacy Policy for {t.label.toLowerCase()} (PDF or webpage).
                  </p>
                </div>

                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-foreground">Show in Forms</p>
                    <p className="text-[11px] text-muted-foreground">Display document links in the {t.label.toLowerCase()} check-in/check-out forms.</p>
                  </div>
                  <Switch
                    checked={s.show_in_form}
                    onCheckedChange={(c) => updateTypeSettings(t.key, "show_in_form", c)}
                  />
                </div>


                {(s.tc_url || s.privacy_url) && (
                  <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Preview</p>
                    <div className="flex flex-wrap gap-3">
                      {s.tc_url && (
                        <a href={s.tc_url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-medium">
                          <ExternalLink className="h-3 w-3" /> Terms & Conditions
                        </a>
                      )}
                      {s.privacy_url && (
                        <a href={s.privacy_url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-medium">
                          <ExternalLink className="h-3 w-3" /> Privacy Policy
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </TabsContent>
            );
          })}
        </Tabs>

        <div className="flex justify-end mt-5">
          <Button onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save All
          </Button>
        </div>
      </div>
    </div>
  );
}
