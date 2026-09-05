import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldAlert, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useIncidents, IncidentPriority } from "@/hooks/useIncidents";

interface EscalateIncidentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visitorId: string | null;
  residentName: string;
  expectedReturnDate?: Date | null;
  defaultDescription?: string;
}

function toLocalInput(d: Date) {
  return format(d, "yyyy-MM-dd'T'HH:mm");
}

export function EscalateIncidentDialog({
  open,
  onOpenChange,
  visitorId,
  residentName,
  expectedReturnDate,
  defaultDescription = "",
}: EscalateIncidentDialogProps) {
  const { toast } = useToast();
  const { createIncident } = useIncidents();
  const [priority, setPriority] = useState<IncidentPriority>("priority_2");
  const [description, setDescription] = useState(defaultDescription);
  const [reportedAt, setReportedAt] = useState(toLocalInput(new Date()));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setPriority("priority_2");
      setDescription(defaultDescription);
      setReportedAt(toLocalInput(new Date()));
    }
  }, [open, defaultDescription]);

  const valid = description.trim().length >= 10 && !!reportedAt;

  const handleSubmit = async () => {
    if (!valid) return;
    setSaving(true);
    try {
      await createIncident.mutateAsync({
        visitorId,
        residentName,
        priority,
        description: description.trim(),
        reportedAt: new Date(reportedAt),
        expectedReturnDate: expectedReturnDate || null,
        incidentType: "resident_absent",
      });
      toast({
        title: "Incident recorded",
        description: `${residentName} — ${priority === "priority_1" ? "Priority 1" : "Priority 2"} incident logged. This record is now protected from automatic deletion.`,
      });
      onOpenChange(false);
    } catch (e: any) {
      toast({
        title: "Could not record incident",
        description: e?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] rounded-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-destructive" />
            Escalate to Incident
          </DialogTitle>
          <DialogDescription className="text-xs">
            Records a reportable incident for {residentName}, linked to this outing. Incidents cannot be deleted
            and the linked record is placed on legal hold.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label className="text-[12px]">Priority *</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as IncidentPriority)}>
              <SelectTrigger className="h-9 text-[13px] rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="priority_1" className="text-[13px]">
                  Priority 1 — report within 24 hours
                </SelectItem>
                <SelectItem value="priority_2" className="text-[13px]">
                  Priority 2 — report within 30 days
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Priority 1 applies where there is a reasonable risk of serious harm, or the resident's whereabouts
              are unknown and unexplained.
            </p>
          </div>

          {expectedReturnDate && (
            <div className="rounded-lg bg-muted/50 border border-border p-3">
              <p className="text-[11px] text-muted-foreground">
                Expected back:{" "}
                <span className="font-semibold text-foreground">
                  {format(expectedReturnDate, "hh:mm a dd MMM yyyy")}
                </span>
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-[12px]">Reported date &amp; time *</Label>
            <Input
              type="datetime-local"
              value={reportedAt}
              onChange={(e) => setReportedAt(e.target.value)}
              className="h-9 text-[13px] rounded-lg"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[12px]">What happened *</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="text-[13px] min-h-[90px] rounded-lg"
              placeholder="Describe the circumstances, who was notified, and any immediate actions taken..."
            />
            <p className="text-[11px] text-muted-foreground">
              {description.trim().length < 10 ? "At least 10 characters." : `${description.trim().length} characters`}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="text-[13px]">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!valid || saving}
            className="text-[13px] bg-destructive hover:bg-destructive/90 gap-1.5"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Record Incident
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
