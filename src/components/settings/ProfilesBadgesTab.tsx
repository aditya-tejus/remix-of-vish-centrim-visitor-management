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
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { UserCircle, Save, Camera, PenTool } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function ProfilesBadgesTab() {
  const { toast } = useToast();
  const [photoEnabled, setPhotoEnabled] = useState(true);
  const [photoDefault, setPhotoDefault] = useState("optional");
  const [signatureEnabled, setSignatureEnabled] = useState(false);
  const [signatureDefault, setSignatureDefault] = useState("optional");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("settings")
      .select("key, value")
      .in("key", ["profile_photo_enabled", "profile_photo_default", "profile_signature_enabled", "profile_signature_default"])
      .then(({ data }) => {
        if (data) {
          const map: Record<string, string> = {};
          data.forEach((r) => { map[r.key] = r.value; });
          setPhotoEnabled(map.profile_photo_enabled !== "false");
          setPhotoDefault(map.profile_photo_default || "optional");
          setSignatureEnabled(map.profile_signature_enabled === "true");
          setSignatureDefault(map.profile_signature_default || "optional");
        }
      });
  }, []);

  const save = async () => {
    setSaving(true);
    const settings = [
      { key: "profile_photo_enabled", value: photoEnabled ? "true" : "false" },
      { key: "profile_photo_default", value: photoDefault },
      { key: "profile_signature_enabled", value: signatureEnabled ? "true" : "false" },
      { key: "profile_signature_default", value: signatureDefault },
    ];
    for (const s of settings) {
      await supabase.from("settings").upsert(s, { onConflict: "key" });
    }
    toast({ title: "Profiles & Badges settings saved" });
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UserCircle className="h-4 w-4 text-primary" /> Profiles & Badges
          </CardTitle>
          <CardDescription className="text-xs">Configure photo capture and signature collection for each person type.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Photo */}
          <div className="rounded-lg border border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Camera className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">Visitor Photo</p>
                  <p className="text-xs text-muted-foreground">Capture a photo during check-in</p>
                </div>
              </div>
              <Switch checked={photoEnabled} onCheckedChange={setPhotoEnabled} />
            </div>
            {photoEnabled && (
              <div className="space-y-1 pl-6">
                <Label className="text-xs">Default behaviour</Label>
                <Select value={photoDefault} onValueChange={setPhotoDefault}>
                  <SelectTrigger className="h-8 text-sm w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="optional">Optional</SelectItem>
                    <SelectItem value="required">Required</SelectItem>
                    <SelectItem value="off">Off by default</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Signature */}
          <div className="rounded-lg border border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PenTool className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">Signature Capture</p>
                  <p className="text-xs text-muted-foreground">Collect a digital signature on check-in</p>
                </div>
              </div>
              <Switch checked={signatureEnabled} onCheckedChange={setSignatureEnabled} />
            </div>
            {signatureEnabled && (
              <div className="space-y-1 pl-6">
                <Label className="text-xs">Default behaviour</Label>
                <Select value={signatureDefault} onValueChange={setSignatureDefault}>
                  <SelectTrigger className="h-8 text-sm w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="optional">Optional</SelectItem>
                    <SelectItem value="required">Required</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="rounded-lg bg-muted/50 border border-border p-3">
            <p className="text-xs text-muted-foreground">
              <strong>UK GDPR note:</strong> Photo and signature capture should be OFF by default for UK jurisdictions unless explicitly required for safeguarding purposes.
            </p>
          </div>

          <Button onClick={save} disabled={saving} className="gap-1.5">
            <Save className="h-3.5 w-3.5" /> {saving ? "Saving..." : "Save Changes"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
