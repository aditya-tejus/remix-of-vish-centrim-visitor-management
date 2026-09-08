import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useResidents } from "@/hooks/useResidents";
import { FoodFormFields, FoodFormState, emptyFoodForm, isFoodFormValid } from "./FoodFormFields";
import { insertFoodRecord } from "@/lib/foodRegister";
import { useSite } from "@/contexts/SiteContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { UtensilsCrossed } from "lucide-react";

interface AddFoodDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function AddFoodDialog({ open, onOpenChange, onSaved }: AddFoodDialogProps) {
  const { residents } = useResidents();
  const { toast } = useToast();
  const [residentId, setResidentId] = useState("");
  const [broughtBy, setBroughtBy] = useState("");
  const [recordedAt, setRecordedAt] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  });
  const [form, setForm] = useState<FoodFormState>(emptyFoodForm);
  const [saving, setSaving] = useState(false);

  const residentOptions = residents.map((r) => ({ id: r.visitorId, name: r.name, room: r.room }));
  const resident = residentOptions.find((r) => r.id === residentId);
  const valid = !!residentId && broughtBy.trim().length > 0 && isFoodFormValid(form);

  const reset = () => {
    setResidentId("");
    setBroughtBy("");
    setForm(emptyFoodForm);
  };

  const save = async () => {
    if (!valid || !resident) return;
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await insertFoodRecord({
      residentVisitorId: resident.id,
      residentName: resident.name,
      broughtByName: broughtBy.trim(),
      foodDescription: form.foodDescription.trim(),
      foodType: form.foodType,
      sharedWithOthers: form.sharedWithOthers,
      sharedResidentIds: form.sharedResidentIds,
      sharedResidentNames: form.sharedResidentIds
        .map((id) => residentOptions.find((r) => r.id === id)?.name)
        .filter(Boolean) as string[],
      notes: form.notes.trim() || null,
      recordedAt: new Date(recordedAt),
      source: "manual",
      branchId: currentSiteId,
      createdBy: userData.user?.email || "Staff",
    });
    setSaving(false);
    if (error) {
      toast({ title: "Could not save", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Food record added" });
    reset();
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[17px]">
            <UtensilsCrossed className="h-4 w-4 text-primary" /> Add Food Record
          </DialogTitle>
          <DialogDescription className="text-[13px]">
            Record food brought in at reception, or on behalf of someone who did not register at check-in.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-[12px] font-medium">Resident *</Label>
            <Select value={residentId} onValueChange={setResidentId}>
              <SelectTrigger className="rounded-xl h-10 text-[14px]"><SelectValue placeholder="Select resident..." /></SelectTrigger>
              <SelectContent>
                {residentOptions.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.name}{r.room ? ` • ${r.room}` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[12px] font-medium">Brought by *</Label>
              <Input
                value={broughtBy}
                onChange={(e) => setBroughtBy(e.target.value)}
                placeholder="Type a name"
                className="rounded-xl h-10 text-[14px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px] font-medium">Date &amp; time</Label>
              <Input
                type="datetime-local"
                value={recordedAt}
                onChange={(e) => setRecordedAt(e.target.value)}
                className="rounded-xl h-10 text-[14px]"
              />
            </div>
          </div>

          <FoodFormFields
            state={form}
            onChange={setForm}
            residents={residentOptions}
            primaryResidentId={residentId || null}
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={!valid || saving} className="rounded-xl">
            {saving ? "Saving..." : "Save Record"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
