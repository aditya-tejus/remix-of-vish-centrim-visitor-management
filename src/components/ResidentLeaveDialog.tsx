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
import { Visitor, CompanionDetail } from "@/types/visitor";
import { Search, ArrowLeft, ArrowRight, Check, Home, Clock, CalendarDays, Users, Plus, Trash2, ScrollText, Shield } from "lucide-react";
import { useActiveLeaveTypes } from "@/hooks/useLeaveTypes";
import { useCompanionFields } from "@/hooks/useFormFields";
import { useResidents } from "@/hooks/useResidents";
import { useStaffMembers } from "@/hooks/useStaffMembers";
import { format } from "date-fns";

interface ResidentLeaveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (visitor: Omit<Visitor, "id">) => void;
}

const escortOptions = [
  { value: "family", label: "Family Member", emoji: "👨‍👩‍👧", showName: true },
  { value: "friend", label: "Friend", emoji: "👤", showName: true },
  { value: "staff", label: "Staff Member", emoji: "🧑‍⚕️", showStaff: true },
  { value: "transport", label: "Transport / Driver Only", emoji: "🚌" },
  { value: "medical-escort", label: "Medical Escort", emoji: "🏥" },
  { value: "alone", label: "Going Alone (Independent)", emoji: "🚶", showWarning: true },
  { value: "group", label: "Group Outing (Staff-led)", emoji: "👥" },
];

const steps = ["Resident", "Schedule", "Reason", "Companions", "Confirm"];

