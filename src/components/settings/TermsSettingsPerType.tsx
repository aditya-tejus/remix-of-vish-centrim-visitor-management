import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Save, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Props {
  personType: string;
}

export function TermsSettingsPerType({ personType }: Props) {
  const { toast } = useToast();
  const [showTerms, setShowTerms] = useState(true);
  const [tcUrl, setTcUrl] = useState("");
  const [privacyUrl, setPrivacyUrl] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("settings")
      .select("key, value")
      .in("key", [
        `show_terms_${personType}`, `tc_url_${personType}`, `privacy_url_${personType}`,
        "show_branch_docs_in_form", "branch_tc_url", "branch_privacy_url",
      ])
      .then(({ data }) => {
        if (data) {
          const map: Record<string, string> = {};
          data.forEach((r) => { map[r.key] = r.value; });
          setShowTerms((map[`show_terms_${personType}`] ?? map.show_branch_docs_in_form ?? "true") !== "false");
          setTcUrl(map[`tc_url_${personType}`] ?? map.branch_tc_url ?? "");
          setPrivacyUrl(map[`privacy_url_${personType}`] ?? map.branch_privacy_url ?? "");
        }
      });
  }, [personType]);

  const save = async () => {
    setSaving(true);
    const settings = [
      { key: `show_terms_${personType}`, value: showTerms ? "true" : "false" },
      { key: `tc_url_${personType}`, value: tcUrl },
      { key: `privacy_url_${personType}`, value: privacyUrl },
    ];
    for (const s of settings) {
      await supabase.from("settings").upsert(s, { onConflict: "key" });
    }
    toast({ title: "Terms & Conditions settings saved" });
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Show Terms During Check-In</p>
            <p className="text-xs text-muted-foreground">Display T&C and privacy notice in the check-in flow</p>
          </div>
          <Switch checked={showTerms} onCheckedChange={setShowTerms} />
        </div>
      </div>

      {showTerms && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Terms & Conditions URL</label>
            <div className="flex gap-2">
              <Input
                value={tcUrl}
                onChange={(e) => setTcUrl(e.target.value)}
                placeholder="https://example.com/terms"
                className="h-8 text-sm flex-1"
              />
              {tcUrl && (
                <a href={tcUrl} target="_blank" rel="noopener noreferrer" className="h-8 w-8 flex items-center justify-center rounded-md border border-border hover:bg-muted">
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                </a>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Privacy Policy URL</label>
            <div className="flex gap-2">
              <Input
                value={privacyUrl}
                onChange={(e) => setPrivacyUrl(e.target.value)}
                placeholder="https://example.com/privacy"
                className="h-8 text-sm flex-1"
              />
              {privacyUrl && (
                <a href={privacyUrl} target="_blank" rel="noopener noreferrer" className="h-8 w-8 flex items-center justify-center rounded-md border border-border hover:bg-muted">
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      <Button onClick={save} disabled={saving} size="sm" className="gap-1.5">
        <Save className="h-3.5 w-3.5" /> {saving ? "Saving..." : "Save"}
      </Button>
    </div>
  );
}
