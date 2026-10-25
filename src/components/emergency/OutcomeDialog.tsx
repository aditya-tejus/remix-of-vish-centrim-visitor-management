import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EmergencyOutcome, ConfirmationMethod, OUTCOME_LABELS, METHOD_LABELS, validOutcomeMethod } from "@/lib/emergencyPolicy";

export function OutcomeDialog({ name, onClose, onSave, busy, correction }: {
  name: string; onClose: () => void; busy: boolean; correction: boolean;
  onSave: (outcome: EmergencyOutcome, method?: ConfirmationMethod, reason?: string) => Promise<void>;
}) {
  const [outcome, setOutcome] = useState<EmergencyOutcome>("location_unconfirmed");
  const [method, setMethod] = useState<ConfirmationMethod | undefined>();
  const [reason, setReason] = useState("");
  const requiresMethod = !["attendance_unverified", "location_unconfirmed"].includes(outcome);
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <DialogContent className="rounded-xl">
      <DialogHeader><DialogTitle>Record outcome — {name}</DialogTitle><DialogDescription>Record the individual’s outcome, not an assumption about the property.</DialogDescription></DialogHeader>
      <Select value={outcome} onValueChange={value => { setOutcome(value as EmergencyOutcome); setMethod(undefined); }}>
        <SelectTrigger aria-label="Individual outcome" className="h-14"><SelectValue /></SelectTrigger>
        <SelectContent>{Object.entries(OUTCOME_LABELS).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent>
      </Select>
      {requiresMethod && <Select value={method || ""} onValueChange={value => setMethod(value as ConfirmationMethod)}>
        <SelectTrigger aria-label="Verification method" className="h-14"><SelectValue placeholder="Verification method" /></SelectTrigger>
        <SelectContent>{Object.entries(METHOD_LABELS).filter(([key]) => outcome !== "physically_safe" || ["direct_sighting", "staff_verification"].includes(key)).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent>
      </Select>}
      {correction && <Textarea aria-label="Correction reason" value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason for changing the recorded outcome" />}
      <DialogFooter><Button variant="outline" className="h-14" onClick={onClose} disabled={busy}>Cancel</Button><Button className="h-14" disabled={busy || !validOutcomeMethod(outcome, method) || (correction && !reason.trim())} onClick={() => void onSave(outcome, method, reason.trim() || undefined)}>Record outcome</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}