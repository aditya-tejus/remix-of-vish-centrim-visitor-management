import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, LogOut, User, Loader2, Clock, ArrowLeft, Users } from "lucide-react";
import { Visitor, CompanionDetail } from "@/types/visitor";
import { format } from "date-fns";
import { FeedbackDialog } from "@/components/FeedbackDialog";

const CHECKOUT_REASONS = [
  "End of visit",
  "Shift ended",
  "Emergency",
  "Appointment finished",
  "Escorted out",
  "Transferred",
  "Other",
];

interface CheckOutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visitors: Visitor[];
  onCheckOut: (id: string, reason?: string) => void;
}

export function CheckOutDialog({ open, onOpenChange, visitors, onCheckOut }: CheckOutDialogProps) {
  const [search, setSearch] = useState("");
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [feedbackVisitor, setFeedbackVisitor] = useState<Visitor | null>(null);
  const [selectedVisitor, setSelectedVisitor] = useState<Visitor | null>(null);
  const [checkoutReason, setCheckoutReason] = useState<string>("");

  const checkedInVisitors = useMemo(
    () => visitors.filter((v) => v.status === "checked-in"),
    [visitors]
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return checkedInVisitors;
    const q = search.toLowerCase();
    return checkedInVisitors.filter(
      (v) =>
        v.firstName.toLowerCase().includes(q) ||
        v.surname.toLowerCase().includes(q) ||
        `${v.firstName} ${v.surname}`.toLowerCase().includes(q) ||
        v.mobile.includes(q) ||
        v.email.toLowerCase().includes(q)
    );
  }, [checkedInVisitors, search]);

  const handleSelectVisitor = (visitor: Visitor) => {
    setSelectedVisitor(visitor);
    setCheckoutReason("");
  };

  const handleConfirmCheckOut = async () => {
    if (!selectedVisitor) return;
    setCheckingOut(selectedVisitor.id);
    await onCheckOut(selectedVisitor.id, checkoutReason || undefined);
    setCheckingOut(null);
    const v = selectedVisitor;
    setSelectedVisitor(null);
    setFeedbackVisitor(v);
  };

  const handleBack = () => {
    setSelectedVisitor(null);
    setCheckoutReason("");
  };

  const handleClose = (val: boolean) => {
    if (!val) {
      setSearch("");
      setSelectedVisitor(null);
      setCheckoutReason("");
    }
    onOpenChange(val);
  };

  const getDuration = (checkIn: Date) => {
    const mins = Math.floor((Date.now() - checkIn.getTime()) / 60000);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}m`;
  };

  const companions: CompanionDetail[] = selectedVisitor?.companionDetails || [];

  return (
    <>
      <Dialog open={open && !feedbackVisitor} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LogOut className="h-5 w-5 text-primary" />
              Check Out Visitor
            </DialogTitle>
            <DialogDescription>
              {selectedVisitor
                ? "Review details and confirm check-out."
                : "Search by name or phone number to check out a visitor."}
            </DialogDescription>
          </DialogHeader>

          {!selectedVisitor ? (
            /* Step 1: Search & Select */
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or phone..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                  autoFocus
                />
              </div>

              <div className="text-xs text-muted-foreground">
                {checkedInVisitors.length} visitor{checkedInVisitors.length !== 1 ? "s" : ""} currently checked in
              </div>

              <ScrollArea className="h-[320px]">
                {filtered.length === 0 ? (
                  <div className="text-center py-12">
                    <User className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      {checkedInVisitors.length === 0
                        ? "No visitors currently checked in"
                        : "No matching visitors found"}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {filtered.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => handleSelectVisitor(v)}
                        className="w-full flex items-center justify-between rounded-lg border border-border p-3 hover:bg-muted/30 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-9 w-9 rounded-full bg-success/10 flex items-center justify-center shrink-0">
                            <span className="text-sm font-semibold text-success">
                              {v.firstName[0]}{v.surname[0]}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {v.firstName} {v.surname}
                            </p>
                            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                              {v.mobile && <span>{v.mobile}</span>}
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {format(v.checkInTime, "HH:mm")} ({getDuration(v.checkInTime)})
                              </span>
                            </div>
                          </div>
                        </div>
                        <LogOut className="h-4 w-4 text-muted-foreground shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          ) : (
            /* Step 2: Reason & Companions */
            <div className="space-y-4">
              {/* Selected visitor summary */}
              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 p-3">
                <div className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center shrink-0">
                  <span className="text-sm font-semibold text-success">
                    {selectedVisitor.firstName[0]}{selectedVisitor.surname[0]}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">
                    {selectedVisitor.firstName} {selectedVisitor.surname}
                  </p>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="capitalize">{selectedVisitor.type}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(selectedVisitor.checkInTime, "HH:mm")} ({getDuration(selectedVisitor.checkInTime)})
                    </span>
                  </div>
                </div>
              </div>

              {/* Reason dropdown (optional) */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Reason for Check-Out <span className="text-muted-foreground/60">(optional)</span>
                </label>
                <Select value={checkoutReason} onValueChange={setCheckoutReason}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a reason..." />
                  </SelectTrigger>
                  <SelectContent>
                    {CHECKOUT_REASONS.map((reason) => (
                      <SelectItem key={reason} value={reason}>
                        {reason}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Companions */}
              {companions.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    Companions ({companions.length})
                  </label>
                  <div className="rounded-lg border border-border divide-y divide-border">
                    {companions.map((c, i) => (
                      <div key={i} className="px-3 py-2 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-foreground">{c.name || "—"}</p>
                          {c.relation && (
                            <p className="text-[11px] text-muted-foreground">{c.relation}</p>
                          )}
                        </div>
                        {c.phone && (
                          <span className="text-[11px] text-muted-foreground">{c.phone}</span>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    All companions will also be checked out.
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={handleBack}>
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back
                </Button>
                <Button
                  size="sm"
                  className="flex-1 gap-1.5"
                  disabled={checkingOut === selectedVisitor.id}
                  onClick={handleConfirmCheckOut}
                >
                  {checkingOut === selectedVisitor.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <LogOut className="h-3.5 w-3.5" />
                  )}
                  Confirm Check-Out
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {feedbackVisitor && (
        <FeedbackDialog
          open={!!feedbackVisitor}
          onOpenChange={(o) => { if (!o) setFeedbackVisitor(null); }}
          visitorId={feedbackVisitor.id}
          visitorName={`${feedbackVisitor.firstName} ${feedbackVisitor.surname}`}
          visitorType={feedbackVisitor.type}
        />
      )}
    </>
  );
}
