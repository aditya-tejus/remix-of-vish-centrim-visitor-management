import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Globe, Save, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export function PresenceTab() {
  const [jurisdiction, setJurisdiction] = useState<"AU" | "UK">("AU");
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    supabase
      .from("settings")
      .select("key, value")
      .eq("key", "jurisdiction")
      .maybeSingle()
      .then(({ data }) => {
        if (data && (data.value === "AU" || data.value === "UK")) {
          setJurisdiction(data.value as "AU" | "UK");
        }
        setLoaded(true);
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("settings")
      .upsert({ key: "jurisdiction", value: jurisdiction }, { onConflict: "key" });
    setSaving(false);
    if (error) {
      toast({ title: "Error", description: "Failed to save jurisdiction setting.", variant: "destructive" });
    } else {
      toast({ title: "Saved", description: `Jurisdiction set to ${jurisdiction === "AU" ? "Australia" : "United Kingdom"}.` });
    }
  };

  if (!loaded) return null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" />
            Jurisdiction & Region
          </CardTitle>
          <CardDescription className="text-[13px]">
            Controls screening templates, GDPR defaults, and compliance requirements.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Operating Jurisdiction</Label>
            <Select value={jurisdiction} onValueChange={(v) => setJurisdiction(v as "AU" | "UK")}>
              <SelectTrigger className="w-[280px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AU">
                  <span className="flex items-center gap-2">🇦🇺 Australia (WHS / SWMS)</span>
                </SelectItem>
                <SelectItem value="UK">
                  <span className="flex items-center gap-2">🇬🇧 United Kingdom (H&S / RAMS)</span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
            <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider">Current configuration</p>
            <div className="flex flex-wrap gap-2">
              {jurisdiction === "AU" ? (
                <>
                  <Badge variant="outline" className="text-[11px]">SWMS required for contractors</Badge>
                  <Badge variant="outline" className="text-[11px]">PPE compliance (WHS)</Badge>
                  <Badge variant="outline" className="text-[11px]">ABN verification</Badge>
                  <Badge variant="outline" className="text-[11px]">Photo/signature ON by default</Badge>
                </>
              ) : (
                <>
                  <Badge variant="outline" className="text-[11px]">RAMS required for contractors</Badge>
                  <Badge variant="outline" className="text-[11px]">DBS check verification</Badge>
                  <Badge variant="outline" className="text-[11px]">Safeguarding awareness</Badge>
                  <Badge variant="outline" className="text-[11px]">GDPR minimisation ON</Badge>
                  <Badge variant="outline" className="text-[11px]">Photo/signature OFF by default</Badge>
                </>
              )}
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving ? <Save className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Save Jurisdiction
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
