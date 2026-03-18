import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Camera, PenTool, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Props {
  personType: string;
}

export function PhotoSignatureSettings({ personType }: Props) {
  const { toast } = useToast();
  const [photoEnabled, setPhotoEnabled] = useState(false);
  const [photoDefault, setPhotoDefault] = useState("optional");
  const [signatureEnabled, setSignatureEnabled] = useState(false);
  const [signatureDefault, setSignatureDefault] = useState("optional");
  const [saving, setSaving] = useState(false);

  const photoKey = `profile_photo_enabled_${personType}`;
  const photoDefaultKey = `profile_photo_default_${personType}`;
  const sigKey = `profile_signature_enabled_${personType}`;
  const sigDefaultKey = `profile_signature_default_${personType}`;

  useEffect(() => {
    supabase
      .from("settings")
      .select("key, value")
      .in("key", [photoKey, photoDefaultKey, sigKey, sigDefaultKey,
        "profile_photo_enabled", "profile_photo_default", "profile_signature_enabled", "profile_signature_default"])
      .then(({ data }) => {
        if (data) {
          const map: Record<string, string> = {};
          data.forEach((r) => { map[r.key] = r.value; });
          // Per-type overrides global
          setPhotoEnabled((map[photoKey] ?? map.profile_photo_enabled ?? "false") === "true");
          setPhotoDefault(map[photoDefaultKey] ?? map.profile_photo_default ?? "optional");
          setSignatureEnabled((map[sigKey] ?? map.profile_signature_enabled ?? "false") === "true");
          setSignatureDefault(map[sigDefaultKey] ?? map.profile_signature_default ?? "optional");
        }
      });
  }, [personType]);

  const save = async () => {
    setSaving(true);
    const settings = [
      { key: photoKey, value: photoEnabled ? "true" : "false" },
      { key: photoDefaultKey, value: photoDefault },
      { key: sigKey, value: signatureEnabled ? "true" : "false" },
      { key: sigDefaultKey, value: signatureDefault },
    ];
    for (const s of settings) {
      await supabase.from("settings").upsert(s, { onConflict: "key" });
    }
    toast({ title: "Photo & Signature settings saved" });
    setSaving(false);
  };

  return (
    <div className="space-y-4">
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
          <div className="ml-6 space-y-1">
            <label className="text-xs text-muted-foreground">Default behaviour</label>
            <Select value={photoDefault} onValueChange={setPhotoDefault}>
              <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="optional">Optional</SelectItem>
                <SelectItem value="required">Required</SelectItem>
                <SelectItem value="off">Off</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PenTool className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium text-foreground">Signature Capture</p>
              <p className="text-xs text-muted-foreground">Digital signature during check-in</p>
            </div>
          </div>
          <Switch checked={signatureEnabled} onCheckedChange={setSignatureEnabled} />
        </div>
        {signatureEnabled && (
          <div className="ml-6 space-y-1">
            <label className="text-xs text-muted-foreground">Default behaviour</label>
            <Select value={signatureDefault} onValueChange={setSignatureDefault}>
              <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="optional">Optional</SelectItem>
                <SelectItem value="required">Required</SelectItem>
                <SelectItem value="off">Off</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <Button onClick={save} disabled={saving} size="sm" className="gap-1.5">
        <Save className="h-3.5 w-3.5" /> {saving ? "Saving..." : "Save"}
      </Button>
    </div>
  );
}