export function ResidentLeaveDialog({ open, onOpenChange, onSubmit }: ResidentLeaveDialogProps) {
  const { residents: dbResidents } = useResidents();
  const { staff: dbStaff } = useStaffMembers();
  const residentItems = useMemo(() => dbResidents.map(r => ({ id: r.visitorId, name: r.name, room: r.room, wing: r.wing })), [dbResidents]);
  const staffItems = useMemo(() => dbStaff.map(s => ({ id: s.id, name: s.name, role: s.role })), [dbStaff]);
  const [step, setStep] = useState(1);
  const { data: leaveTypesData = [] } = useActiveLeaveTypes();
  const { data: companionFieldsConfig = [] } = useCompanionFields("resident");
  const activeCompanionFields = companionFieldsConfig.filter((f) => f.is_active).sort((a, b) => a.sort_order - b.sort_order);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedResident, setSelectedResident] = useState<typeof mockResidents[0] | null>(null);
  const [expectedReturnDate, setExpectedReturnDate] = useState<Date | undefined>(undefined);
  const [expectedReturnTime, setExpectedReturnTime] = useState("12:00");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [checkoutReason, setCheckoutReason] = useState("");
  const [comments, setComments] = useState("");
  const [accompaniedBy, setAccompaniedBy] = useState("");
  const [accompaniedByName, setAccompaniedByName] = useState("");
  const [companions, setCompanions] = useState<CompanionDetail[]>([]);
  const [privacyAcknowledged, setPrivacyAcknowledged] = useState(false);
  const [returnNotificationOptIn, setReturnNotificationOptIn] = useState(false);

  const filteredResidents = useMemo(() => {
    if (!searchQuery.trim()) return mockResidents;
    const q = searchQuery.toLowerCase();
    return mockResidents.filter(
      (r) => r.name.toLowerCase().includes(q) || r.room.toLowerCase().includes(q) || r.wing.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const resetForm = () => {
    setStep(1);
    setSearchQuery("");
    setSelectedResident(null);
    setExpectedReturnDate(undefined);
    setExpectedReturnTime("12:00");
    setMobile("");
    setEmail("");
    setCheckoutReason("");
    setComments("");
    setAccompaniedBy("");
    setAccompaniedByName("");
    setCompanions([]);
    setPrivacyAcknowledged(false);
    setReturnNotificationOptIn(false);
  };

  const handleClose = () => { resetForm(); onOpenChange(false); };

  const handleSubmit = () => {
    if (!selectedResident) return;
    const [firstName, ...rest] = selectedResident.name.split(" ");
    let combinedReturnDate: Date | undefined;
    if (expectedReturnDate) {
      const [h, m] = expectedReturnTime.split(":").map(Number);
      combinedReturnDate = new Date(expectedReturnDate);
      combinedReturnDate.setHours(h, m, 0, 0);
    }
    const visitor: Omit<Visitor, "id"> = {
      firstName: firstName || "",
      surname: rest.join(" ") || "",
      email,
      mobile,
      type: "resident",
      checkInTime: new Date(),
      checkOutTime: new Date(),
      whomToVisit: "",
      address: `${selectedResident.room}, ${selectedResident.wing}`,
      status: "checked-out",
      healthDeclaration: false,
      additionalVisitors: companions.length,
      companionDetails: companions.length > 0 ? companions : undefined,
      comments,
      retentionExpiry: new Date(Date.now() + 86400000 * 60),
      acknowledgedPrivacy: privacyAcknowledged,
      expectedReturnDate: combinedReturnDate,
      checkoutReason: checkoutReason || undefined,
      leaveType: checkoutReason || undefined,
      returnNotificationOptIn,
      accompaniedBy: accompaniedBy || undefined,
      accompaniedByName: accompaniedByName || undefined,
    };
    onSubmit(visitor);
    resetForm();
    onOpenChange(false);
  };

  const canProceed = () => {
    if (step === 1) return !!selectedResident;
    if (step === 2) return !!expectedReturnDate;
    if (step === 3) return !!checkoutReason;
    if (step === 4) return !!accompaniedBy;
    return privacyAcknowledged;
  };

  const selectedEscort = escortOptions.find(o => o.value === accompaniedBy);

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="right" className="sm:max-w-[520px] w-full p-0 gap-0 flex flex-col overflow-hidden">
        <SheetHeader className="px-6 pt-5 pb-3 shrink-0">
          <SheetTitle className="text-lg font-semibold text-foreground">Resident Leave</SheetTitle>
          <div className="flex items-center gap-1 pt-2">
            {steps.map((s, i) => (
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
                {i < steps.length - 1 && (
                  <div className={`flex-1 h-[2px] mx-1 rounded-full ${i + 1 < step ? "bg-success/40" : "bg-border"}`} />
                )}
              </div>
            ))}
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-2">
          {/* Step 1: Select Resident */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Select Resident</p>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name, room, or wing..." className="pl-10 h-10 rounded-xl text-sm" autoFocus />
                </div>
              </div>
              <div className="space-y-1.5 max-h-[360px] overflow-y-auto">
                {filteredResidents.map((resident) => (
                  <button key={resident.id} onClick={() => setSelectedResident(resident)}
                    className={`w-full text-left p-3 rounded-xl border transition-all ${
                      selectedResident?.id === resident.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                    }`}>
                    <div className="flex items-center gap-3">
                      <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
                        selectedResident?.id === resident.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      }`}>
                        <Home className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{resident.name}</p>
                        <span className="text-[10px] text-muted-foreground">{resident.room} • {resident.wing}</span>
                      </div>
                      {selectedResident?.id === resident.id && <Check className="h-4 w-4 text-primary shrink-0" />}
                    </div>
                  </button>
                ))}
                {filteredResidents.length === 0 && (
                  <div className="text-center py-6 border border-dashed border-border rounded-xl">
                    <p className="text-xs text-muted-foreground">No residents found</p>
                  </div>
                )}
              </div>
              {selectedResident && (
                <div className="rounded-xl border border-success/30 bg-success/5 p-3 flex items-center gap-3">
                  <Check className="h-4 w-4 text-success shrink-0" />
                  <p className="text-xs text-foreground">
                    <span className="font-bold">{selectedResident.name}</span> — {selectedResident.room}, {selectedResident.wing}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Schedule */}
          {step === 2 && (
            <div className="space-y-4">
              {selectedResident && (
                <div className="rounded-xl border border-border bg-muted/30 p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Resident</p>
                    <button onClick={() => setStep(1)} className="text-[10px] text-primary hover:underline font-semibold">Change</button>
                  </div>
                  <p className="text-sm font-bold text-foreground">{selectedResident.name}</p>
                  <p className="text-[10px] text-muted-foreground">{selectedResident.room} • {selectedResident.wing}</p>
                </div>
              )}
              <div className="space-y-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Communication Details</p>
                <div className="space-y-1">
                  <Label className="text-[11px]">Mobile Number</Label>
                  <Input value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="07700..." className="rounded-lg h-9 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px]">Email</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" className="rounded-lg h-9 text-sm" />
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
                        <Calendar mode="single" selected={expectedReturnDate} onSelect={(d) => d && setExpectedReturnDate(d)} initialFocus
                          className="pointer-events-auto"
                          disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))} />
                      </PopoverContent>
                    </Popover>
                    <Input type="time" value={expectedReturnTime} onChange={(e) => setExpectedReturnTime(e.target.value)}
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
                          Approximately <span className="font-semibold text-foreground">{diffHours < 24 ? `${diffHours} hour${diffHours !== 1 ? "s" : ""}` : `${Math.floor(diffHours / 24)} day${Math.floor(diffHours / 24) !== 1 ? "s" : ""} ${diffHours % 24} hr${diffHours % 24 !== 1 ? "s" : ""}`}</span> from now
                        </p>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Reason */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-1">
                <Label className="text-[11px]">Reason for Leave <span className="text-destructive">*</span></Label>
                <div className="grid grid-cols-2 gap-2">
                  {leaveTypesData.map((lt) => (
                    <button key={lt.id} type="button" onClick={() => setCheckoutReason(lt.name)}
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
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Comments (optional)</Label>
                <Textarea value={comments} onChange={(e) => setComments(e.target.value)}
                  placeholder="Any additional notes..." className="min-h-[50px] resize-none rounded-lg text-sm" />
              </div>
            </div>
          )}

          {/* Step 4: Accompanied By */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="space-y-1">
                <Label className="text-[11px]">Who is accompanying the resident? <span className="text-destructive">*</span></Label>
                <div className="grid grid-cols-2 gap-2">
                  {escortOptions.map((opt) => (
                    <button key={opt.value} type="button"
                      onClick={() => { setAccompaniedBy(opt.value); if (!opt.showName && !opt.showStaff) setAccompaniedByName(""); }}
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

              {selectedEscort?.showName && (
                <div className="space-y-1 rounded-xl border border-border p-3 bg-muted/30">
                  <Label className="text-[11px]">{selectedEscort.label} Name <span className="text-muted-foreground">(optional)</span></Label>
                  <Input value={accompaniedByName} onChange={(e) => setAccompaniedByName(e.target.value)}
                    placeholder={`Enter ${selectedEscort.label.toLowerCase()} name...`} className="rounded-lg h-9 text-sm" />
                </div>
              )}

              {selectedEscort?.showStaff && (
                <div className="space-y-1 rounded-xl border border-border p-3 bg-muted/30">
                  <Label className="text-[11px]">Staff Member</Label>
                  <Select value={accompaniedByName} onValueChange={setAccompaniedByName}>
                    <SelectTrigger className="rounded-lg h-9 text-sm"><SelectValue placeholder="Select staff member..." /></SelectTrigger>
                    <SelectContent>
                      {mockStaff.map((s) => (
                        <SelectItem key={s.id} value={s.name}>{s.name} — {s.role}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {selectedEscort?.showWarning && (
                <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 flex items-start gap-2.5">
                  <span className="text-lg">⚠️</span>
                  <div>
                    <p className="text-xs font-bold text-amber-700 dark:text-amber-400">Independent Outing</p>
                    <p className="text-[11px] text-amber-600 dark:text-amber-500 mt-0.5">Please confirm this resident has been assessed and approved for independent outings.</p>
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
                        activeCompanionFields.forEach((f) => { empty[f.field_key.replace("companion_", "")] = ""; });
                        setCompanions((prev) => [...prev, empty]);
                      }}>
                      <Plus className="h-3 w-3" /> Add
                    </Button>
                  </div>
                  {companions.map((companion, cIdx) => (
                    <div key={cIdx} className="rounded-xl border border-border p-3 space-y-2 mb-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-semibold text-muted-foreground">Person {cIdx + 1}</span>
                        <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive hover:text-destructive"
                          onClick={() => setCompanions((prev) => prev.filter((_, i) => i !== cIdx))}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {activeCompanionFields.map((f) => {
                          const key = f.field_key.replace("companion_", "");
                          return (
                            <div key={f.id} className="space-y-1">
                              <Label className="text-[11px]">{f.label}</Label>
                              <Input value={companion[key] || ""} onChange={(e) => setCompanions((prev) => prev.map((c, i) => i === cIdx ? { ...c, [key]: e.target.value } : c))}
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

          {/* Step 5: Confirm */}
          {step === 5 && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Summary</p>
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                    {selectedResident?.name.split(" ").map(n => n[0]).join("")}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-foreground">{selectedResident?.name}</p>
                    <p className="text-[11px] text-muted-foreground">Resident • {selectedResident?.room}, {selectedResident?.wing}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {checkoutReason && (() => {
                    const lt = leaveTypesData.find((l) => l.name === checkoutReason);
                    return (
                      <div className="rounded-lg bg-card p-2.5 border border-border">
                        <p className="text-[10px] text-muted-foreground">Reason</p>
                        <p className="text-xs font-semibold text-foreground">{lt ? `${lt.emoji} ${lt.name}` : checkoutReason}</p>
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
                  {mobile && (
                    <div className="rounded-lg bg-card p-2.5 border border-border">
                      <p className="text-[10px] text-muted-foreground">Phone</p>
                      <p className="text-xs font-semibold text-foreground">{mobile}</p>
                    </div>
                  )}
                </div>
                {companions.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                      <Users className="h-3 w-3" /> Companions ({companions.length})
                    </p>
                    <div className="space-y-1.5">
                      {companions.map((c, i) => (
                        <div key={i} className="rounded-lg bg-card p-2 border border-border flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                            {(c.name || "?")[0]?.toUpperCase()}
                          </div>
                          <p className="text-xs font-semibold text-foreground truncate">{c.name || `Person ${i + 1}`}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {/* Terms & Privacy */}
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
                    <Checkbox checked={privacyAcknowledged} onCheckedChange={(c) => setPrivacyAcknowledged(c === true)} />
                    <span className="text-xs text-foreground">I confirm this leave has been authorised</span>
                  </div>
                  {expectedReturnDate && (
                    <div className="rounded-lg border border-border p-2.5 space-y-2">
                      <div className="flex items-center gap-2 cursor-pointer" onClick={() => setReturnNotificationOptIn(!returnNotificationOptIn)}>
                        <Checkbox checked={returnNotificationOptIn} onCheckedChange={(c) => setReturnNotificationOptIn(c === true)} />
                        <span className="text-xs text-foreground">Notify staff if not returned by <strong>{format(expectedReturnDate, "dd MMM yyyy")} at {expectedReturnTime}</strong></span>
                      </div>
                      <p className="text-[10px] text-muted-foreground ml-6">Enables return monitoring for safety.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 flex items-center justify-between px-6 py-3 border-t border-border bg-card/80 backdrop-blur-sm">
          <Button variant="ghost" size="sm" onClick={handleClose} className="text-muted-foreground">Cancel</Button>
          <div className="flex gap-2">
            {step > 1 && (
              <Button variant="outline" size="sm" onClick={() => setStep(step - 1)} className="gap-1 rounded-xl">
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </Button>
            )}
            {step < 5 ? (
              <Button size="sm" onClick={() => setStep(step + 1)} className="gap-1 rounded-xl" disabled={!canProceed()}>
                Next <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button size="sm" onClick={handleSubmit} className="gap-1 rounded-xl" disabled={!privacyAcknowledged}>
                <Check className="h-3.5 w-3.5" /> Confirm Leave
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
