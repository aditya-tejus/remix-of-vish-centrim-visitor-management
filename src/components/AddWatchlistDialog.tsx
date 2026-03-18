import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, ShieldAlert } from "lucide-react";

interface AddWatchlistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (entry: { first_name: string; surname: string; reason: string; instructions: string; alert_type: "soft" | "hard"; added_by: string }) => void;
}

export function AddWatchlistDialog({ open, onOpenChange, onAdd }: AddWatchlistDialogProps) {
  const [firstName, setFirstName] = useState("");
  const [surname, setSurname] = useState("");
  const [reason, setReason] = useState("");
  const [instructions, setInstructions] = useState("");
  const [alertType, setAlertType] = useState<"soft" | "hard">("soft");

  const handleSubmit = () => {
    if (!firstName.trim() || !surname.trim() || !reason.trim()) return;
    onAdd({
      first_name: firstName.trim(),
      surname: surname.trim(),
      reason: reason.trim(),
      instructions: instructions.trim(),
      alert_type: alertType,
      added_by: "Staff",
    });
    setFirstName("");
    setSurname("");
    setReason("");
    setInstructions("");
    setAlertType("soft");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-destructive" />
            Add to Watchlist
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[12px]">First Name *</Label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="h-9 text-[13px]" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px]">Surname *</Label>
              <Input value={surname} onChange={(e) => setSurname(e.target.value)} className="h-9 text-[13px]" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[12px]">Reason for Restriction *</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} className="text-[13px] min-h-[60px]" placeholder="e.g. Aggressive behaviour, court order..." />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[12px]">Instructions for Staff</Label>
            <Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} className="text-[13px] min-h-[60px]" placeholder="e.g. Do not allow entry, contact manager..." />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[12px]">Alert Type</Label>
            <Select value={alertType} onValueChange={(v) => setAlertType(v as "soft" | "hard")}>
              <SelectTrigger className="h-9 text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="soft" className="text-[13px]">
                  <span className="flex items-center gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                    Soft Alert — Review Required
                  </span>
                </SelectItem>
                <SelectItem value="hard" className="text-[13px]">
                  <span className="flex items-center gap-2">
                    <ShieldAlert className="h-3.5 w-3.5 text-destructive" />
                    Hard Block — Entry Denied
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="text-[13px]">Cancel</Button>
          <Button onClick={handleSubmit} disabled={!firstName || !surname || !reason} className="text-[13px] bg-destructive hover:bg-destructive/90">
            Add to Watchlist
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
