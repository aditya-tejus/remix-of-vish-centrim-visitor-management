import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface DraftAcceptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: {
    id: string;
    resident_name: string;
    resident_room: string | null;
    leave_type: string | null;
    expected_departure: string | null;
    expected_return: string | null;
    reason: string | null;
    companions: any;
    comments: string | null;
  };
  onAccepted: (draftId: string) => void;
}

export function DraftAcceptDialog({ open, onOpenChange, draft, onAccepted }: DraftAcceptDialogProps) {
  const [loading, setLoading] = useState(false);
  const [room, setRoom] = useState(draft.resident_room || "");
  const [leaveType, setLeaveType] = useState(draft.leave_type || "");
  const [expectedReturn, setExpectedReturn] = useState(draft.expected_return?.slice(0, 16) || "");
  const [accompaniedBy, setAccompaniedBy] = useState("");
  const [notes, setNotes] = useState(draft.comments || "");

  const handleAccept = async () => {
    setLoading(true);

    // Create visitor record for the resident leave
    const nameParts = draft.resident_name.split(" ");
    const firstName = nameParts[0] || "";
    const surname = nameParts.slice(1).join(" ") || "";

    await supabase.from("visitors").insert({
      first_name: firstName,
      surname: surname,
      email: "imported@clinical.system",
      mobile: "—",
      type: "resident",
      status: "checked-out",
      check_in_time: draft.expected_departure || new Date().toISOString(),
      check_out_time: draft.expected_departure || new Date().toISOString(),
      whom_to_visit: room,
      expected_return_date: expectedReturn ? new Date(expectedReturn).toISOString() : null,
      leave_type: leaveType,
      checkout_reason: draft.reason || leaveType,
      accompanied_by: accompaniedBy || null,
      comments: notes,
      privacy_acknowledged: true,
    });

    // Mark leave request as approved
    await supabase.from("leave_requests").update({
      status: "approved",
      reviewed_at: new Date().toISOString(),
      reviewed_by: "Staff",
      resident_room: room,
    }).eq("id", draft.id);

    setLoading(false);
    onAccepted(draft.id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Check className="h-5 w-5 text-green-600" />
            Accept Draft Import
          </DialogTitle>
          <DialogDescription>
            Review and complete details for <span className="font-semibold text-foreground">{draft.resident_name}</span>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Resident Name</Label>
              <Input value={draft.resident_name} disabled />
            </div>
            <div className="space-y-2">
              <Label>Room</Label>
              <Input value={room} onChange={(e) => setRoom(e.target.value)} placeholder="e.g. Room 12" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Leave Type</Label>
              <Select value={leaveType} onValueChange={setLeaveType}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Family Visit">Family Visit</SelectItem>
                  <SelectItem value="Medical Appointment">Medical Appointment</SelectItem>
                  <SelectItem value="Day Trip / Outing">Day Trip / Outing</SelectItem>
                  <SelectItem value="Shopping / Errands">Shopping / Errands</SelectItem>
                  <SelectItem value="Religious / Spiritual">Religious / Spiritual</SelectItem>
                  <SelectItem value="Hospital Stay">Hospital Stay</SelectItem>
                  <SelectItem value="Holiday with Family">Holiday with Family</SelectItem>
                  <SelectItem value="Legal / Administrative">Legal / Administrative</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="font-bold">Expected Return *</Label>
              <Input
                type="datetime-local"
                value={expectedReturn}
                onChange={(e) => setExpectedReturn(e.target.value)}
                className="font-semibold"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Accompanied By</Label>
            <Select value={accompaniedBy} onValueChange={setAccompaniedBy}>
              <SelectTrigger><SelectValue placeholder="Select escort" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="family">👨‍👩‍👧 Family Member</SelectItem>
                <SelectItem value="friend">👤 Friend</SelectItem>
                <SelectItem value="staff">🧑‍⚕️ Staff Member</SelectItem>
                <SelectItem value="transport">🚌 Transport / Driver</SelectItem>
                <SelectItem value="medical-escort">🏥 Medical Escort</SelectItem>
                <SelectItem value="alone">🚶 Going Alone</SelectItem>
                <SelectItem value="group">👥 Group Outing</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Additional notes..." />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
            <Button onClick={handleAccept} disabled={loading || !expectedReturn} className="gap-1.5">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Accept & Create Record
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
