import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Globe, Save, Check, Users, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export function PresenceTab() {
  const [jurisdiction, setJurisdiction] = useState<"AU" | "UK">("AU");
  const [siteStructure, setSiteStructure] = useState<"rac" | "rv" | "mixed">("rac");
  const [maxVisitors, setMaxVisitors] = useState("");
  const [outbreakMode, setOutbreakMode] = useState(false);
  const [savingOps, setSavingOps] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    supabase
      .from("settings")
      .select("key, value")
      .in("key", ["jurisdiction", "max_visitors_on_site", "outbreak_mode", "site_structure"])
      .then(({ data }) => {
        const map: Record<string, string> = {};
        (data || []).forEach((r) => { map[r.key] = r.value; });
        if (map.jurisdiction === "AU" || map.jurisdiction === "UK") {
          setJurisdiction(map.jurisdiction as "AU" | "UK");
        }
        if (["rac", "rv", "mixed"].includes(map.site_structure)) {
          setSiteStructure(map.site_structure as "rac" | "rv" | "mixed");
        }
        setMaxVisitors(map.max_visitors_on_site || "");
        setOutbreakMode(map.outbreak_mode === "true");
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
      setJurisdictionError("The country setting was not saved. Your choice is still on screen — try again.");
      toast({ title: "Country setting was not saved", variant: "destructive" });
    } else {
      setJurisdictionError(null);
      toast({ title: "Saved", description: `Country set to ${jurisdiction === "AU" ? "Australia" : "United Kingdom"}.` });
    }
  };

  const saveOps = async () => {
    setSavingOps(true);
    const rows = [
      { key: "max_visitors_on_site", value: maxVisitors.trim() },
      { key: "outbreak_mode", value: outbreakMode ? "true" : "false" },
      { key: "site_structure", value: siteStructure },
    ];
    const failed: string[] = [];
    for (const row of rows) {
      const { error } = await supabase.from("settings").upsert(row, { onConflict: "key" });
      if (error) failed.push(LABELS[row.key] || row.key);
    }
    setSavingOps(false);
    if (failed.length) {
      setOpsError(
        `Could not save: ${failed.join(", ")}. Your choices are still on screen — try again.`
      );
      toast({ title: "Occupancy settings were not saved", variant: "destructive" });
      return;
    }
    setOpsError(null);
    toast({ title: "Saved", description: "Occupancy and outbreak settings updated." });
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Occupancy & Outbreak Controls
          </CardTitle>
          <CardDescription className="text-[13px]">
            Set a live cap on visitors on site and switch the home into outbreak precautions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Maximum visitors on site at once</Label>
            <Input
              type="number"
              min={1}
              value={maxVisitors}
              onChange={(e) => setMaxVisitors(e.target.value)}
              placeholder="Leave blank for no limit"
              className="w-[280px]"
            />
            <p className="text-[12px] text-muted-foreground">
              A live count is shown in the header; it turns amber near the limit and red once reached.
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">What kind of site is this?</Label>
            <Select value={siteStructure} onValueChange={(v) => setSiteStructure(v as "rac" | "rv" | "mixed")}>
              <SelectTrigger className="w-[320px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rac">Residential aged care / care home (wings and rooms)</SelectItem>
                <SelectItem value="rv">Retirement village (stages and villas)</SelectItem>
                <SelectItem value="mixed">Mixed site (both)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[12px] text-muted-foreground">
              Sets the wording used across the roll call and evacuation reports.
            </p>
          </div>

          <div className="rounded-lg border border-border p-4 flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground flex items-center gap-2">
                <ShieldAlert className="h-3.5 w-3.5 text-warning" /> Outbreak Mode
              </p>
              <p className="text-[12px] text-muted-foreground">
                When on, the self-service kiosk stops check-in completely on a positive symptom answer or a high
                temperature. When off, reception can still override at the front desk.
              </p>
            </div>
            <Switch checked={outbreakMode} onCheckedChange={setOutbreakMode} />
          </div>

          <Button onClick={saveOps} disabled={savingOps} className="gap-1.5">
            {savingOps ? <Save className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Save Controls
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
