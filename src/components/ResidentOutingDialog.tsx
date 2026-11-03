import { useState, useMemo, useEffect, useRef } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
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
  Users, Plus, Trash2, ScrollText, DoorOpen, ShieldAlert, AlertTriangle,
} from "lucide-react";
import { useActiveLeaveTypes } from "@/hooks/useLeaveTypes";
import { useCompanionFields } from "@/hooks/useFormFields";
import { useResidents } from "@/hooks/useResidents";
import { useStaffMembers } from "@/hooks/useStaffMembers";
import { format } from "date-fns";
import { useOperatingContext } from "@/contexts/OperatingContext";
import { useSite } from "@/contexts/SiteContext";
import { usePermissions } from "@/hooks/usePermissions";
import { independentAbsenceAllowed, absenceReady, residentLocalInstant, movementTimeZone } from "@/lib/residentMovement";
import { TimeOverride } from "@/components/TimeOverride";

type OutingMode = "short" | "planned";

interface ResidentOutingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMarkAway: (visitorId: string, details: {
    recordedTime?: Date;
    expectedReturnDate?: Date;
    checkoutReason?: string;
    leaveType?: string;
    accompaniedBy?: string;
    accompaniedByName?: string;
    comments?: string;
    returnNotificationOptIn?: boolean;
    companionDetails?: CompanionDetail[];
  }) => Promise<void>;
  preselectedResident?: { id: string; name: string; room: string; wing: string } | null;
  defaultMode?: OutingMode;
  /** Map of visitorId → presence status to show away residents */
  presenceMap?: Map<string, "no-absence" | "away" | "on-leave" | "overdue">;
}

const destinationCategories = [
  { value: "garden", label: "Garden or grounds", },
  { value: "local-shops", label: "Local shops", },
  { value: "walk", label: "Walk or fresh air", },
  { value: "cafe", label: "Café or restaurant", },
  { value: "appointment", label: "Appointment nearby", },
  { value: "family-visit", label: "Family visit (day)", },
  { value: "other", label: "Other", },
];

const escortOptions = [
  { value: "alone", label: "Going alone", showWarning: true },
  { value: "family", label: "Family member", showContact: true },
  { value: "friend", label: "Friend", showContact: true },
  { value: "staff", label: "Staff member", showStaff: true },
  { value: "transport", label: "Transport or driver", showContact: true },
  { value: "medical-escort", label: "Medical escort", showContact: true },
  { value: "group", label: "Group outing (staff-led)", },
];

