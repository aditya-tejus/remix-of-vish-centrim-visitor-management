import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { LogIn, Loader2 } from "lucide-react";
import { TimeOverride } from "@/components/TimeOverride";

interface CheckInReturnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visitorName: string;
  onConfirm: (comment: string, timeOverride?: string) => Promise<void>;
}

export function CheckInReturnDialog({ open, onOpenChange, visitorName, onConfirm }: CheckInReturnDialogProps) {
  const lock = useRef(false);
  const [error, setError] = useState("");
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [timeOverride, setTimeOverride] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (lock.current) return;
    lock.current = true; setLoading(true); setError("");
    try {
      await onConfirm(comment.trim(), timeOverride || undefined);
      setComment(""); setTimeOverride(null); onOpenChange(false);
    } catch (e) { setError(e instanceof Error ? e.message : "Return was not confirmed. Please retry."); }
    finally { lock.current = false; setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (lock.current) return; if (!o) { setError(""); setComment(""); setTimeOverride(null); } onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LogIn className="h-5 w-5 text-primary" />
            Mark as Returned
          </DialogTitle>
          <DialogDescription>
            Confirm return for <span className="font-semibold text-foreground">{visitorName}</span>
          </DialogDescription>
        </DialogHeader>
        <fieldset disabled={loading} className="space-y-4 pt-2">
          {error && <p role="alert" className="text-destructive-strong">{error}</p>}
          <div className="space-y-2">
            <Label htmlFor="return-comment">Return Notes (optional)</Label>
            <Textarea
              id="return-comment"
              placeholder="e.g. Returned on time, brought medication, etc."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
            />
          </div>
          <TimeOverride
            value={timeOverride}
            onChange={setTimeOverride}
            label="Adjust return time"
          />
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={loading} className="gap-1.5">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
              Confirm Return
            </Button>
          </div>
        </fieldset>
      </DialogContent>
    </Dialog>
  );
}
