import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { KeyRound, ShieldCheck } from "lucide-react";

/**
 * Staff PIN used to open the hidden evacuation roll call on the kiosk.
 * The PIN itself is never stored or sent back to the kiosk — only a scrambled
 * version is kept, and the kiosk only ever receives a yes/no answer.
 */
export function KioskStaffPinCard() {
  const { toast } = useToast();
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [isSet, setIsSet] = useState<boolean | null>(null);

  const refresh = () =>
    (supabase as any).rpc("kiosk_pin_is_set").then(({ data }: any) => setIsSet(!!data));

  useEffect(() => { refresh(); }, []);

  const save = async () => {
    if (!/^[0-9]{4,8}$/.test(pin)) {
      toast({ title: "PIN must be 4 to 8 digits", variant: "destructive" });
      return;
    }
    if (pin !== confirm) {
      toast({ title: "The two PINs do not match", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await (supabase as any).rpc("set_kiosk_pin", { p_pin: pin });
    setSaving(false);
    if (error) {
      toast({ title: "Could not save the PIN", description: error.message, variant: "destructive" });
      return;
    }
    const { data: userData } = await supabase.auth.getUser();
    await supabase.from("audit_log").insert({
      action: "kiosk_staff_pin_updated",
      performed_by: userData.user?.email || "Admin",
      user_id: userData.user?.id ?? null,
      records_affected: 1,
      change_reason: "Kiosk staff PIN set or changed",
    });
    setPin("");
    setConfirm("");
    refresh();
    toast({ title: "Kiosk staff PIN saved" });
  };

  return (
    <Card className="rounded-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="h-4 w-4 text-primary" /> Kiosk staff PIN
        </CardTitle>
        <CardDescription>
          Staff press and hold the small shield in the kiosk footer, enter this PIN, and go straight to the
          emergency roll call without leaving kiosk mode.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isSet !== null && (
          <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <ShieldCheck className={`h-4 w-4 ${isSet ? "text-success" : "text-muted-foreground"}`} />
            {isSet ? "A PIN is currently set." : "No PIN set yet — the roll call shortcut is unavailable."}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-[13px]">New PIN</Label>
            <Input
              inputMode="numeric"
              type="password"
              maxLength={8}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              placeholder="4–8 digits"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[13px]">Confirm PIN</Label>
            <Input
              inputMode="numeric"
              type="password"
              maxLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value.replace(/\D/g, ""))}
              placeholder="Repeat"
            />
          </div>
        </div>
        <Button onClick={save} disabled={saving} className="rounded-xl">
          {saving ? "Saving…" : isSet ? "Change PIN" : "Set PIN"}
        </Button>
      </CardContent>
    </Card>
  );
}
