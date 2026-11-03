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

interface AddFoodDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function AddFoodDialog({ open, onOpenChange, onSaved }: AddFoodDialogProps) {
  const { residents } = useResidents();
  const { toast } = useToast();
  const { currentSiteId } = useSite();
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
      <DialogContent className="flex max-h-[92dvh] max-w-xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="space-y-0 border-b border-border px-6 py-4 pr-14 text-left">
          <DialogTitle className="text-xl font-extrabold leading-7">Add food record</DialogTitle>
          <DialogDescription className="mt-1 text-[13px]">
            For food handed in at reception, or brought by someone who did not record it at check-in.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-sm font-bold">Who is it for?<span aria-hidden className="ml-1 text-destructive">*</span></Label>
            <Select value={residentId} onValueChange={setResidentId}>
              <SelectTrigger aria-label="Resident"><SelectValue placeholder="Choose a resident" /></SelectTrigger>
              <SelectContent>
                {residentOptions.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.name}{r.room ? ` • ${r.room}` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="food-brought-by" className="text-sm font-bold">Brought by<span aria-hidden className="ml-1 text-destructive">*</span></Label>
              <Input
                id="food-brought-by"
                value={broughtBy}
                onChange={(e) => setBroughtBy(e.target.value)}
                placeholder="Their name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="food-recorded-at" className="text-sm font-bold">When it came in</Label>
              <Input
                id="food-recorded-at"
                type="datetime-local"
                value={recordedAt}
                onChange={(e) => setRecordedAt(e.target.value)}
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

        </div>
        <DialogFooter className="flex-row items-center gap-2 border-t border-border px-6 py-3 sm:justify-between">
          <p className="hidden text-sm text-muted-foreground sm:block">
            {!residentId ? "Choose who it is for." : !broughtBy.trim() ? "Add who brought it." : !isFoodFormValid(form) ? "Describe the food." : <span className="font-bold text-success-strong">Ready to save</span>}
          </p>
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={save} disabled={!valid || saving}>{saving ? "Saving…" : "Save record"}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
