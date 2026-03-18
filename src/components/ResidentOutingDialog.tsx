import { useState, useMemo } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CompanionDetail } from "@/types/visitor";
import {
  Search, ArrowLeft, ArrowRight, Check, Clock, CalendarDays,
  Users, Plus, Trash2, ScrollText, MapPin, DoorOpen, ShieldAlert, AlertTriangle,
} from "lucide-react";
import { useActiveLeaveTypes } from "@/hooks/useLeaveTypes";
import { useCompanionFields } from "@/hooks/useFormFields";
import { useResidents } from "@/hooks/useResidents";
import { useStaffMembers } from "@/hooks/useStaffMembers";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

type OutingMode = "short" | "planned";

interface ResidentOutingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMarkAway: (visitorId: string, details: {
    expectedReturnDate?: Date;
    checkoutReason?: string;
    leaveType?: string;
    accompaniedBy?: string;
    accompaniedByName?: string;
    comments?: string;
    returnNotificationOptIn?: boolean;
    companionDetails?: CompanionDetail[];
  }) => void;
  preselectedResident?: { id: string; name: string; room: string; wing: string } | null;
  defaultMode?: OutingMode;
  /** Map of visitorId → presence status to show away residents */
  presenceMap?: Map<string, "on-site" | "away" | "on-leave" | "overdue">;
}

const destinationCategories = [
  { value: "garden", label: "Garden / Grounds", emoji: "🌳" },
  { value: "local-shops", label: "Local Shops", emoji: "🛒" },
  { value: "walk", label: "Walk / Fresh Air", emoji: "🚶" },
  { value: "cafe", label: "Café / Restaurant", emoji: "☕" },
  { value: "appointment", label: "Appointment (nearby)", emoji: "📋" },
  { value: "family-visit", label: "Family Visit (day)", emoji: "👨‍👩‍👧" },
  { value: "other", label: "Other", emoji: "📍" },
];

const escortOptions = [
  { value: "alone", label: "Going Alone", emoji: "🚶", showWarning: true },
  { value: "family", label: "Family Member", emoji: "👨‍👩‍👧", showContact: true },
  { value: "friend", label: "Friend", emoji: "👤", showContact: true },
  { value: "staff", label: "Staff Member", emoji: "🧑‍⚕️", showStaff: true },
  { value: "transport", label: "Transport / Driver", emoji: "🚌", showContact: true },
  { value: "medical-escort", label: "Medical Escort", emoji: "🏥", showContact: true },
  { value: "group", label: "Group Outing (Staff-led)", emoji: "👥" },
];

