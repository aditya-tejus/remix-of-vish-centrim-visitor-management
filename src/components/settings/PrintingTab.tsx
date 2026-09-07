import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Printer, Save, BadgeCheck, Tag } from "lucide-react";
import { printBadge } from "@/lib/printBadge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function PrintingTab() {
  const { toast } = useToast();
  const [badgePrintingEnabled, setBadgePrintingEnabled] = useState(false);
  const [printOnCheckin, setPrintOnCheckin] = useState(false);
  const [printerModel, setPrinterModel] = useState("brother_ql820");
  const [printerIp, setPrinterIp] = useState("");
  const [labelSize, setLabelSize] = useState("62mm");
  const [labelPrinterMode, setLabelPrinterMode] = useState("standard");
  const [includePhoto, setIncludePhoto] = useState(true);
  const [includeQr, setIncludeQr] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("settings")
      .select("key, value")
      .in("key", ["badge_printing_enabled", "print_on_checkin", "printer_model", "printer_ip", "label_size", "label_printer_mode", "badge_include_photo", "badge_include_qr"])
      .then(({ data }) => {
        if (data) {
          const map: Record<string, string> = {};
          data.forEach((r) => { map[r.key] = r.value; });
          setBadgePrintingEnabled(map.badge_printing_enabled === "true");
          setPrintOnCheckin(map.print_on_checkin === "true");
          setPrinterModel(map.printer_model || "brother_ql820");
          setPrinterIp(map.printer_ip || "");
          setLabelSize(map.label_size || "62mm");
          setLabelPrinterMode(map.label_printer_mode === "label" ? "label" : "standard");
          setIncludePhoto(map.badge_include_photo !== "false");
          setIncludeQr(map.badge_include_qr !== "false");
        }
      });
  }, []);

  const save = async () => {
    setSaving(true);
    const settings = [
      { key: "badge_printing_enabled", value: badgePrintingEnabled ? "true" : "false" },
      { key: "print_on_checkin", value: printOnCheckin ? "true" : "false" },
      { key: "printer_model", value: printerModel },
      { key: "printer_ip", value: printerIp },
      { key: "label_size", value: labelSize },
      { key: "label_printer_mode", value: labelPrinterMode },
      { key: "badge_include_photo", value: includePhoto ? "true" : "false" },
      { key: "badge_include_qr", value: includeQr ? "true" : "false" },
    ];
    for (const s of settings) {
      await supabase.from("settings").upsert(s, { onConflict: "key" });
    }
    toast({ title: "Printing settings saved" });
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Printer className="h-4 w-4 text-primary" /> Badge Printing
          </CardTitle>
          <CardDescription className="text-xs">Configure visitor badge printing on check-in. Print failures will not block check-in — staff will see a toast with a reprint option.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Enable badge printing</p>
                <p className="text-xs text-muted-foreground">Show a "Print Badge" action after a successful check-in</p>
              </div>
              <Switch checked={badgePrintingEnabled} onCheckedChange={setBadgePrintingEnabled} />
            </div>
          </div>

          <div className="rounded-lg border border-border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Print badge on check-in</p>
                <p className="text-xs text-muted-foreground">Automatically print a visitor badge when check-in completes</p>
              </div>
              <Switch checked={printOnCheckin} onCheckedChange={setPrintOnCheckin} />
            </div>
          </div>

          <div className="rounded-lg border border-border p-4 space-y-3">
            <p className="text-sm font-medium text-foreground flex items-center gap-2"><Printer className="h-3.5 w-3.5" /> Printer Configuration</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Printer Model</Label>
                <Select value={printerModel} onValueChange={setPrinterModel}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="brother_ql820">Brother QL-820NWB</SelectItem>
                    <SelectItem value="brother_ql810">Brother QL-810W</SelectItem>
                    <SelectItem value="brother_ql800">Brother QL-800</SelectItem>
                    <SelectItem value="brother_ql710">Brother QL-710W</SelectItem>
                    <SelectItem value="generic">Generic Label Printer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Label Size</Label>
                <Select value={labelSize} onValueChange={setLabelSize}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="62mm">62mm</SelectItem>
                    <SelectItem value="62x29mm">62 × 29mm</SelectItem>
                    <SelectItem value="62x100mm">62 × 100mm</SelectItem>
                    <SelectItem value="29mm">29mm</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Output Format</Label>
              <Select value={labelPrinterMode} onValueChange={setLabelPrinterMode}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard printer (badge card)</SelectItem>
                  <SelectItem value="label">Brother QL label printer (exact label size)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                In label mode the badge is laid out at the exact roll size above, so choosing the Brother QL as the
                print destination produces a correctly sized label with no scaling. Silent printing without a print
                dialog requires a small local print agent on the reception PC — not yet installed.
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() =>
                printBadge(
                  { name: "Test Label", type: "visitor", visiting: "Reception", date: new Date() },
                  { mode: labelPrinterMode === "label" ? "label" : "standard", labelSize }
                )
              }
            >
              <Tag className="h-3.5 w-3.5" /> Print test label
            </Button>

            <div className="space-y-1">
              <Label className="text-xs">Printer IP Address / Hostname</Label>
              <Input value={printerIp} onChange={(e) => setPrinterIp(e.target.value)} placeholder="192.168.1.100 or printer.local" className="h-8 text-sm" />
            </div>
          </div>

          <div className="rounded-lg border border-border p-4 space-y-3">
            <p className="text-sm font-medium text-foreground flex items-center gap-2"><BadgeCheck className="h-3.5 w-3.5" /> Badge Content</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-foreground">Include visitor photo</span>
                <Switch checked={includePhoto} onCheckedChange={setIncludePhoto} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-foreground">Include QR code</span>
                <Switch checked={includeQr} onCheckedChange={setIncludeQr} />
              </div>
            </div>
          </div>

          <Button onClick={save} disabled={saving} className="gap-1.5">
            <Save className="h-3.5 w-3.5" /> {saving ? "Saving..." : "Save Changes"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
