import { useState, useMemo, useEffect } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Search, LogOut, Loader2, Clock, ArrowLeft, Users, Phone, Mail,
  AlertTriangle, CheckCircle2, MapPin,
} from "lucide-react";
import { Visitor, CompanionDetail } from "@/types/visitor";
import { format } from "date-fns";
import { FeedbackDialog } from "@/components/FeedbackDialog";
import { TimeOverride } from "@/components/TimeOverride";

const OVERSTAY_THRESHOLD_MS = 8 * 3600000; // 8 hours

const CHECKOUT_REASONS_BY_TYPE: Record<string, string[]> = {
  visitor: ["End of visit", "Appointment finished", "Emergency", "Other"],
  contractor: ["Work complete", "Called away", "End of shift", "Emergency", "Other"],
  volunteer: ["Session ended", "Personal reasons", "Emergency", "Other"],
  staff: ["Shift ended", "Break", "Emergency", "Other"],
};

const TYPE_BADGES: Record<string, { label: string; className: string }> = {
  visitor: { label: "Visitor", className: "bg-primary/10 text-primary" },
  contractor: { label: "Contractor", className: "bg-warning/10 text-warning" },
  volunteer: { label: "Volunteer", className: "bg-success/10 text-success" },
  staff: { label: "Staff", className: "bg-muted text-muted-foreground" },
};

interface CheckOutSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visitors: Visitor[];
  onCheckOut: (id: string, reason?: string, timeOverride?: string) => void;
  /** Pre-select a specific visitor (from table row action) */
  preSelectedVisitorId?: string | null;
  onPreSelectedClear?: () => void;
}