export function ResidentOutingDialog({
  open, onOpenChange, onMarkAway,
  preselectedResident = null, defaultMode = "short",
  presenceMap,
}: ResidentOutingDialogProps) {
  const { packId, jurisdiction } = useOperatingContext();
  const { currentSiteId, currentSite } = useSite();
  const { can, loading: permissionsLoading } = usePermissions();
  const { residents: dbResidents } = useResidents({ enabled: !permissionsLoading && can("presence.view") });
  const timeZone = movementTimeZone(currentSite?.timezone, jurisdiction);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [optionalReturn, setOptionalReturn] = useState("");
  const [timeOverride, setTimeOverride] = useState<string | null>(null);
  const saveLock = useRef(false);
  const attemptedDetails = useRef<Parameters<typeof onMarkAway>[1] | null>(null);
  const openedSite = useRef(currentSiteId);
  const siteRef = useRef(currentSiteId); siteRef.current = currentSiteId;

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
    const q = searchQuery.trim().toLowerCase();
    const list = q ? residentItems.filter(r => `${r.name} ${r.room} ${r.wing}`.toLowerCase().includes(q)) : residentItems;
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [searchQuery, residentItems]);

  const selectedEscort = escortOptions.find(o => o.value === (mode === "short" ? escortType : accompaniedBy));
  const needsEscortContact = mode === "short" && selectedEscort?.showContact;

  const independent = independentAbsenceAllowed(packId, mode);
  useEffect(() => {
    if (open) { setSelectedResident(preselectedResident); setMode(defaultMode); openedSite.current = currentSiteId; setSaveError(""); }
  }, [open, preselectedResident?.id]);
  const getPresence = (visitorId: string) => presenceMap?.get(visitorId) || "no-absence";
  const isAway = (visitorId: string) => {
    const p = getPresence(visitorId);
    return p === "away" || p === "on-leave" || p === "overdue";
  };

  const resetForm = () => {
    attemptedDetails.current = null;
    setOptionalReturn(""); setTimeOverride(null); setSaveError("");
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

  const handleClose = () => { if (saveLock.current) return; resetForm(); onOpenChange(false); };
  const persist = async (details: Parameters<typeof onMarkAway>[1]) => {
    if (!selectedResident || saveLock.current) return;
    if (!currentSiteId || openedSite.current !== currentSiteId || permissionsLoading || !can("checkout.perform")) { setSaveError("The site or access changed. Close and reopen this form."); return; }
    saveLock.current = true; setSaving(true); setSaveError("");
    try {
      const recorded = new Date();
      if (timeOverride && !attemptedDetails.current) {
        const dayParts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {timeZone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(recorded).map(p => [p.type,p.value]));
        details.recordedTime = residentLocalInstant(`${dayParts.year}-${dayParts.month}-${dayParts.day}T${timeOverride}`,timeZone);
      }
      if (!attemptedDetails.current && details.expectedReturnDate && details.expectedReturnDate <= (details.recordedTime ?? recorded)) throw new Error("Expected return must follow departure.");
      if (!attemptedDetails.current) attemptedDetails.current = details;
      await onMarkAway(selectedResident.id, attemptedDetails.current);
      if (siteRef.current !== openedSite.current) throw new Error("The site changed. Refresh to check the original site.");
      resetForm(); onOpenChange(false);
    } catch (error) { setSaveError(error instanceof Error ? error.message : "Departure was not confirmed. Please retry."); }
    finally { saveLock.current = false; setSaving(false); }
  };

  // ── Short outing submit ──
  const handleShortSubmit = async () => {
    if (!selectedResident) return;
    if (attemptedDetails.current) { await persist(attemptedDetails.current); return; }
    let returnDate: Date | undefined;
    try { returnDate = independent ? residentLocalInstant(optionalReturn, timeZone) : new Date(Date.now() + Number(returnHours) * 3600000); }
    catch (error) { setSaveError(error instanceof Error ? error.message : "Check the return time."); return; }
    const destLabel = destination === "other"
      ? customDestination
      : destinationCategories.find(d => d.value === destination)?.label || destination;

    await persist({
      expectedReturnDate: returnDate,
      checkoutReason: destLabel || undefined,
      leaveType: "Away",
      accompaniedBy: escortType || undefined,
      accompaniedByName: escortName || undefined,
      comments: [shortNotes, escortName ? `Escort: ${escortName}${escortPhone ? ` (${escortPhone})` : ""}` : "", escortPhone ? `Escort phone: ${escortPhone}` : ""].filter(Boolean).join("\n") || undefined,
      returnNotificationOptIn: false,
    });
  };

  // ── Planned leave submit ──
  const handlePlannedSubmit = async () => {
    if (!selectedResident) return;
    if (attemptedDetails.current) { await persist(attemptedDetails.current); return; }
    let combinedReturnDate: Date | undefined;
    if (expectedReturnDate) {
      try { combinedReturnDate = residentLocalInstant(`${format(expectedReturnDate, "yyyy-MM-dd")}T${expectedReturnTime}`, timeZone); }
      catch (error) { setSaveError(error instanceof Error ? error.message : "Check the return time."); return; }
    }
    const reason = checkoutReason || customReason;

    await persist({
      expectedReturnDate: combinedReturnDate,
      checkoutReason: reason || undefined,
      leaveType: reason || undefined,
      accompaniedBy: accompaniedBy || undefined,
      accompaniedByName: accompaniedByName || undefined,
      comments: comments || undefined,
      returnNotificationOptIn,
      companionDetails: companions.length > 0 ? companions : undefined,
    });
  };

  const canSubmitShort = absenceReady(independent, selectedResident?.id, destination === "other" ? customDestination : destination, escortType);

  const plannedSteps = ["Schedule", "Reason", "Companion", "Confirm"];
  const canProceedPlanned = () => {
    if (step === 1) return !!expectedReturnDate;
    if (step === 2) return !!(checkoutReason || customReason);
    if (step === 3) return !!accompaniedBy;
    return privacyAcknowledged;
  };

  // ── Resident is selected? Show mode toggle + form ──
  const residentSelected = !!selectedResident;

  const backBy = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).format(new Date(Date.now() + Number(returnHours) * 3600000));
  const outLabel = (status: string) => status === "overdue" ? "Overdue back" : status === "on-leave" ? "On leave" : "Out";
  const availableResidents = filteredResidents.filter(r => !isAway(r.id));
  const awayResidents = filteredResidents.filter(r => isAway(r.id));
  const initials = (name: string) => name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  const blockedBySite = !currentSiteId || openedSite.current !== currentSiteId || permissionsLoading || !can("checkout.perform");
  const shortMissing = !residentSelected ? ["a resident"] : independent ? [] : [
    !(destination === "other" ? customDestination.trim() : destination) ? "where they are going" : "",
    !escortType ? "who is with them" : "",
  ].filter(Boolean);
  const plannedNeeds = ["a return date", "a reason", "who is with them", "the authorisation tick"][step - 1];
  const chip = (on: boolean) => `min-h-11 rounded-lg border px-3 text-left text-sm font-bold transition-colors ${on ? "border-primary bg-accent text-accent-foreground" : "border-input bg-card text-foreground hover:border-primary/60"}`;

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <SheetHeader className="shrink-0 space-y-0 border-b border-border px-5 py-4 pr-14 text-left sm:px-6">
          <p className="text-[11px] font-extrabold uppercase leading-4 tracking-[0.06em] text-primary">{currentSite?.name || "Residents"}</p>
          <SheetTitle className="mt-0.5 text-2xl font-extrabold leading-8">{independent ? "Record reported absence" : "Record outing"}</SheetTitle>
          <SheetDescription className="mt-1 text-[13px]">
            {independent ? "Optional details shared by the resident. Where they are is not confirmed." : "Follow the resident's individual support arrangements."} Times are in {timeZone}.
          </SheetDescription>
        </SheetHeader>

        <fieldset disabled={saving || !!attemptedDetails.current} className="min-h-0 flex-1 overflow-y-auto bg-secondary/60 px-4 py-4 sm:px-6">
          {!residentSelected ? (
            /* ── Choose the resident ── */
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="outing-resident-search" className="text-sm font-bold text-foreground">Who is going out?</label>
                <div className="relative">
                  <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="outing-resident-search" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search name, room or wing" className="pl-10" autoFocus />
                </div>
              </div>

              <section aria-label="Residents who can go out" className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                <p className="border-b border-border bg-secondary/60 px-4 py-2 text-xs font-bold text-muted-foreground">
                  {availableResidents.length} {availableResidents.length === 1 ? "resident" : "residents"}{searchQuery.trim() ? " match" : ""}
                </p>
                {availableResidents.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-muted-foreground">{searchQuery.trim() ? "Nobody matches that search." : "Every resident is recorded as out."}</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {availableResidents.map(r => (
                      <li key={r.id}>
                        <button type="button" onClick={() => setSelectedResident(r)}
                          className="flex min-h-[60px] w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-accent focus-visible:bg-accent">
                          <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-extrabold text-accent-foreground">{initials(r.name)}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-bold text-foreground">{r.name}</span>
                            <span className="block truncate text-[13px] text-muted-foreground">{[r.room, r.wing].filter(Boolean).join(" · ") || "Room not recorded"}</span>
                          </span>
                          <ArrowRight aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {awayResidents.length > 0 && (
                <section aria-label="Already out" className="overflow-hidden rounded-2xl border border-border bg-card">
                  <p className="border-b border-border bg-secondary/60 px-4 py-2 text-xs font-bold text-muted-foreground">
                    Already out ({awayResidents.length}) — record their return from the Residents page
                  </p>
                  <ul className="divide-y divide-border">
                    {awayResidents.map(r => {
                      const status = getPresence(r.id);
                      return (
                        <li key={r.id} className="flex min-h-[56px] items-center gap-3 px-4 py-2.5">
                          <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-extrabold text-muted-foreground">{initials(r.name)}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-muted-foreground">{r.name}</span>
                            <span className="block truncate text-[13px] text-muted-foreground">{[r.room, r.wing].filter(Boolean).join(" · ")}</span>
                          </span>
                          <span className={`shrink-0 rounded-full px-2 text-xs font-bold leading-6 ${status === "overdue" ? "border border-[hsl(var(--warning)/0.45)] text-warning-strong" : "bg-info-subtle text-info-strong"}`}>
                            {status === "overdue" && <AlertTriangle aria-hidden className="mr-1 inline h-3 w-3" />}{outLabel(status)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Chosen resident */}
              <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-sm">
                <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-extrabold text-accent-foreground">{initials(selectedResident.name)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-extrabold text-foreground">{selectedResident.name}</p>
                  <p className="truncate text-[13px] text-muted-foreground">{[selectedResident.room, selectedResident.wing].filter(Boolean).join(" · ")}</p>
                </div>
                <Button variant="ghost" size="sm" className="text-primary-hover" onClick={() => setSelectedResident(null)}>Change</Button>
              </div>

              {/* Kind of absence */}
              <div role="group" aria-label="Kind of absence" className="grid grid-cols-2 gap-2">
                {([["short", packId === "au_rv" ? "Reported absence" : "Short outing", "Back the same day", DoorOpen], ["planned", "Supported leave", "Overnight or longer", CalendarDays]] as const).map(([value, label, note, Icon]) => {
                  const on = mode === value;
                  return (
                    <button key={value} type="button" aria-pressed={on} disabled={saving || !!attemptedDetails.current}
                      onClick={() => { setMode(value); setStep(1); }}
                      className={`flex min-h-[60px] items-start gap-2.5 rounded-xl border p-3 text-left transition-colors ${on ? "border-primary bg-accent ring-1 ring-primary" : "border-input bg-card hover:border-primary/60"}`}>
                      <Icon aria-hidden className={`mt-0.5 h-4 w-4 shrink-0 ${on ? "text-accent-foreground" : "text-muted-foreground"}`} />
                      <span>
                        <span className={`block text-sm font-bold ${on ? "text-accent-foreground" : "text-foreground"}`}>{label}</span>
                        <span className="block text-xs text-muted-foreground">{note}</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="space-y-5 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
                {/* ── Short outing ── */}
                {mode === "short" && !independent && (<>
                  <Field label="Where are they going?" required>
                    <div className="grid grid-cols-2 gap-2">
                      {destinationCategories.map(d => (
                        <button key={d.value} type="button" aria-pressed={destination === d.value} onClick={() => setDestination(d.value)} className={chip(destination === d.value)}>{d.label}</button>
                      ))}
                    </div>
                    {destination === "other" && (
                      <Input value={customDestination} onChange={e => setCustomDestination(e.target.value)} placeholder="Where are they going?" aria-label="Where are they going" autoFocus />
                    )}
                  </Field>

                  <Field label="When will they be back?" hint={`Back by about ${backBy}`}>
                    <div role="group" aria-label="Expected time away" className="flex flex-wrap gap-2">
                      {[["0.5", "30 min"], ["1", "1 h"], ["2", "2 h"], ["3", "3 h"], ["4", "4 h"], ["6", "6 h"], ["8", "8 h"]].map(([v, l]) => (
                        <button key={v} type="button" aria-pressed={returnHours === v} onClick={() => setReturnHours(v)}
                          className={`min-h-11 min-w-[60px] rounded-full border px-3.5 text-sm font-bold transition-colors ${returnHours === v ? "border-primary bg-accent text-accent-foreground" : "border-input bg-card text-foreground hover:border-primary/60"}`}>{l}</button>
                      ))}
                    </div>
                  </Field>

                  <Field label="Who is with them?" required>
                    <div className="grid grid-cols-2 gap-2">
                      {escortOptions.map(e => (
                        <button key={e.value} type="button" aria-pressed={escortType === e.value}
                          onClick={() => { setEscortType(e.value); if (!e.showContact && !e.showStaff) { setEscortName(""); setEscortPhone(""); } }}
                          className={chip(escortType === e.value)}>{e.label}</button>
                      ))}
                    </div>
                    {needsEscortContact && (
                      <div className="grid grid-cols-1 gap-3 rounded-xl bg-secondary/80 p-3 sm:grid-cols-2">
                        <div className="space-y-1"><Label htmlFor="escort-name">Their name</Label><Input id="escort-name" value={escortName} onChange={e => setEscortName(e.target.value)} placeholder="Full name" /></div>
                        <div className="space-y-1"><Label htmlFor="escort-phone">Their phone</Label><Input id="escort-phone" type="tel" value={escortPhone} onChange={e => setEscortPhone(e.target.value)} placeholder="Mobile number" /></div>
                      </div>
                    )}
                    {escortType === "alone" && (
                      <p className="flex items-start gap-2 rounded-xl bg-warning-subtle px-3 py-2.5 text-[13px] font-semibold text-warning-strong">
                        <ShieldAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />Check this resident is assessed for going out on their own.
                      </p>
                    )}
                  </Field>

                  <div className="space-y-1.5">
                    <Label htmlFor="outing-notes">Notes <span className="font-normal text-muted-foreground">(optional)</span></Label>
                    <Textarea id="outing-notes" value={shortNotes} onChange={e => setShortNotes(e.target.value)} placeholder="Anything staff should know" rows={2} className="resize-none" />
                  </div>
                </>)}

                {independent && (<div className="space-y-4">
                  <div className="space-y-1.5"><Label htmlFor="independent-reason">Destination or reason (optional)</Label>
                    <Input id="independent-reason" value={customDestination} onChange={e => {setCustomDestination(e.target.value); setDestination("other");}} /></div>
                  <div className="space-y-1.5"><Label htmlFor="independent-return">Expected return (optional)</Label>
                    <Input id="independent-return" type="datetime-local" value={optionalReturn} onChange={e => setOptionalReturn(e.target.value)} /></div>
                  <div className="space-y-1.5"><Label htmlFor="independent-notes">Notes (optional)</Label>
                    <Textarea id="independent-notes" value={shortNotes} onChange={e => setShortNotes(e.target.value)} /></div>
                </div>)}

                {/* ── Supported leave, in four short steps ── */}
                {mode === "planned" && (<>
                  <ol aria-label="Leave steps" className="flex items-center gap-1.5">
                    {plannedSteps.map((label, i) => {
                      const n = i + 1; const done = n < step; const current = n === step;
                      return (
                        <li key={label} className="flex flex-1 items-center gap-1.5">
                          <button type="button" disabled={!done || saving || !!attemptedDetails.current} onClick={() => setStep(n)} aria-current={current ? "step" : undefined}
                            className={`flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-bold ${done ? "bg-success-subtle text-success-strong" : current ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                            {done ? <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={3} /> : n}
                            <span className={current ? "" : "hidden sm:inline"}>{label}</span>
                          </button>
                          {i < plannedSteps.length - 1 && <span aria-hidden className={`h-0.5 flex-1 rounded-full ${done ? "bg-success/40" : "bg-border"}`} />}
                        </li>
                      );
                    })}
                  </ol>

                  {step === 1 && (<div className="space-y-5">
                    <Field label="When will they be back?" required>
                      <div className="flex flex-wrap gap-2">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="min-w-[180px] flex-1 justify-start gap-2">
                              <CalendarDays aria-hidden className="h-4 w-4" />{expectedReturnDate ? format(expectedReturnDate, "EEE d MMM yyyy") : "Choose a date"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={expectedReturnDate} onSelect={d => d && setExpectedReturnDate(d)} initialFocus className="pointer-events-auto"
                              disabled={date => date < new Date(new Date().setHours(0, 0, 0, 0))} />
                          </PopoverContent>
                        </Popover>
                        <Input type="time" aria-label="Return time" value={expectedReturnTime} onChange={e => setExpectedReturnTime(e.target.value)} className="w-[130px]" />
                      </div>
                      {expectedReturnDate && (() => {
                        const [h, m] = expectedReturnTime.split(":").map(Number);
                        const combined = new Date(expectedReturnDate); combined.setHours(h, m, 0, 0);
                        const diffHours = Math.round((combined.getTime() - Date.now()) / 3600000);
                        return diffHours > 0 ? (
                          <p className="flex items-center gap-1 text-[13px] text-muted-foreground"><Clock aria-hidden className="h-3.5 w-3.5" />
                            About <span className="font-bold text-foreground">{diffHours < 24 ? `${diffHours} hour${diffHours !== 1 ? "s" : ""}` : `${Math.floor(diffHours / 24)} day${Math.floor(diffHours / 24) !== 1 ? "s" : ""}`}</span> from now
                          </p>
                        ) : null;
                      })()}
                    </Field>
                    <Field label="How to reach them while away" hint="Optional">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="space-y-1"><Label htmlFor="leave-mobile">Mobile</Label><Input id="leave-mobile" type="tel" value={mobile} onChange={e => setMobile(e.target.value)} placeholder="Mobile number" /></div>
                        <div className="space-y-1"><Label htmlFor="leave-email">Email</Label><Input id="leave-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" /></div>
                      </div>
                    </Field>
                  </div>)}

                  {step === 2 && (<div className="space-y-5">
                    <Field label="Reason for leave" required>
                      {leaveTypesData.length > 0 && (
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {leaveTypesData.map(lt => (
                            <button key={lt.id} type="button" aria-pressed={checkoutReason === lt.name} onClick={() => { setCheckoutReason(lt.name); setCustomReason(""); }}
                              className={`rounded-xl border p-3 text-left transition-colors ${checkoutReason === lt.name ? "border-primary bg-accent" : "border-input bg-card hover:border-primary/60"}`}>
                              <span className="block text-sm font-bold text-foreground">{lt.name}</span>
                              {lt.description && <span className="block text-[13px] text-muted-foreground">{lt.description}</span>}
                            </button>
                          ))}
                        </div>
                      )}
                      <Input value={customReason} onChange={e => { setCustomReason(e.target.value); setCheckoutReason(""); }}
                        placeholder={leaveTypesData.length > 0 ? "Or type another reason" : "Reason for leave"} aria-label="Other reason" />
                    </Field>
                    <div className="space-y-1.5">
                      <Label htmlFor="leave-comments">Notes <span className="font-normal text-muted-foreground">(optional)</span></Label>
                      <Textarea id="leave-comments" value={comments} onChange={e => setComments(e.target.value)} placeholder="Anything staff should know" className="min-h-[72px] resize-none" />
                    </div>
                  </div>)}

                  {step === 3 && (<div className="space-y-5">
                    <Field label="Who is going with them?" required>
                      <div className="grid grid-cols-2 gap-2">
                        {escortOptions.map(opt => (
                          <button key={opt.value} type="button" aria-pressed={accompaniedBy === opt.value}
                            onClick={() => { setAccompaniedBy(opt.value); if (!opt.showContact && !opt.showStaff) setAccompaniedByName(""); }}
                            className={chip(accompaniedBy === opt.value)}>{opt.label}</button>
                        ))}
                      </div>
                      {selectedEscort?.showContact && mode === "planned" && (
                        <div className="space-y-1 rounded-xl bg-secondary/80 p-3"><Label htmlFor="leave-escort-name">Their name</Label>
                          <Input id="leave-escort-name" value={accompaniedByName} onChange={e => setAccompaniedByName(e.target.value)} placeholder="Full name" /></div>
                      )}
                      {selectedEscort?.showStaff && (
                        <div className="space-y-1 rounded-xl bg-secondary/80 p-3"><Label>Staff member</Label>
                          <Select value={accompaniedByName} onValueChange={setAccompaniedByName}>
                            <SelectTrigger aria-label="Staff member"><SelectValue placeholder="Choose a staff member" /></SelectTrigger>
                            <SelectContent>{staffItems.map(st => <SelectItem key={st.id} value={st.name}>{st.name} — {st.role}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      )}
                      {selectedEscort?.showWarning && (
                        <p className="flex items-start gap-2 rounded-xl bg-warning-subtle px-3 py-2.5 text-[13px] font-semibold text-warning-strong">
                          <ShieldAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />Going on their own: check this resident is assessed for it.
                        </p>
                      )}
                    </Field>
                    {activeCompanionFields.length > 0 && (
                      <div className="space-y-3 border-t border-border pt-4">
                        <div className="flex items-center justify-between gap-2">
                          <p className="flex items-center gap-1.5 text-sm font-bold text-foreground"><Users aria-hidden className="h-4 w-4 text-muted-foreground" />Anyone else going</p>
                          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => {
                            const empty: CompanionDetail = {};
                            activeCompanionFields.forEach(f => { empty[f.field_key.replace("companion_", "")] = ""; });
                            setCompanions(prev => [...prev, empty]);
                          }}><Plus aria-hidden className="h-4 w-4" /> Add person</Button>
                        </div>
                        {companions.map((companion, cIdx) => (
                          <div key={cIdx} className="space-y-2 rounded-xl bg-secondary/80 p-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-bold text-foreground">Person {cIdx + 1}</span>
                              <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive-strong" aria-label={`Remove person ${cIdx + 1}`}
                                onClick={() => setCompanions(prev => prev.filter((_, i) => i !== cIdx))}><Trash2 className="h-4 w-4" /></Button>
                            </div>
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                              {activeCompanionFields.map(f => {
                                const key = f.field_key.replace("companion_", "");
                                return (
                                  <div key={f.id} className="space-y-1"><Label>{f.label}</Label>
                                    <Input value={companion[key] || ""} aria-label={`${f.label}, person ${cIdx + 1}`} onChange={e => setCompanions(prev => prev.map((c, i) => i === cIdx ? { ...c, [key]: e.target.value } : c))} /></div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>)}

                  {step === 4 && (<div className="space-y-4">
                    <dl className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      {[
                        ["Reason", checkoutReason || customReason || "—"],
                        ["Back", expectedReturnDate ? `${format(expectedReturnDate, "EEE d MMM")}, ${expectedReturnTime}` : "—"],
                        ["With", `${escortOptions.find(o => o.value === accompaniedBy)?.label ?? accompaniedBy ?? "—"}${accompaniedByName ? ` (${accompaniedByName})` : ""}`],
                      ].map(([k, v]) => (
                        <div key={k} className="rounded-xl bg-secondary/80 px-3 py-2.5"><dt className="text-xs font-semibold text-muted-foreground">{k}</dt><dd className="text-sm font-bold text-foreground">{v}</dd></div>
                      ))}
                    </dl>
                    <div className="space-y-2">
                      <p className="flex items-center gap-2 text-sm font-bold text-foreground"><ScrollText aria-hidden className="h-4 w-4 text-muted-foreground" />Before you confirm</p>
                      <ol className="list-decimal space-y-1 rounded-xl bg-secondary/80 py-3 pl-8 pr-3 text-[13px] text-secondary-foreground">
                        <li>This departure has been properly authorised.</li>
                        <li>The expected return time has been agreed.</li>
                        <li>This records a movement. It does not confirm where the resident is.</li>
                      </ol>
                    </div>
                    <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 ${privacyAcknowledged ? "border-primary bg-accent" : "border-input bg-card hover:border-primary/60"}`}>
                      <Checkbox checked={privacyAcknowledged} onCheckedChange={c => setPrivacyAcknowledged(c === true)} className="mt-0.5" />
                      <span className="text-sm font-semibold text-foreground">I confirm this leave has been authorised</span>
                    </label>
                    {expectedReturnDate && (
                      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-input bg-card p-3.5 hover:border-primary/60">
                        <Checkbox checked={returnNotificationOptIn} onCheckedChange={c => setReturnNotificationOptIn(c === true)} className="mt-0.5" />
                        <span className="text-sm text-foreground">Remind staff if they are not back by <strong>{format(expectedReturnDate, "EEE d MMM")} at {expectedReturnTime}</strong></span>
                      </label>
                    )}
                  </div>)}
                </>)}

                <div className="border-t border-border pt-3">
                  <TimeOverride value={timeOverride} onChange={setTimeOverride} label="Adjust departure time" />
                </div>
              </div>
            </div>
          )}
        </fieldset>

        {/* ── Footer ── */}
        <div className="shrink-0 border-t border-border bg-card px-4 py-3 sm:px-6">
          {saveError && <p role="alert" className="mb-2 rounded-lg bg-error-subtle px-3 py-2 text-sm font-semibold text-destructive-strong">{saveError}</p>}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <p aria-live="polite" className="min-w-0 flex-1 basis-full text-sm text-muted-foreground sm:basis-0">
              {!residentSelected ? "Choose a resident to continue."
                : mode === "short" ? (shortMissing.length ? <>Still needed: <span className="font-bold text-foreground">{shortMissing.join(" and ")}</span></> : <span className="font-bold text-success-strong">Ready to record</span>)
                : canProceedPlanned() ? <span className="font-bold text-success-strong">{step < 4 ? `Step ${step} of 4 done` : "Ready to confirm"}</span>
                : <>Step {step} of 4 · still needed: <span className="font-bold text-foreground">{plannedNeeds}</span></>}
            </p>
            <div className="ml-auto flex items-center gap-2">
              <Button variant="ghost" onClick={handleClose}>Cancel</Button>
              {residentSelected && mode === "short" && (
                <Button onClick={handleShortSubmit} disabled={saving || blockedBySite || !canSubmitShort} className="gap-2">
                  <DoorOpen aria-hidden className="h-4 w-4" />{saving ? "Saving…" : independent ? "Record absence" : "Record departure"}
                </Button>
              )}
              {residentSelected && mode === "planned" && (<>
                {step > 1 && (
                  <Button variant="outline" disabled={saving || !!attemptedDetails.current} onClick={() => setStep(step - 1)} className="gap-1.5"><ArrowLeft aria-hidden className="h-4 w-4" />Back</Button>
                )}
                {step < 4 ? (
                  <Button onClick={() => setStep(step + 1)} className="gap-1.5" disabled={!canProceedPlanned()}>Next<ArrowRight aria-hidden className="h-4 w-4" /></Button>
                ) : (
                  <Button onClick={handlePlannedSubmit} className="gap-2" disabled={saving || !currentSiteId || openedSite.current !== currentSiteId || !can("checkout.perform") || !privacyAcknowledged}>
                    <Check aria-hidden className="h-4 w-4" />{saving ? "Saving…" : "Confirm leave"}
                  </Button>
                )}
              </>)}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Defined outside the dialog so inputs inside keep focus while typing. */
function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-bold text-foreground">{label}{required && <span aria-hidden className="ml-1 text-destructive">*</span>}</p>
      {hint && <p className="-mt-1 text-[13px] text-muted-foreground">{hint}</p>}
      {children}
    </div>
  );
}