export function ResidentOutingDialog({
  open, onOpenChange, onMarkAway,
  preselectedResident = null, defaultMode = "short",
  presenceMap,
}: ResidentOutingDialogProps) {
  const { residents: dbResidents } = useResidents();
  const { staff: dbStaff } = useStaffMembers();
  const residentItems = useMemo(() => dbResidents.map(r => ({ id: r.visitorId, name: r.name, room: r.room, wing: r.wing })), [dbResidents]);
  const staffItems = useMemo(() => dbStaff.map(s => ({ id: s.id, name: s.name, role: s.role })), [dbStaff]);
  const { data: leaveTypesData = [] } = useActiveLeaveTypes();
  const { data: companionFieldsConfig = [] } = useCompanionFields("resident");
  const activeCompanionFields = companionFieldsConfig.filter(f => f.is_active).sort((a, b) => a.sort_order - b.sort_order);

  // Shared state
  const [mode, setMode] = useState<OutingMode>(defaultMode);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedResident, setSelectedResident] = useState(preselectedResident);

  // Short outing state
  const [destination, setDestination] = useState("");
  const [customDestination, setCustomDestination] = useState("");
  const [returnHours, setReturnHours] = useState("2");
  const [escortType, setEscortType] = useState("");
  const [escortName, setEscortName] = useState("");
  const [escortPhone, setEscortPhone] = useState("");
  const [shortNotes, setShortNotes] = useState("");

  // Planned leave state
  const [step, setStep] = useState(1); // 1=schedule, 2=reason, 3=companions, 4=confirm
  const [expectedReturnDate, setExpectedReturnDate] = useState<Date | undefined>(undefined);
  const [expectedReturnTime, setExpectedReturnTime] = useState("12:00");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [checkoutReason, setCheckoutReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [comments, setComments] = useState("");
  const [accompaniedBy, setAccompaniedBy] = useState("");
  const [accompaniedByName, setAccompaniedByName] = useState("");
  const [companions, setCompanions] = useState<CompanionDetail[]>([]);
  const [privacyAcknowledged, setPrivacyAcknowledged] = useState(false);
  const [returnNotificationOptIn, setReturnNotificationOptIn] = useState(false);

  const filteredResidents = useMemo(() => {
    if (!searchQuery.trim()) return residentItems.slice(0, 10);
    const q = searchQuery.toLowerCase();
    return residentItems.filter(r => r.name.toLowerCase().includes(q) || r.room.toLowerCase().includes(q));
  }, [searchQuery, residentItems]);

  const selectedEscort = escortOptions.find(o => o.value === (mode === "short" ? escortType : accompaniedBy));
  const needsEscortContact = mode === "short" && selectedEscort?.showContact;

  const getPresence = (visitorId: string) => presenceMap?.get(visitorId) || "on-site";
  const isAway = (visitorId: string) => {
    const p = getPresence(visitorId);
    return p === "away" || p === "on-leave" || p === "overdue";
  };

  const resetForm = () => {
    setSearchQuery("");
    setSelectedResident(preselectedResident);
    setMode(defaultMode);
    setDestination("");
    setCustomDestination("");
    setReturnHours("2");
    setEscortType("");
    setEscortName("");
    setEscortPhone("");
    setShortNotes("");
    setStep(1);
    setExpectedReturnDate(undefined);
    setExpectedReturnTime("12:00");
    setMobile("");
    setEmail("");
    setCheckoutReason("");
    setCustomReason("");
    setComments("");
    setAccompaniedBy("");
    setAccompaniedByName("");
    setCompanions([]);
    setPrivacyAcknowledged(false);
    setReturnNotificationOptIn(false);
  };

  const handleClose = () => { resetForm(); onOpenChange(false); };

  // ── Short outing submit ──
  const handleShortSubmit = () => {
    if (!selectedResident) return;
    const returnDate = new Date(Date.now() + Number(returnHours) * 3600000);
    const destLabel = destination === "other"
      ? customDestination
      : destinationCategories.find(d => d.value === destination)?.label || destination;

    onMarkAway(selectedResident.id, {
      expectedReturnDate: returnDate,
      checkoutReason: destLabel || undefined,
      leaveType: "Away",
      accompaniedBy: escortType || undefined,
      accompaniedByName: escortName || undefined,
      comments: [shortNotes, escortName ? `Escort: ${escortName}${escortPhone ? ` (${escortPhone})` : ""}` : "", escortPhone ? `Escort phone: ${escortPhone}` : ""].filter(Boolean).join("\n") || undefined,
      returnNotificationOptIn: true,
    });
    resetForm();
    onOpenChange(false);
  };

  // ── Planned leave submit ──
  const handlePlannedSubmit = () => {
    if (!selectedResident) return;
    let combinedReturnDate: Date | undefined;
    if (expectedReturnDate) {
      const [h, m] = expectedReturnTime.split(":").map(Number);
      combinedReturnDate = new Date(expectedReturnDate);
      combinedReturnDate.setHours(h, m, 0, 0);
    }
    const reason = checkoutReason || customReason;

    onMarkAway(selectedResident.id, {
      expectedReturnDate: combinedReturnDate,
      checkoutReason: reason || undefined,
      leaveType: reason || undefined,
      accompaniedBy: accompaniedBy || undefined,
      accompaniedByName: accompaniedByName || undefined,
      comments: comments || undefined,
      returnNotificationOptIn,
      companionDetails: companions.length > 0 ? companions : undefined,
    });
    resetForm();
    onOpenChange(false);
  };

  const canSubmitShort = !!selectedResident && !!destination && !!escortType && (destination !== "other" || !!customDestination);

  const plannedSteps = ["Schedule", "Reason", "Companion", "Confirm"];
  const canProceedPlanned = () => {
    if (step === 1) return !!expectedReturnDate;
    if (step === 2) return !!(checkoutReason || customReason);
    if (step === 3) return !!accompaniedBy;
    return privacyAcknowledged;
  };

  // ── Resident is selected? Show mode toggle + form ──
  const residentSelected = !!selectedResident;

  const presenceBadge = (status: string) => {
    if (status === "away") return <Badge variant="secondary" className="text-[9px] bg-warning/10 text-warning border-warning/30">Away</Badge>;
    if (status === "on-leave") return <Badge variant="secondary" className="text-[9px] bg-info/10 text-info border-info/30">On Leave</Badge>;
    if (status === "overdue") return <Badge variant="destructive" className="text-[9px]">Overdue</Badge>;
    return null;
  };

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="right" className="sm:max-w-[520px] w-full p-0 gap-0 flex flex-col overflow-hidden">
        <SheetHeader className="px-6 pt-5 pb-3 shrink-0 border-b border-border">
          <SheetTitle className="text-lg font-semibold text-foreground">Record Outing</SheetTitle>

          {/* Mode toggle - only show after resident selected */}
          {residentSelected && (
            <div className="flex rounded-xl bg-muted p-1 gap-1 mt-2">
              <button
                onClick={() => { setMode("short"); setStep(1); }}
                className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold transition-all ${
                  mode === "short"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <DoorOpen className="h-3.5 w-3.5" />
                Short Outing
              </button>
              <button
                onClick={() => { setMode("planned"); setStep(1); }}
                className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold transition-all ${
                  mode === "planned"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <CalendarDays className="h-3.5 w-3.5" />
                Leave
              </button>
            </div>
          )}

          {/* Planned leave step indicator */}
          {residentSelected && mode === "planned" && (
            <div className="flex items-center gap-1 pt-2">
              {plannedSteps.map((s, i) => (
                <div key={s} className="flex items-center flex-1">
                  <button
                    onClick={() => { if (i + 1 < step) setStep(i + 1); }}
                    className={`h-7 rounded-full flex items-center gap-1 px-2.5 text-[11px] font-semibold transition-all ${
                      i + 1 < step ? "bg-success/15 text-success cursor-pointer"
                        : i + 1 === step ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-muted text-muted-foreground cursor-default"
                    }`}>
                    {i + 1 < step ? <Check className="h-3 w-3" /> : <span className="text-[10px]">{i + 1}</span>}
                    <span className="hidden sm:inline">{s}</span>
                  </button>
                  {i < plannedSteps.length - 1 && (
                    <div className={`flex-1 h-[2px] mx-1 rounded-full ${i + 1 < step ? "bg-success/40" : "bg-border"}`} />
                  )}
                </div>
              ))}
            </div>
          )}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* ── Resident Selection ── */}
          {!residentSelected ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Select Resident</p>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search by name or room..." className="pl-10 h-10 rounded-xl text-sm" autoFocus />
                </div>
              </div>
              <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
                {filteredResidents.map(r => {
                  const away = isAway(r.id);
                  const presence = getPresence(r.id);
                  return (
                    <button
                      key={r.id}
                      onClick={() => { if (!away) setSelectedResident(r); }}
                      disabled={away}
                      className={`w-full text-left p-3 rounded-xl border transition-all ${
                        away
                          ? "border-border bg-muted/50 opacity-70 cursor-not-allowed"
                          : "border-border hover:border-primary/30 hover:bg-primary/5"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`h-9 w-9 rounded-lg flex items-center justify-center text-xs font-bold ${
                          away ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"
                        }`}>
                          {r.name.split(" ").map(n => n[0]).join("")}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-foreground truncate">{r.name}</p>
                            {away && presenceBadge(presence)}
                          </div>
                          <p className="text-[10px] text-muted-foreground">{r.room} • {r.wing}</p>
                        </div>
                        {away && <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0" />}
                      </div>
                    </button>
                  );
                })}
                {filteredResidents.length === 0 && (
                  <div className="text-center py-8 border border-dashed border-border rounded-xl">
                    <p className="text-xs text-muted-foreground">No residents found</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Selected resident banner */}
              <div className="flex items-center justify-between rounded-xl border border-success/30 bg-success/5 p-3 mb-4">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-success" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">{selectedResident.name}</p>
                    <p className="text-[10px] text-muted-foreground">{selectedResident.room} • {selectedResident.wing}</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setSelectedResident(null)}>Change</Button>
              </div>

              {/* ══════════════════════════════════════════════════ */}
              {/* SHORT OUTING MODE                                  */}
              {/* ══════════════════════════════════════════════════ */}
              {mode === "short" && (
                <div className="space-y-5">
                  {/* Destination */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" /> Where are they going?
                    </Label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {destinationCategories.map(d => (
                        <button key={d.value} onClick={() => setDestination(d.value)}
                          className={`rounded-lg border p-2 text-left transition-all text-xs flex items-center gap-2 ${
                            destination === d.value ? "border-primary bg-primary/5 font-semibold" : "border-border hover:border-primary/30"
                          }`}>
                          <span>{d.emoji}</span> {d.label}
                        </button>
                      ))}
                    </div>
                    {destination === "other" && (
                      <Input value={customDestination} onChange={e => setCustomDestination(e.target.value)}
                        placeholder="Where are they going?" className="h-9 text-sm mt-1 rounded-lg" />
                    )}
                  </div>

                  {/* Expected return */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" /> Expected Return
                    </Label>
                    <div className="flex items-center gap-2">
                      <Select value={returnHours} onValueChange={setReturnHours}>
                        <SelectTrigger className="h-9 text-sm w-[140px] rounded-lg"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0.5">30 minutes</SelectItem>
                          <SelectItem value="1">1 hour</SelectItem>
                          <SelectItem value="2">2 hours</SelectItem>
                          <SelectItem value="3">3 hours</SelectItem>
                          <SelectItem value="4">4 hours</SelectItem>
                          <SelectItem value="6">6 hours</SelectItem>
                          <SelectItem value="8">8 hours</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Back by ~<span className="font-semibold text-foreground">
                          {new Date(Date.now() + Number(returnHours) * 3600000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Escort */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" /> Who is with them?
                    </Label>
                    <Select value={escortType} onValueChange={v => {
                      setEscortType(v);
                      if (!escortOptions.find(o => o.value === v)?.showContact && !escortOptions.find(o => o.value === v)?.showStaff) {
                        setEscortName(""); setEscortPhone("");
                      }
                    }}>
                      <SelectTrigger className="h-9 text-sm rounded-lg"><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>
                        {escortOptions.map(e => (
                          <SelectItem key={e.value} value={e.value}>{e.emoji} {e.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {needsEscortContact && (
                      <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Escort Contact Details</p>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-[11px]">Name</Label>
                            <Input value={escortName} onChange={e => setEscortName(e.target.value)}
                              placeholder="Full name" className="h-8 text-sm rounded-lg" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px]">Phone</Label>
                            <Input value={escortPhone} onChange={e => setEscortPhone(e.target.value)}
                              placeholder="07700..." className="h-8 text-sm rounded-lg" />
                          </div>
                        </div>
                      </div>
                    )}

                    {escortType === "alone" && (
                      <div className="rounded-xl bg-warning/10 border border-warning/30 p-3 flex items-start gap-2">
                        <ShieldAlert className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                        <p className="text-[11px] text-warning">Confirm this resident is assessed for independent outings.</p>
                      </div>
                    )}
                  </div>

                  {/* Notes */}
                  <div className="space-y-1">
                    <Label className="text-xs">Notes (optional)</Label>
                    <Textarea value={shortNotes} onChange={e => setShortNotes(e.target.value)}
                      placeholder="Any additional info..." rows={2} className="text-sm resize-none rounded-lg" />
                  </div>
                </div>
              )}

              {/* ══════════════════════════════════════════════════ */}
              {/* LEAVE MODE                                         */}
              {/* ══════════════════════════════════════════════════ */}
              {mode === "planned" && (
                <>
                  {/* Step 1: Schedule */}
                  {step === 1 && (
                    <div className="space-y-4">
                      <div className="space-y-2.5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Communication Details</p>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-[11px]">Mobile</Label>
                            <Input value={mobile} onChange={e => setMobile(e.target.value)} placeholder="07700..." className="rounded-lg h-9 text-sm" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px]">Email</Label>
                            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" className="rounded-lg h-9 text-sm" />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2.5 pt-2 border-t border-border">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Expected Return</p>
                        <div className="space-y-1">
                          <Label className="text-[11px]">Return Date & Time <span className="text-destructive">*</span></Label>
                          <div className="flex gap-2">
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className="flex-1 justify-start text-left h-9 rounded-lg text-sm gap-2">
                                  <CalendarDays className="h-3.5 w-3.5" />
                                  {expectedReturnDate ? format(expectedReturnDate, "dd MMM yyyy") : "Select date..."}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar mode="single" selected={expectedReturnDate} onSelect={d => d && setExpectedReturnDate(d)} initialFocus
                                  className="pointer-events-auto"
                                  disabled={date => date < new Date(new Date().setHours(0, 0, 0, 0))} />
                              </PopoverContent>
                            </Popover>
                            <Input type="time" value={expectedReturnTime} onChange={e => setExpectedReturnTime(e.target.value)}
                              className="w-[120px] rounded-lg h-9 text-sm" />
                          </div>
                          {expectedReturnDate && (() => {
                            const [h, m] = expectedReturnTime.split(":").map(Number);
                            const combined = new Date(expectedReturnDate);
                            combined.setHours(h, m, 0, 0);
                            const diffMs = combined.getTime() - Date.now();
                            if (diffMs > 0) {
                              const diffHours = Math.round(diffMs / 3600000);
                              return (
                                <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-1">
                                  <Clock className="h-3 w-3" />
                                  Approximately <span className="font-semibold text-foreground">
                                    {diffHours < 24 ? `${diffHours} hour${diffHours !== 1 ? "s" : ""}` : `${Math.floor(diffHours / 24)} day${Math.floor(diffHours / 24) !== 1 ? "s" : ""}`}
                                  </span> from now
                                </p>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Step 2: Reason */}
                  {step === 2 && (
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <Label className="text-[11px]">Reason for Leave <span className="text-destructive">*</span></Label>
                        {leaveTypesData.length > 0 ? (
                          <div className="grid grid-cols-2 gap-2">
                            {leaveTypesData.map(lt => (
                              <button key={lt.id} type="button" onClick={() => { setCheckoutReason(lt.name); setCustomReason(""); }}
                                className={`rounded-xl border-2 p-3 text-left transition-all ${
                                  checkoutReason === lt.name ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                                }`}>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-lg">{lt.emoji}</span>
                                  <span className="text-xs font-bold text-foreground">{lt.name}</span>
                                </div>
                                <p className="text-[10px] text-muted-foreground">{lt.description}</p>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <Input
                            value={customReason}
                            onChange={e => { setCustomReason(e.target.value); setCheckoutReason(""); }}
                            placeholder="Enter reason for leave..."
                            className="rounded-lg h-9 text-sm"
                          />
                        )}
                        {leaveTypesData.length > 0 && (
                          <div className="pt-2">
                            <Label className="text-[11px] text-muted-foreground">Or enter a custom reason</Label>
                            <Input
                              value={customReason}
                              onChange={e => { setCustomReason(e.target.value); setCheckoutReason(""); }}
                              placeholder="Other reason..."
                              className="rounded-lg h-9 text-sm mt-1"
                            />
                          </div>
                        )}
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px]">Comments (optional)</Label>
                        <Textarea value={comments} onChange={e => setComments(e.target.value)}
                          placeholder="Any additional notes..." className="min-h-[50px] resize-none rounded-lg text-sm" />
                      </div>
                    </div>
                  )}

                  {/* Step 3: Companion */}
                  {step === 3 && (
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <Label className="text-[11px]">Who is accompanying the resident? <span className="text-destructive">*</span></Label>
                        <div className="grid grid-cols-2 gap-2">
                          {escortOptions.map(opt => (
                            <button key={opt.value} type="button"
                              onClick={() => { setAccompaniedBy(opt.value); if (!opt.showContact && !opt.showStaff) setAccompaniedByName(""); }}
                              className={`rounded-xl border-2 p-3 text-left transition-all ${
                                accompaniedBy === opt.value ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/30"
                              }`}>
                              <div className="flex items-center gap-2">
                                <span className="text-lg">{opt.emoji}</span>
                                <span className="text-xs font-semibold text-foreground">{opt.label}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>

                      {selectedEscort?.showContact && mode === "planned" && (
                        <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Contact Details</p>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <Label className="text-[11px]">Name</Label>
                              <Input value={accompaniedByName} onChange={e => setAccompaniedByName(e.target.value)}
                                placeholder="Full name" className="rounded-lg h-8 text-sm" />
                            </div>
                          </div>
                        </div>
                      )}

                      {selectedEscort?.showStaff && (
                        <div className="space-y-1 rounded-xl border border-border p-3 bg-muted/30">
                          <Label className="text-[11px]">Staff Member</Label>
                          <Select value={accompaniedByName} onValueChange={setAccompaniedByName}>
                            <SelectTrigger className="rounded-lg h-9 text-sm"><SelectValue placeholder="Select staff member..." /></SelectTrigger>
                            <SelectContent>
                              {staffItems.map(s => (
                                <SelectItem key={s.id} value={s.name}>{s.name} — {s.role}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {selectedEscort?.showWarning && (
                        <div className="rounded-xl bg-warning/10 border border-warning/30 p-3 flex items-start gap-2.5">
                          <ShieldAlert className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-bold text-warning">Independent Outing</p>
                            <p className="text-[11px] text-warning mt-0.5">Please confirm this resident has been assessed for independent outings.</p>
                          </div>
                        </div>
                      )}

                      {/* Additional companions */}
                      {activeCompanionFields.length > 0 && (
                        <div className="pt-2 border-t border-border">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                              <Users className="h-3 w-3" /> Additional Companions
                            </p>
                            <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1"
                              onClick={() => {
                                const empty: CompanionDetail = {};
                                activeCompanionFields.forEach(f => { empty[f.field_key.replace("companion_", "")] = ""; });
                                setCompanions(prev => [...prev, empty]);
                              }}>
                              <Plus className="h-3 w-3" /> Add
                            </Button>
                          </div>
                          {companions.map((companion, cIdx) => (
                            <div key={cIdx} className="rounded-xl border border-border p-3 space-y-2 mb-2">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] font-semibold text-muted-foreground">Person {cIdx + 1}</span>
                                <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive hover:text-destructive"
                                  onClick={() => setCompanions(prev => prev.filter((_, i) => i !== cIdx))}><Trash2 className="h-3 w-3" /></Button>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                {activeCompanionFields.map(f => {
                                  const key = f.field_key.replace("companion_", "");
                                  return (
                                    <div key={f.id} className="space-y-1">
                                      <Label className="text-[11px]">{f.label}</Label>
                                      <Input value={companion[key] || ""} onChange={e => setCompanions(prev => prev.map((c, i) => i === cIdx ? { ...c, [key]: e.target.value } : c))}
                                        placeholder={f.label} className="rounded-lg h-8 text-sm" />
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Step 4: Confirm */}
                  {step === 4 && (
                    <div className="space-y-4">
                      <div className="rounded-xl border border-border bg-muted/30 p-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Summary</p>
                        <div className="grid grid-cols-2 gap-2">
                          {(checkoutReason || customReason) && (() => {
                            const reason = checkoutReason || customReason;
                            const lt = leaveTypesData.find(l => l.name === reason);
                            return (
                              <div className="rounded-lg bg-card p-2.5 border border-border">
                                <p className="text-[10px] text-muted-foreground">Reason</p>
                                <p className="text-xs font-semibold text-foreground">{lt ? `${lt.emoji} ${lt.name}` : reason}</p>
                              </div>
                            );
                          })()}
                          {expectedReturnDate && (
                            <div className="rounded-lg bg-card p-2.5 border border-border">
                              <p className="text-[10px] text-muted-foreground">Expected Return</p>
                              <p className="text-xs font-semibold text-foreground">{format(expectedReturnDate, "dd MMM yyyy")} at {expectedReturnTime}</p>
                            </div>
                          )}
                          {accompaniedBy && (() => {
                            const opt = escortOptions.find(o => o.value === accompaniedBy);
                            return (
                              <div className="rounded-lg bg-card p-2.5 border border-border">
                                <p className="text-[10px] text-muted-foreground">Accompanied By</p>
                                <p className="text-xs font-semibold text-foreground">
                                  {opt ? `${opt.emoji} ${opt.label}` : accompaniedBy}
                                  {accompaniedByName && ` — ${accompaniedByName}`}
                                </p>
                              </div>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Terms */}
                      <div className="rounded-xl border border-border p-3 space-y-3">
                        <div className="flex items-center gap-2">
                          <ScrollText className="h-3.5 w-3.5 text-primary shrink-0" />
                          <h4 className="text-xs font-bold text-foreground">Terms & Privacy</h4>
                        </div>
                        <div className="max-h-[80px] overflow-y-auto rounded-lg bg-muted/30 p-3 text-[10px] text-muted-foreground leading-relaxed space-y-1 border border-border">
                          <p>1. I confirm this departure has been properly authorised.</p>
                          <p>2. The expected return time has been agreed upon.</p>
                          <p>3. All relevant parties have been informed.</p>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 cursor-pointer" onClick={() => setPrivacyAcknowledged(!privacyAcknowledged)}>
                            <Checkbox checked={privacyAcknowledged} onCheckedChange={c => setPrivacyAcknowledged(c === true)} />
                            <span className="text-xs text-foreground">I confirm this leave has been authorised</span>
                          </div>
                          {expectedReturnDate && (
                            <div className="rounded-lg border border-border p-2.5 space-y-2">
                              <div className="flex items-center gap-2 cursor-pointer" onClick={() => setReturnNotificationOptIn(!returnNotificationOptIn)}>
                                <Checkbox checked={returnNotificationOptIn} onCheckedChange={c => setReturnNotificationOptIn(c === true)} />
                                <span className="text-xs text-foreground">Notify staff if not returned by <strong>{format(expectedReturnDate, "dd MMM yyyy")} at {expectedReturnTime}</strong></span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="shrink-0 flex items-center justify-between px-6 py-3 border-t border-border bg-card/80 backdrop-blur-sm">
          <Button variant="ghost" size="sm" onClick={handleClose} className="text-muted-foreground">Cancel</Button>

          {residentSelected && mode === "short" && (
            <Button size="sm" onClick={handleShortSubmit} disabled={!canSubmitShort} className="gap-1.5 rounded-xl">
              <DoorOpen className="h-4 w-4" /> Mark Away
            </Button>
          )}

          {residentSelected && mode === "planned" && (
            <div className="flex gap-2">
              {step > 1 && (
                <Button variant="outline" size="sm" onClick={() => setStep(step - 1)} className="gap-1 rounded-xl">
                  <ArrowLeft className="h-3.5 w-3.5" /> Back
                </Button>
              )}
              {step < 4 ? (
                <Button size="sm" onClick={() => setStep(step + 1)} className="gap-1 rounded-xl" disabled={!canProceedPlanned()}>
                  Next <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              ) : (
                <Button size="sm" onClick={handlePlannedSubmit} className="gap-1 rounded-xl" disabled={!privacyAcknowledged}>
                  <Check className="h-3.5 w-3.5" /> Confirm Leave
                </Button>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
