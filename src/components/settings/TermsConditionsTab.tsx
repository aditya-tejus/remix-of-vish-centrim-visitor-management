import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ScrollText, ExternalLink, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function TermsConditionsTab() {
  const { toast } = useToast();
  const [tcUrl, setTcUrl] = useState("");
  const [privacyUrl, setPrivacyUrl] = useState("");
  const [showInForm, setShowInForm] = useState(true);
  const [customTermsText, setCustomTermsText] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("settings")
      .select("key, value")
      .in("key", ["branch_tc_url", "branch_privacy_url", "show_branch_docs_in_form", "custom_terms_text"])
      .then(({ data }) => {
        if (data) {
          const map: Record<string, string> = {};
          data.forEach((r) => { map[r.key] = r.value; });
          setTcUrl(map.branch_tc_url || "");
          setPrivacyUrl(map.branch_privacy_url || "");
          setShowInForm(map.show_branch_docs_in_form !== "false");
          setCustomTermsText(map.custom_terms_text || "");
        }
      });
  }, []);

  const save = async () => {
    setSaving(true);
    const settings = [
      { key: "branch_tc_url", value: tcUrl },
      { key: "branch_privacy_url", value: privacyUrl },
      { key: "show_branch_docs_in_form", value: showInForm ? "true" : "false" },
      { key: "custom_terms_text", value: customTermsText },
    ];
    for (const s of settings) {
      await supabase.from("settings").upsert(s, { onConflict: "key" });
    }
    toast({ title: "Terms & Conditions settings saved" });
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ScrollText className="h-4 w-4 text-primary" /> Terms & Conditions
          </CardTitle>
          <CardDescription className="text-xs">Configure the terms, conditions, and privacy documents shown during check-in.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium text-foreground">Show documents in check-in form</p>
              <p className="text-xs text-muted-foreground">Links to T&C and Privacy documents will appear on the confirmation step</p>
            </div>
            <Switch checked={showInForm} onCheckedChange={setShowInForm} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Terms & Conditions URL</Label>
            <div className="flex gap-2">
              <Input value={tcUrl} onChange={(e) => setTcUrl(e.target.value)} placeholder="https://example.com/terms" className="text-sm" />
              {tcUrl && (
                <Button variant="outline" size="icon" className="shrink-0" asChild>
                  <a href={tcUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a>
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Privacy Policy URL</Label>
            <div className="flex gap-2">
              <Input value={privacyUrl} onChange={(e) => setPrivacyUrl(e.target.value)} placeholder="https://example.com/privacy" className="text-sm" />
              {privacyUrl && (
                <Button variant="outline" size="icon" className="shrink-0" asChild>
                  <a href={privacyUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a>
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Custom Terms Text (shown inline)</Label>
            <Textarea value={customTermsText} onChange={(e) => setCustomTermsText(e.target.value)}
              placeholder="Enter custom terms text shown during check-in confirmation..."
              className="min-h-[100px] resize-none text-sm" />
            <p className="text-[10px] text-muted-foreground">Leave blank to use the default terms text.</p>
          </div>

          <Button onClick={save} disabled={saving} className="gap-1.5">
            <Save className="h-3.5 w-3.5" /> {saving ? "Saving..." : "Save Changes"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
