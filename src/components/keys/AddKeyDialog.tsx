import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import type { Resident } from "@/hooks/useResidents";
import { ChevronDown, DoorOpen, Mail, Car, CreditCard, KeyRound, Nfc, MoreHorizontal } from "lucide-react";

export const KEY_TYPES = [
  { value: "property", label: "Front door", icon: DoorOpen },
  { value: "mailbox", label: "Mailbox", icon: Mail },
  { value: "garage", label: "Garage / shed", icon: Car },
  { value: "fob", label: "Access fob", icon: Nfc },
  { value: "card", label: "Swipe card", icon: CreditCard },
  { value: "master", label: "Master key", icon: KeyRound },
  { value: "other", label: "Other", icon: MoreHorizontal },
];

export const keyTypeLabel = (value: string) =>
  KEY_TYPES.find((t) => t.value === value)?.label || value;


interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  residents: Resident[];
  onAdd: (input: {
    keyLabel: string;
    keyType: string;
    propertyLabel: string;
    residentVisitorId?: string | null;
    residentName?: string | null;
    storageLocation?: string | null;
    notes?: string | null;
    copies?: number;
  }) => Promise<any>;
}

export function AddKeyDialog({ open, onOpenChange, residents, onAdd }: Props) {
  const { toast } = useToast();
  const [target, setTarget] = useState<string>("");   // resident visitorId, or "shared"
  const [areaName, setAreaName] = useState("");        // free text when shared
  const [keyType, setKeyType] = useState("property");
  const [copies, setCopies] = useState("1");
  const [more, setMore] = useState(false);
  const [storageLocation, setStorageLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [customName, setCustomName] = useState("");
  const [saving, setSaving] = useState(false);

  const resident = residents.find((r) => r.visitorId === target);
  const areaLabel = resident ? (resident.room ? `${resident.room}` : resident.name) : areaName.trim();
  const suggestedName = useMemo(
    () => (areaLabel ? `${areaLabel} — ${keyTypeLabel(keyType).toLowerCase()}` : ""),
    [areaLabel, keyType]
  );

  const reset = () => {
    setTarget(""); setAreaName(""); setKeyType("property"); setCopies("1");
    setMore(false); setStorageLocation(""); setNotes(""); setCustomName("");
  };

  const submit = async () => {
    if (!target) {
      toast({ title: "Choose what the key is for", variant: "destructive" });
      return;
    }
    if (target === "shared" && !areaName.trim()) {
      toast({ title: "Name the shared area", variant: "destructive" });
      return;
    }
    const count = Math.min(Math.max(Number(copies) || 1, 1), 20);
    setSaving(true);
    const error = await onAdd({
      keyLabel: (customName.trim() || suggestedName).trim(),
      keyType,
      propertyLabel: resident ? (resident.room ? `${resident.room} · ${resident.name}` : resident.name) : areaName.trim(),
      residentVisitorId: resident?.visitorId || null,
      residentName: resident?.name || null,
      storageLocation: storageLocation.trim() || null,
      notes: notes.trim() || null,
      copies: count,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Could not add the key", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: count > 1 ? `${count} copies added` : "Key added to the register" });
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="rounded-xl">
        <DialogHeader>
          <DialogTitle>Add a key</DialogTitle>
          <DialogDescription>Three quick answers — the rest is optional.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>What is the key for?</Label>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger><SelectValue placeholder="Resident, unit or shared area" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="shared">A shared area…</SelectItem>
                {residents.map((r) => (
                  <SelectItem key={r.visitorId} value={r.visitorId}>
                    {r.name}{r.room ? ` · ${r.room}` : ""}{r.wing ? ` · ${r.wing}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {target === "shared" && (
              <Input
                className="mt-2"
                value={areaName}
                onChange={(e) => setAreaName(e.target.value)}
                placeholder="Main gate, laundry, medication room…"
              />
            )}
          </div>

          <div className="space-y-1.5">
            <Label>What kind of key?</Label>
            <div className="grid grid-cols-3 gap-2">
              {KEY_TYPES.map((t) => {
                const active = keyType === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setKeyType(t.value)}
                    className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-xs font-medium transition-colors ${
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <t.icon className="h-4 w-4" />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>How many copies?</Label>
            <Input
              value={copies}
              onChange={(e) => setCopies(e.target.value.replace(/[^0-9]/g, ""))}
              inputMode="numeric"
              className="w-24"
            />
            {suggestedName && (
              <p className="text-xs text-muted-foreground">
                Will be saved as “{customName.trim() || suggestedName}”
                {Number(copies) > 1 ? ` · copies 1–${Math.min(Number(copies), 20)}` : ""}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => setMore((m) => !m)}
            className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${more ? "rotate-180" : ""}`} />
            More details
          </button>

          {more && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Key name</Label>
                <Input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder={suggestedName} />
              </div>
              <div className="space-y-1">
                <Label>Where it's kept</Label>
                <Input value={storageLocation} onChange={(e) => setStorageLocation(e.target.value)} placeholder="Reception key cabinet, hook 12" />
              </div>
              <div className="space-y-1">
                <Label>Notes</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
              </div>
            </div>
          )}

          <Button onClick={submit} disabled={saving} className="w-full">
            {saving ? "Adding…" : "Add key"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