export function CheckOutSheet({
  open, onOpenChange, visitors, onCheckOut,
  preSelectedVisitorId, onPreSelectedClear,
}: CheckOutSheetProps) {
  const [search, setSearch] = useState("");
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [feedbackVisitor, setFeedbackVisitor] = useState<Visitor | null>(null);
  const [selectedVisitor, setSelectedVisitor] = useState<Visitor | null>(null);
  const [checkoutReason, setCheckoutReason] = useState<string>("");
  const [timeOverride, setTimeOverride] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successName, setSuccessName] = useState("");
  const [successDuration, setSuccessDuration] = useState("");

  const checkedInVisitors = useMemo(
    () => visitors.filter((v) => v.status === "checked-in" && v.type !== "resident"),
    [visitors]
  );

  // Pre-select visitor from table row
  useEffect(() => {
    if (open && preSelectedVisitorId) {
      const found = checkedInVisitors.find((v) => v.id === preSelectedVisitorId);
      if (found) {
        setSelectedVisitor(found);
        setCheckoutReason("");
      }
    }
  }, [open, preSelectedVisitorId, checkedInVisitors]);

  const filtered = useMemo(() => {
    if (!search.trim()) return checkedInVisitors;
    const q = search.toLowerCase();
    return checkedInVisitors.filter(
      (v) =>
        v.firstName.toLowerCase().includes(q) ||
        v.surname.toLowerCase().includes(q) ||
        `${v.firstName} ${v.surname}`.toLowerCase().includes(q) ||
        v.mobile.includes(q) ||
        v.email.toLowerCase().includes(q) ||
        (v.whomToVisit || "").toLowerCase().includes(q)
    );
  }, [checkedInVisitors, search]);

  const getDuration = (checkIn: Date) => {
    const mins = Math.floor((Date.now() - checkIn.getTime()) / 60000);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}m`;
  };

  const isOverstayed = (v: Visitor) =>
    Date.now() - v.checkInTime.getTime() > OVERSTAY_THRESHOLD_MS;

  const handleSelectVisitor = (visitor: Visitor) => {
    setSelectedVisitor(visitor);
    setCheckoutReason("");
  };

  const handleConfirmCheckOut = async () => {
    if (!selectedVisitor) return;
    setCheckingOut(selectedVisitor.id);
    const name = `${selectedVisitor.firstName} ${selectedVisitor.surname}`;
    const dur = getDuration(selectedVisitor.checkInTime);
    await onCheckOut(selectedVisitor.id, checkoutReason || undefined, timeOverride || undefined);
    setCheckingOut(null);
    setSuccessName(name);
    setSuccessDuration(dur);
    setShowSuccess(true);
    const v = selectedVisitor;
    setSelectedVisitor(null);
    // Auto-dismiss success after 3s
    setTimeout(() => {
      setShowSuccess(false);
      setFeedbackVisitor(v);
    }, 3000);
  };

  const handleBack = () => {
    setSelectedVisitor(null);
    setCheckoutReason("");
    setTimeOverride(null);
    onPreSelectedClear?.();
  };

  const handleClose = (val: boolean) => {
    if (!val) {
      setSearch("");
      setSelectedVisitor(null);
      setCheckoutReason("");
      setShowSuccess(false);
      onPreSelectedClear?.();
    }
    onOpenChange(val);
  };

  const reasons = selectedVisitor
    ? CHECKOUT_REASONS_BY_TYPE[selectedVisitor.type] || CHECKOUT_REASONS_BY_TYPE.visitor
    : [];

  const companions: CompanionDetail[] = selectedVisitor?.companionDetails || [];

  return (
    <>
      <Sheet open={open && !feedbackVisitor} onOpenChange={handleClose}>
        <SheetContent side="right" className="w-full sm:max-w-[50vw] min-w-[460px] p-0 flex flex-col">
          {/* Header */}
          <SheetHeader className="px-5 py-4 border-b border-border shrink-0">
            <div className="flex items-center justify-between">
              <SheetTitle className="flex items-center gap-2 text-[16px]">
                <LogOut className="h-4.5 w-4.5 text-checkout" />
                Check Out
              </SheetTitle>
              <span className="text-[12px] text-muted-foreground font-medium">
                {checkedInVisitors.length} on-site
              </span>
            </div>
            <SheetDescription className="text-[12px] text-muted-foreground sr-only">
              {selectedVisitor ? "Confirm check-out" : "Select a visitor to check out"}
            </SheetDescription>
          </SheetHeader>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {showSuccess ? (
              /* Success state */
              <div className="flex flex-col items-center justify-center h-full gap-4 px-6 py-12">
                <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-success" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-[16px] font-bold text-foreground">{successName} checked out</p>
                  <p className="text-[13px] text-muted-foreground">Duration: {successDuration}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 text-[13px]"
                  onClick={() => {
                    setShowSuccess(false);
                  }}
                >
                  Check out another
                </Button>
              </div>
            ) : !selectedVisitor ? (
              /* Step 1: Search & Select */
              <div className="p-5 space-y-4">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search name, phone, or resident visited..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10 h-12 rounded-xl text-[15px] border-2 border-border focus:border-checkout"
                    autoFocus
                  />
                </div>

                {/* Visitor list */}
                <ScrollArea className="h-[calc(100vh-220px)]">
                  {filtered.length === 0 ? (
                    <div className="text-center py-16">
                      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                        <LogOut className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <p className="text-[14px] font-medium text-muted-foreground">
                        {checkedInVisitors.length === 0
                          ? "No visitors currently on-site"
                          : "No matching visitors found"}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filtered.map((v) => {
                        const overstayed = isOverstayed(v);
                        const typeBadge = TYPE_BADGES[v.type] || TYPE_BADGES.visitor;
                        return (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => handleSelectVisitor(v)}
                            className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all duration-150 hover:shadow-sm group ${
                              overstayed
                                ? "border-warning/40 bg-warning/5 hover:bg-warning/10"
                                : "border-border hover:border-checkout/30 hover:bg-muted/30"
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              {/* Avatar */}
                              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                                {v.firstName[0]}{v.surname[0]}
                              </div>

                              {/* Info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <p className="text-sm font-semibold text-foreground truncate">
                                    {v.firstName} {v.surname}
                                  </p>
                                  <span className={`text-[10px] font-medium px-1.5 py-px rounded shrink-0 ${typeBadge.className}`}>
                                    {typeBadge.label}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                                  {v.whomToVisit && (
                                    <>
                                      <span className="truncate max-w-[140px]">{v.whomToVisit}</span>
                                      <span>·</span>
                                    </>
                                  )}
                                  <span>{format(v.checkInTime, "HH:mm")}</span>
                                  <span>·</span>
                                  <span className={overstayed ? "text-warning font-semibold" : ""}>
                                    {getDuration(v.checkInTime)}
                                  </span>
                                  {v.additionalVisitors > 0 && (
                                    <>
                                      <span>·</span>
                                      <span className="flex items-center gap-0.5">
                                        <Users className="h-3 w-3" />+{v.additionalVisitors}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>

                              {/* Checkout arrow */}
                              <LogOut className="h-4 w-4 text-muted-foreground/30 group-hover:text-checkout shrink-0 transition-colors" />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </div>
            ) : (
              /* Step 2: Confirm */
              <div className="p-5 space-y-4">
                {/* Back */}
                <button
                  onClick={handleBack}
                  className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Back to list
                </button>

                {/* Visitor summary card */}
                <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                      {selectedVisitor.firstName[0]}{selectedVisitor.surname[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-bold text-foreground">
                        {selectedVisitor.firstName} {selectedVisitor.surname}
                      </p>
                      <span className={`text-[10px] font-medium px-1.5 py-px rounded ${(TYPE_BADGES[selectedVisitor.type] || TYPE_BADGES.visitor).className}`}>
                        {(TYPE_BADGES[selectedVisitor.type] || TYPE_BADGES.visitor).label}
                      </span>
                    </div>
                  </div>

                  {/* Info grid */}
                  <div className="grid grid-cols-2 gap-2">
                    {selectedVisitor.whomToVisit && (
                      <div className="rounded-lg bg-card p-2.5 border border-border">
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> Visiting</p>
                        <p className="text-xs font-semibold text-foreground mt-0.5">{selectedVisitor.whomToVisit}</p>
                      </div>
                    )}
                    <div className="rounded-lg bg-card p-2.5 border border-border">
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Duration</p>
                      <p className={`text-xs font-semibold mt-0.5 ${
                        isOverstayed(selectedVisitor) ? "text-warning" : "text-foreground"
                      }`}>
                        {getDuration(selectedVisitor.checkInTime)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {format(selectedVisitor.checkInTime, "HH:mm")} → now
                      </p>
                    </div>
                    {selectedVisitor.mobile && (
                      <div className="rounded-lg bg-card p-2.5 border border-border">
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" /> Phone</p>
                        <p className="text-xs font-semibold text-foreground mt-0.5">{selectedVisitor.mobile}</p>
                      </div>
                    )}
                    {selectedVisitor.email && (
                      <div className="rounded-lg bg-card p-2.5 border border-border">
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" /> Email</p>
                        <p className="text-xs font-semibold text-foreground mt-0.5 truncate">{selectedVisitor.email}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Overstay warning */}
                {isOverstayed(selectedVisitor) && (
                  <div className="rounded-xl border border-warning/30 bg-warning/5 p-3.5 flex items-start gap-3">
                    <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[13px] font-semibold text-foreground">Overstayed visit</p>
                      <p className="text-[12px] text-muted-foreground">
                        This visitor has been on-site for {getDuration(selectedVisitor.checkInTime)}, exceeding the standard visit window.
                      </p>
                    </div>
                  </div>
                )}

                {/* Reason dropdown */}
                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-muted-foreground">
                    Reason for leaving <span className="text-muted-foreground/50">(optional)</span>
                  </label>
                  <Select value={checkoutReason} onValueChange={setCheckoutReason}>
                    <SelectTrigger className="rounded-xl h-10 text-[14px]">
                      <SelectValue placeholder="Select a reason..." />
                    </SelectTrigger>
                    <SelectContent>
                      {reasons.map((reason) => (
                        <SelectItem key={reason} value={reason}>{reason}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Companions */}
                {companions.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
                      <label className="text-[12px] font-medium text-muted-foreground">
                        {companions.length} companion{companions.length !== 1 ? "s" : ""} will also be checked out
                      </label>
                    </div>
                    <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
                      {companions.map((c, i) => (
                        <div key={i} className="px-3.5 py-2.5 flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                              {(c.name || "?")[0]?.toUpperCase()}
                            </div>
                            <div>
                              <p className="text-[13px] font-medium text-foreground">{c.name || `Person ${i + 1}`}</p>
                              {c.relation && (
                                <p className="text-[11px] text-muted-foreground">{c.relation}</p>
                              )}
                            </div>
                          </div>
                          {c.phone && (
                            <span className="text-[11px] text-muted-foreground">{c.phone}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer — only show when confirming */}
          {selectedVisitor && !showSuccess && (
            <div className="shrink-0 border-t border-border p-5">
              <Button
                className="w-full h-12 text-[15px] font-semibold gap-2 rounded-xl bg-checkout hover:bg-checkout/90 text-checkout-foreground shadow-sm"
                disabled={checkingOut === selectedVisitor.id}
                onClick={handleConfirmCheckOut}
              >
                {checkingOut === selectedVisitor.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <LogOut className="h-4 w-4" />
                )}
                Check Out {selectedVisitor.firstName}
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

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
