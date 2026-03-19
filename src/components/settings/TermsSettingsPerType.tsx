import { useState, useEffect, useCallback } from "react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Save, ExternalLink, List, ListOrdered, Type, AlignLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Props {
  personType: string;
}

type FormatAction = "bullet" | "numbered" | "heading" | "paragraph";

export function TermsSettingsPerType({ personType }: Props) {
  const { toast } = useToast();
  const [showTerms, setShowTerms] = useState(true);
  const [tcUrl, setTcUrl] = useState("");
  const [privacyUrl, setPrivacyUrl] = useState("");
  const [tcContent, setTcContent] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("settings")
      .select("key, value")
      .in("key", [
        `show_terms_${personType}`, `tc_url_${personType}`, `privacy_url_${personType}`,
        `tc_content_${personType}`,
        "show_branch_docs_in_form", "branch_tc_url", "branch_privacy_url",
      ])
      .then(({ data }) => {
        if (data) {
          const map: Record<string, string> = {};
          data.forEach((r) => { map[r.key] = r.value; });
          setShowTerms((map[`show_terms_${personType}`] ?? map.show_branch_docs_in_form ?? "true") !== "false");
          setTcUrl(map[`tc_url_${personType}`] ?? map.branch_tc_url ?? "");
          setPrivacyUrl(map[`privacy_url_${personType}`] ?? map.branch_privacy_url ?? "");
          setTcContent(map[`tc_content_${personType}`] ?? "");
        }
      });
  }, [personType]);

  const save = async () => {
    setSaving(true);
    const settings = [
      { key: `show_terms_${personType}`, value: showTerms ? "true" : "false" },
      { key: `tc_url_${personType}`, value: tcUrl },
      { key: `privacy_url_${personType}`, value: privacyUrl },
      { key: `tc_content_${personType}`, value: tcContent },
    ];
    for (const s of settings) {
      await supabase.from("settings").upsert(s, { onConflict: "key" });
    }
    toast({ title: "Terms & Conditions settings saved" });
    setSaving(false);
  };

  const insertFormat = useCallback((action: FormatAction) => {
    const textarea = document.getElementById(`tc-content-${personType}`) as HTMLTextAreaElement | null;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = tcContent;
    const selectedText = text.substring(start, end);
    let replacement = "";

    switch (action) {
      case "bullet": {
        const lines = selectedText ? selectedText.split("\n") : [""];
        replacement = lines.map((l) => `• ${l}`).join("\n");
        break;
      }
      case "numbered": {
        const lines = selectedText ? selectedText.split("\n") : [""];
        replacement = lines.map((l, i) => `${i + 1}. ${l}`).join("\n");
        break;
      }
      case "heading":
        replacement = selectedText ? selectedText.toUpperCase() : "";
        break;
      case "paragraph":
        replacement = selectedText ? `\n${selectedText}\n` : "\n";
        break;
    }

    const newText = text.substring(0, start) + replacement + text.substring(end);
    setTcContent(newText);

    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + replacement.length, start + replacement.length);
    });
  }, [tcContent, personType]);

  const formatButtons: { action: FormatAction; icon: typeof List; label: string }[] = [
    { action: "heading", icon: Type, label: "Heading" },
    { action: "bullet", icon: List, label: "Bullet list" },
    { action: "numbered", icon: ListOrdered, label: "Numbered list" },
    { action: "paragraph", icon: AlignLeft, label: "Paragraph" },
  ];

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
        <div className="space-y-4">
          {/* Terms & Conditions Content */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Terms & Conditions</label>
            <div className="rounded-lg border border-border overflow-hidden">
              {/* Formatting toolbar */}
              <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-border bg-muted/30">
                {formatButtons.map((btn) => {
                  const Icon = btn.icon;
                  return (
                    <button
                      key={btn.action}
                      type="button"
                      onClick={() => insertFormat(btn.action)}
                      title={btn.label}
                      className={cn(
                        "h-8 w-8 flex items-center justify-center rounded-md",
                        "text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </button>
                  );
                })}
              </div>
              {/* Content area */}
              <Textarea
                id={`tc-content-${personType}`}
                value={tcContent}
                onChange={(e) => setTcContent(e.target.value)}
                placeholder="Enter the terms and conditions that visitors must agree to before check-in..."
                className="min-h-[200px] border-0 rounded-none resize-y focus-visible:ring-0 focus-visible:ring-offset-0 text-sm leading-relaxed"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              This content will be displayed to {personType}s during check-in for their acknowledgement.
            </p>
          </div>

          {/* URL fields */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Terms & Conditions URL (optional)</label>
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
              <label className="text-xs font-medium text-muted-foreground">Privacy Policy URL (optional)</label>
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
        </div>
      )}

      <Button onClick={save} disabled={saving} size="sm" className="gap-1.5">
        <Save className="h-3.5 w-3.5" /> {saving ? "Saving..." : "Save"}
      </Button>
    </div>
  );
}
