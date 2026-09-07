import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { KioskInput } from "@/components/kiosk/KioskInput";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useVisitors } from "@/hooks/useVisitors";
import { useToast } from "@/hooks/use-toast";
import { WatchlistAlertDialog } from "@/components/WatchlistAlertDialog";
import { ContractorScreening } from "@/components/ContractorScreening";
import { KioskProgressStepper } from "@/components/kiosk/KioskProgressStepper";
import { FoodFormFields } from "@/components/food/FoodFormFields";
import { insertFoodRecord } from "@/lib/foodRegister";
import { printBadgeAuto } from "@/lib/printBadge";
import { KioskSuccessScreen } from "@/components/kiosk/KioskSuccessScreen";
import { KioskPersonCard } from "@/components/kiosk/KioskPersonCard";
import { useKioskCheckInFlow, KioskStepId } from "@/hooks/useKioskCheckInFlow";
import {
  UserRound, Truck, Heart, ArrowLeft, ArrowRight, Shield, ScrollText,
  AlertTriangle, Search, RotateCcw, UserSearch, QrCode, UserPlus, X, Users
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const TYPES = [
  { type: "visitor" as const, label: "Visitor", icon: UserRound, description: "Family, friend, or guest", iconBg: "bg-primary/15", iconColor: "text-primary" },
  { type: "contractor" as const, label: "Contractor", icon: Truck, description: "Tradesperson or supplier", iconBg: "bg-warning/15", iconColor: "text-warning" },
  { type: "volunteer" as const, label: "Volunteer", icon: Heart, description: "Volunteer or helper", iconBg: "bg-success/15", iconColor: "text-success" },
];

export default function KioskCheckIn() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { addVisitor } = useVisitors({ publicMode: true });
  const flow = useKioskCheckInFlow();

  const [step, setStep] = useState<KioskStepId>("type");
  const [submitted, setSubmitted] = useState(false);
  const [watchlistEntry, setWatchlistEntry] = useState<any>(null);
  const [watchlistMatchType, setWatchlistMatchType] = useState<"confirmed" | "near">("confirmed");
  const [watchlistOpen, setWatchlistOpen] = useState(false);
  const [visitingSearch, setVisitingSearch] = useState("");
  const [visitingMode, setVisitingMode] = useState<"resident" | "staff" | null>(null);
  const [staffFreeText, setStaffFreeText] = useState("");
  const [returningChecked, setReturningChecked] = useState(false);
  const [returningMobile, setReturningMobile] = useState("");
  const [returningCode, setReturningCode] = useState("");
  const [returningBusy, setReturningBusy] = useState(false);
  const [returningNotFound, setReturningNotFound] = useState(false);
  const [returningMatch, setReturningMatch] = useState<any>(null);


  const currentIdx = flow.steps.findIndex((s) => s.id === step);

  // Alert reception once when a kiosk check-in is stopped by health screening
  const alertedRef = useRef(false);
  useEffect(() => {
    if (!flow.screeningBlocked || alertedRef.current) return;
    alertedRef.current = true;
    void supabase.from("audit_log").insert({
      action: "kiosk_health_block",
      performed_by: "Kiosk",
      records_affected: 1,
      details: {
        name: `${flow.formValues.firstName || ""} ${flow.formValues.surname || ""}`.trim() || "Unknown",
        visitor_type: flow.selectedType,
        symptom_flag: flow.hasYesFlags,
        body_temperature: flow.bodyTemperature,
        blocked_at: new Date().toISOString(),
      } as any,
    }).then(({ error }) => {
      if (error) alertedRef.current = false;
    });
  }, [flow.screeningBlocked, flow.hasYesFlags, flow.bodyTemperature, flow.formValues, flow.selectedType]);



  const goNext = () => {
    const nextIdx = currentIdx + 1;
    if (nextIdx < flow.steps.length) setStep(flow.steps[nextIdx].id);
  };
  const goBack = () => {
    const prevIdx = currentIdx - 1;
    if (prevIdx >= 0) setStep(flow.steps[prevIdx].id);
  };

  // Returning visitor auto-fill by name (only when enabled in settings)
  const handleNameBlur = async () => {
    if (!flow.returningOptions.name || returningChecked) return;
    const firstName = flow.formValues.firstName?.trim();
    const surname = flow.formValues.surname?.trim();
    if (!firstName || !surname) return;
    setReturningChecked(true);
    const prev = await flow.lookupReturningVisitor({ firstName, surname });
    if (prev) setReturningMatch(prev);
  };

  // Returning visitor lookup by mobile or personal card code
  const handleReturningLookup = async (params: { mobile?: string; qr?: string }) => {
    setReturningBusy(true);
    setReturningNotFound(false);
    const match = await flow.lookupReturningVisitor(params);
    setReturningBusy(false);
    if (match) {
      setReturningMatch(match);
    } else {
      setReturningNotFound(true);
    }
  };

  const handleReturningConfirm = () => {
    const match = returningMatch;
    if (!match) return;
    flow.setReturningVisitor(match);
    flow.setPersonQr(match.personQr || null);
    flow.setFormValues((fv: Record<string, string>) => ({
      ...fv,
      firstName: fv.firstName || match.firstName,
      surname: fv.surname || match.surname,
      email: fv.email || match.email,
      mobile: fv.mobile || match.mobile,
      address: fv.address || match.address,
    }));
    setReturningMatch(null);
    setReturningChecked(true);
    toast({ title: "Welcome back!", description: "We've pre-filled your details from your last visit." });
  };

  const handleReturningReject = () => {
    setReturningMatch(null);
    setReturningChecked(true);
    setReturningNotFound(false);
  };


  // Filtered residents/staff for visiting step
  const filteredVisiting = useMemo(() => {
    const q = visitingSearch.toLowerCase();
    if (visitingMode === "staff") {
      if (flow.staffLookupMode === "free_text") return [];
      if (!q) return flow.staffLookupMode === "by_department" ? flow.staff : [];
      return flow.staff.filter((s) => s.name.toLowerCase().includes(q) || s.department?.toLowerCase().includes(q));
    }
    if (flow.residentLookupMode === "show_all" && !q) return flow.residents;
    if (flow.residentLookupMode === "search_first" && q.length < 3) return [];
    return flow.residents.filter((r) =>
      r.name.toLowerCase().includes(q) || r.room?.toLowerCase().includes(q)
    );
  }, [visitingSearch, visitingMode, flow.residents, flow.staff, flow.residentLookupMode, flow.staffLookupMode]);

  const [checkedInQrCode, setCheckedInQrCode] = useState<string | null>(null);

  const doCheckIn = useCallback(() => {
    const allHealthClear = Object.values(flow.healthAnswers).every((v) => v === false);
    const groupId = flow.companions.length > 0 ? crypto.randomUUID() : undefined;
    const primaryQr = crypto.randomUUID().slice(0, 12).toUpperCase();
    // Permanent per-person card code — reused when a returning visitor is recognised
    const personQr = flow.personQr || primaryQr;


    // Add primary visitor
    addVisitor({
      firstName: flow.formValues.firstName || "",
      surname: flow.formValues.surname || "",
      email: flow.formValues.email || "",
      mobile: flow.formValues.mobile || "",
      type: flow.selectedType,
      checkInTime: new Date(),
      checkOutTime: null,
      whomToVisit: flow.formValues.whomToVisit || "",
      address: flow.formValues.address || "",
      status: "checked-in",
      healthDeclaration: allHealthClear,
      healthAnswers: { ...flow.healthAnswers, ...flow.contractorAnswers },
      additionalVisitors: flow.companions.length,
      comments: flow.formValues.comments || "",
      retentionExpiry: new Date(Date.now() + 86400000 * 60),
      acknowledgedPrivacy: flow.privacyAcknowledged,
      bodyTemperature: flow.bodyTemperature ?? undefined,
      contractorScreening: flow.selectedType === "contractor" ? flow.contractorAnswers : undefined,
      supplierId: flow.selectedSupplier?.id || undefined,
      qrCode: primaryQr,
      personQr,
      groupId,

    });

    // Add companion visitors as independent records
    flow.companions.forEach((comp) => {
      const compQr = crypto.randomUUID().slice(0, 12).toUpperCase();
      addVisitor({
        firstName: comp.firstName,
        surname: comp.surname,
        email: comp.email || "",
        mobile: comp.mobile || "",
        type: flow.selectedType,
        checkInTime: new Date(),
        checkOutTime: null,
        whomToVisit: flow.formValues.whomToVisit || "",
        address: "",
        status: "checked-in",
        healthDeclaration: allHealthClear,
        additionalVisitors: 0,
        comments: `Companion of ${flow.formValues.firstName} ${flow.formValues.surname}`,
        retentionExpiry: new Date(Date.now() + 86400000 * 60),
        acknowledgedPrivacy: flow.privacyAcknowledged,
        qrCode: compQr,
        groupId,
      });
    });

    // Food register entry (linked to the resident's real record id)
    if (flow.bringingFood && flow.visitedResidentId) {
      insertFoodRecord({
        residentVisitorId: flow.visitedResidentId,
        residentName: flow.formValues.whomToVisit || "",
        broughtByName: `${flow.formValues.firstName || ""} ${flow.formValues.surname || ""}`.trim(),
        foodDescription: flow.foodForm.foodDescription.trim(),
        foodType: flow.foodForm.foodType,
        sharedWithOthers: flow.foodForm.sharedWithOthers,
        sharedResidentIds: flow.foodForm.sharedResidentIds,
        sharedResidentNames: flow.foodForm.sharedResidentIds
          .map((id) => flow.residents.find((r) => r.visitorId === id)?.name)
          .filter(Boolean) as string[],
        notes: flow.foodForm.notes.trim() || null,
        source: "check_in",
        createdBy: "Kiosk",
      }).then(() => undefined);
    }

    setCheckedInQrCode(primaryQr);
    setSubmitted(true);
    toast({ title: "Checked In", description: `Welcome, ${flow.formValues.firstName}!${flow.companions.length > 0 ? ` (+${flow.companions.length} companion${flow.companions.length > 1 ? "s" : ""})` : ""}` });
  }, [flow, addVisitor, toast]);

  const handleSubmit = () => {
    if (flow.screeningBlocked) {
      toast({
        title: "Please see a staff member",
        description: "Your health screening answers need to be reviewed before you can check in.",
        variant: "destructive",
      });
      return;
    }
    const match = flow.checkVisitor(flow.formValues.firstName || "", flow.formValues.surname || "");
    if (match) {
      setWatchlistEntry(match.entry);
      setWatchlistMatchType(match.matchType);
      setWatchlistOpen(true);
      // Unconfirmed (name-only) matches and hard blocks always pause for staff
      if (match.matchType === "near" || match.entry.alert_type === "hard") return;
    }
    doCheckIn();
  };


  const handleComplete = useCallback(() => navigate("/kiosk/home"), [navigate]);
  const handleStartOver = () => {
    flow.reset();
    setStep("type");
    setSubmitted(false);
    setReturningChecked(false);
    setReturningMatch(null);
    setReturningMobile("");
    setReturningCode("");
    setReturningNotFound(false);

    setVisitingSearch("");
    setVisitingMode(null);
    setCheckedInQrCode(null);
    alertedRef.current = false;
  };

  if (submitted) {
    return (
      <KioskSuccessScreen
        title={`Welcome, ${flow.formValues.firstName}!`}
        subtitle="You have been checked in successfully."
        accentColor="primary"
        onComplete={handleComplete}
        qrCode={checkedInQrCode || undefined}
        companionCount={flow.companions.length}
        extraAction={
          flow.badgePrintingEnabled ? (
            <Button
              variant="secondary"
              size="sm"
              className="gap-2 border border-border text-sm"
              onClick={() =>
                printBadgeAuto({
                  name: `${flow.formValues.firstName || ""} ${flow.formValues.surname || ""}`.trim(),
                  type: flow.selectedType,
                  visiting: flow.formValues.whomToVisit || undefined,
                })
              }
            >
              Print Badge
            </Button>
          ) : undefined
        }
      />
    );
  }

  const anim = { initial: { opacity: 0, x: 40 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -40 }, transition: { duration: 0.25 } };

  return (
    <div className="w-full space-y-6">
      <KioskProgressStepper steps={flow.steps} currentIndex={currentIdx} accentColor="primary" />

      <AnimatePresence mode="wait">
        {/* Step: Type Selection */}
        {step === "type" && (
          <motion.div key="type" {...anim} className="space-y-5">
            <h2 className="text-2xl font-bold text-foreground text-center">What brings you here today?</h2>
            <div className="grid grid-cols-3 gap-4">
              {TYPES.map((t) => (
                <button
                  key={t.type}
                  onClick={() => { flow.setSelectedType(t.type); goNext(); }}
                  className={`flex flex-col items-center gap-4 p-6 rounded-2xl border-2 transition-all duration-150 min-h-[180px] active:scale-[0.96] group
                    ${flow.selectedType === t.type ? "border-primary bg-primary/10 shadow-md" : "border-border bg-card/80 shadow-sm active:border-primary/50"}`}
                >
                  <div className={`h-16 w-16 rounded-2xl flex items-center justify-center ${t.iconBg} transition-colors`}>
                    <t.icon className={`h-8 w-8 ${t.iconColor}`} strokeWidth={2.25} />
                  </div>
                  <div className="text-center">
                    <span className="text-lg font-bold block text-foreground">{t.label}</span>
                    <span className="text-sm text-muted-foreground mt-1 block">{t.description}</span>
                  </div>
                </button>
              ))}
            </div>
            <div className="text-center pt-2">
              <Button variant="secondary" onClick={() => navigate("/kiosk/qr-scan?mode=checkin")} className="h-12 gap-2 text-base border border-border">
                <QrCode className="h-5 w-5" /> I have a QR code / visitor card
              </Button>
            </div>
          </motion.div>
        )}

        {/* Step: Details */}
        {step === "details" && (
          <motion.div key="details" {...anim} className="space-y-4">
            <h2 className="text-2xl font-bold text-foreground text-center">Your Details</h2>

            {/* Returning visitor fast lane */}
            {!flow.returningVisitor && (flow.returningOptions.mobile || flow.returningOptions.qr) && !returningMatch && (
              <div className="rounded-2xl border-2 border-border bg-card/80 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <RotateCcw className="h-5 w-5 text-primary" />
                  <p className="text-base font-bold text-foreground">Been here before?</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  We'll fill in your details so you don't have to type them again.
                </p>
                {flow.returningOptions.mobile && (
                  <div className="flex gap-2">
                    <Input
                      value={returningMobile}
                      onChange={(e) => setReturningMobile(e.target.value)}
                      placeholder="Your mobile number"
                      inputMode="tel"
                      type="tel"
                      className="h-14 text-lg flex-1"
                    />
                    <Button onClick={() => void handleReturningLookup({ mobile: returningMobile })} disabled={returningBusy} className="h-14 px-5 text-base">
                      Find me
                    </Button>
                  </div>
                )}
                {flow.returningOptions.qr && (
                  <div className="flex gap-2">
                    <Input
                      value={returningCode}
                      onChange={(e) => setReturningCode(e.target.value.toUpperCase())}
                      placeholder="Visitor card code"
                      className="h-14 text-lg flex-1 tracking-widest"
                    />
                    <Button variant="secondary" onClick={() => void handleReturningLookup({ qr: returningCode })} disabled={returningBusy} className="h-14 px-5 text-base border border-border">
                      <QrCode className="h-5 w-5" />
                    </Button>
                  </div>
                )}
                {returningNotFound && (
                  <p className="text-sm text-muted-foreground">
                    We couldn't find you — no problem, just fill in your details below.
                  </p>
                )}
              </div>
            )}

            {/* Match confirmation */}
            {returningMatch && (
              <div className="rounded-2xl border-2 border-success/30 bg-success/5 p-4 space-y-3">
                <p className="text-base font-bold text-foreground">Is this you?</p>
                <div className="space-y-1 text-sm">
                  <p className="text-lg font-bold text-foreground">{returningMatch.firstName} {returningMatch.surname}</p>
                  {returningMatch.mobile && <p className="text-muted-foreground">{returningMatch.mobile}</p>}
                  {returningMatch.email && <p className="text-muted-foreground">{returningMatch.email}</p>}
                  {returningMatch.whomToVisit && <p className="text-muted-foreground">Last visited {returningMatch.whomToVisit}</p>}
                </div>
                <div className="flex gap-3">
                  <Button variant="secondary" onClick={handleReturningReject} className="flex-1 h-12 text-base border border-border">
                    Not me
                  </Button>
                  <Button onClick={handleReturningConfirm} className="flex-1 h-12 text-base">
                    That's me
                  </Button>
                </div>
              </div>
            )}

            {flow.returningVisitor && (
              <div className="rounded-xl border-2 border-success/20 bg-success/5 p-3 flex items-center gap-2 text-sm text-success">
                <UserSearch className="h-4 w-4 shrink-0" />
                <span className="font-medium">Welcome back! Details pre-filled from your last visit.</span>
              </div>
            )}


            <div className="grid grid-cols-2 gap-3">
              <KioskInput
                label="First Name"
                required
                value={flow.formValues.firstName || ""}
                onChange={(e) => flow.updateField("firstName", e.target.value)}
                onBlur={handleNameBlur}
                autoFocus
              />
              <KioskInput
                label="Surname"
                required
                value={flow.formValues.surname || ""}
                onChange={(e) => flow.updateField("surname", e.target.value)}
                onBlur={handleNameBlur}
              />
            </div>

            {flow.activeFormFields.map((field) => {
              if (field.field_key === "firstName" || field.field_key === "surname") return null;
              return (
                <div key={field.id}>
                  {field.field_type === "textarea" ? (
                    <Textarea
                      placeholder={`${field.label}${field.required ? " *" : ""}`}
                      value={flow.formValues[field.field_key] || ""}
                      onChange={(e) => flow.updateField(field.field_key, e.target.value)}
                      className="min-h-[80px] text-base rounded-xl resize-none"
                    />
                  ) : field.field_type === "select" ? (
                    <Select
                      value={flow.formValues[field.field_key] || ""}
                      onValueChange={(val) => flow.updateField(field.field_key, val)}
                    >
                      <SelectTrigger className="h-14 text-base">
                        <SelectValue placeholder={`${field.label}${field.required ? " *" : ""}`} />
                      </SelectTrigger>
                      <SelectContent>
                        {/* Dynamic options would come from field config; fallback to text input */}
                        <SelectItem value="__none" disabled>No options configured</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <KioskInput
                      label={field.label}
                      required={field.required}
                      value={flow.formValues[field.field_key] || ""}
                      onChange={(e) => flow.updateField(field.field_key, e.target.value)}
                      type={field.field_type === "email" ? "email" : field.field_type === "tel" ? "tel" : "text"}
                      inputMode={field.field_type === "email" ? "email" : field.field_type === "tel" ? "tel" : undefined}
                    />
                  )}
                </div>
              );
            })}

            {flow.activeFormFields.length === 0 && (
              <>
                <KioskInput label="Email" value={flow.formValues.email || ""} onChange={(e) => flow.updateField("email", e.target.value)} inputMode="email" type="email" />
                <KioskInput label="Mobile" value={flow.formValues.mobile || ""} onChange={(e) => flow.updateField("mobile", e.target.value)} inputMode="tel" type="tel" />
              </>
            )}

            <div className="flex gap-3 pt-2">
              <Button variant="secondary" onClick={goBack} className="flex-1 h-14 text-base gap-2 border border-border">
                <ArrowLeft className="h-5 w-5" /> Back
              </Button>
              <Button onClick={goNext} disabled={!flow.formValues.firstName?.trim() || !flow.formValues.surname?.trim()} className="flex-1 h-14 text-base gap-2">
                Next <ArrowRight className="h-5 w-5" />
              </Button>
            </div>
          </motion.div>
        )}

        {/* Step: Who are you visiting */}
        {step === "visiting" && (
          <motion.div key="visiting" {...anim} className="space-y-4">
            <h2 className="text-2xl font-bold text-foreground text-center">Who Are You Visiting?</h2>

            {/* One-tap shortcut for regulars */}
            {flow.returningOptions.suggestResident && flow.returningVisitor?.whomToVisit && !flow.formValues.whomToVisit && (
              <button
                onClick={() => {
                  const suggestion = flow.returningVisitor.whomToVisit;
                  const residentId =
                    flow.returningVisitor.lastResidentId ||
                    flow.residents.find((r) => r.name === suggestion)?.visitorId ||
                    null;
                  flow.updateField("whomToVisit", suggestion);
                  flow.setVisitedResidentId(residentId);
                  if (residentId && (flow.selectedType === "visitor" || flow.selectedType === "volunteer")) {
                    setStep("food");
                  } else {
                    goNext();
                  }
                }}
                className="w-full rounded-2xl border-2 border-primary/40 bg-primary/5 p-4 text-left active:scale-[0.98] transition-all"
              >
                <p className="text-sm text-muted-foreground">Same as last time?</p>
                <p className="text-lg font-bold text-foreground">Here to see {flow.returningVisitor.whomToVisit}</p>
                <p className="text-sm text-primary font-semibold mt-1">Tap to continue</p>
              </button>
            )}



            <div className="flex gap-3 justify-center">
              <button
                onClick={() => { setVisitingMode("resident"); setVisitingSearch(""); }}
                className={`px-6 py-3 rounded-xl text-base font-semibold transition-all min-h-[48px] active:scale-[0.97] ${
                  visitingMode === "resident" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground border border-border"
                }`}
              >
                Resident
              </button>
              <button
                onClick={() => { setVisitingMode("staff"); setVisitingSearch(""); }}
                className={`px-6 py-3 rounded-xl text-base font-semibold transition-all min-h-[48px] active:scale-[0.97] ${
                  visitingMode === "staff" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground border border-border"
                }`}
              >
                Staff Member
              </button>
            </div>

            {visitingMode && (
              <>
                {visitingMode === "staff" && flow.staffLookupMode === "free_text" ? (
                  <div className="space-y-3">
                    <Input
                      value={staffFreeText}
                      onChange={(e) => setStaffFreeText(e.target.value)}
                      placeholder="Type the name of the person you're visiting..."
                      className="h-14 text-lg"
                      autoFocus
                    />
                    {staffFreeText.trim() && (
                      <Button
                        className="w-full h-14 text-base"
                        onClick={() => {
                          flow.updateField("whomToVisit", staffFreeText.trim());
                          flow.setVisitedResidentId(null);
                          goNext();
                        }}
                      >
                        Continue with "{staffFreeText.trim()}"
                      </Button>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <Input
                        value={visitingSearch}
                        onChange={(e) => setVisitingSearch(e.target.value)}
                        placeholder={
                          visitingMode === "resident"
                            ? flow.residentLookupMode === "search_first"
                              ? "Type at least 3 characters (name or room)..."
                              : "Search by name or room..."
                            : "Search by name or department..."
                        }
                        className="pl-12 h-14 text-lg"
                        autoFocus
                      />
                    </div>

                    {visitingMode === "resident" && flow.residentLookupMode === "search_first" && visitingSearch.length > 0 && visitingSearch.length < 3 && (
                      <p className="text-center text-sm text-muted-foreground">Type at least 3 characters to search</p>
                    )}

                    {visitingMode === "staff" && flow.staffLookupMode === "by_department" && !visitingSearch ? (
                      <div className="space-y-4 max-h-[40vh] overflow-y-auto">
                        {Object.entries(
                          flow.staff.reduce((acc: Record<string, typeof flow.staff>, s) => {
                            const dept = s.department || "Other";
                            if (!acc[dept]) acc[dept] = [];
                            acc[dept].push(s);
                            return acc;
                          }, {})
                        ).sort(([a], [b]) => a.localeCompare(b)).map(([dept, members]) => (
                          <div key={dept}>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 px-1">{dept}</p>
                            <div className="space-y-1">
                              {members.map((person: any) => (
                                <KioskPersonCard
                                  key={person.id}
                                  name={person.name}
                                  subtitle={person.role}
                                  accentColor="primary"
                                  onClick={() => {
                                    flow.updateField("whomToVisit", person.name);
                                    flow.setVisitedResidentId(null);
                                    goNext();
                                  }}
                                />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                        {filteredVisiting.length === 0 ? (
                          <p className="text-center py-8 text-muted-foreground">
                            {visitingMode === "resident" && flow.residentLookupMode === "search_first" && visitingSearch.length < 3
                              ? "Start typing to search for a resident"
                              : `No ${visitingMode}s found`}
                          </p>
                        ) : (
                          filteredVisiting.map((person: any) => (
                            <KioskPersonCard
                              key={person.id}
                              name={person.name}
                              subtitle={
                                visitingMode === "resident"
                                  ? `${person.room || "—"} ${person.wing ? `• ${person.wing}` : ""}`
                                  : `${person.role} ${person.department ? `• ${person.department}` : ""}`
                              }
                              accentColor="primary"
                              onClick={() => {
                                const isResident = visitingMode === "resident";
                                const residentId = isResident ? person.visitorId || person.id : null;
                                flow.updateField("whomToVisit", person.name);
                                flow.setVisitedResidentId(residentId);
                                // Selecting a resident inserts the Food step next, so navigate explicitly
                                if (residentId && (flow.selectedType === "visitor" || flow.selectedType === "volunteer")) {
                                  setStep("food");
                                } else {
                                  goNext();
                                }
                              }}
                            />
                          ))
                        )}
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            {flow.formValues.whomToVisit && (
              <div className="rounded-xl border-2 border-success/20 bg-success/5 p-3 text-center text-sm text-success font-medium">
                Visiting: {flow.formValues.whomToVisit}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button variant="secondary" onClick={goBack} className="flex-1 h-14 text-base gap-2 border border-border">
                <ArrowLeft className="h-5 w-5" /> Back
              </Button>
              <Button variant="secondary" onClick={goNext} className="flex-1 h-14 text-base gap-2 border border-border">
                Skip <ArrowRight className="h-5 w-5" />
              </Button>
            </div>
          </motion.div>
        )}

        {/* Step: Food Register */}
        {step === "food" && (
          <motion.div key="food" {...anim} className="space-y-5">
            <div className="text-center space-y-1">
              <h2 className="text-2xl font-bold text-foreground">Are you bringing food in?</h2>
              <p className="text-base text-muted-foreground">
                For {flow.formValues.whomToVisit || "the resident"} — we keep a simple record of food brought into the home.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[true, false].map((val) => (
                <button
                  key={String(val)}
                  onClick={() => flow.setBringingFood(val)}
                  className={`h-20 rounded-2xl border-2 text-lg font-bold transition-all active:scale-[0.97] ${
                    flow.bringingFood === val
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card/80 text-foreground"
                  }`}
                >
                  {val ? "Yes" : "No"}
                </button>
              ))}
            </div>

            {flow.bringingFood && (
              <div className="rounded-2xl border-2 border-border bg-card p-5">
                <FoodFormFields
                  state={flow.foodForm}
                  onChange={flow.setFoodForm}
                  residents={flow.residents.map((r) => ({ id: r.visitorId, name: r.name, room: r.room }))}
                  primaryResidentId={flow.visitedResidentId}
                  size="kiosk"
                />
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button variant="secondary" onClick={goBack} className="flex-1 h-14 text-base gap-2 border border-border">
                <ArrowLeft className="h-5 w-5" /> Back
              </Button>
              <Button onClick={goNext} disabled={!flow.foodStepValid} className="flex-1 h-14 text-base gap-2">
                Next <ArrowRight className="h-5 w-5" />
              </Button>
            </div>
          </motion.div>
        )}

        {/* Step: Companions */}
        {step === "companions" && (
          <motion.div key="companions" {...anim} className="space-y-4">
            <h2 className="text-2xl font-bold text-foreground text-center">Anyone Accompanying You?</h2>
            <p className="text-base text-muted-foreground text-center">Are there additional visitors in your group?</p>

            {/* Answer stays visible and changeable */}
            <div className="flex gap-4 justify-center pt-2">
              <button
                onClick={() => {
                  flow.setHasCompanions(true);
                  if (flow.companions.length === 0) {
                    flow.setCompanions([{ id: crypto.randomUUID(), firstName: "", surname: "", email: "", mobile: "" }]);
                  }
                }}
                className={`flex flex-col items-center gap-3 p-6 rounded-2xl border-2 shadow-sm active:scale-[0.96] transition-all min-w-[140px] ${
                  flow.hasCompanions === true ? "border-primary bg-primary/10" : "border-border bg-card/80"
                }`}
              >
                <div className="h-14 w-14 rounded-2xl bg-primary/15 flex items-center justify-center">
                  <Users className="h-7 w-7 text-primary" />
                </div>
                <span className="text-lg font-bold text-foreground">Yes</span>
              </button>
              <button
                onClick={() => {
                  flow.setHasCompanions(false);
                  flow.setCompanions([]);
                }}
                className={`flex flex-col items-center gap-3 p-6 rounded-2xl border-2 shadow-sm active:scale-[0.96] transition-all min-w-[140px] ${
                  flow.hasCompanions === false ? "border-primary bg-primary/10" : "border-border bg-card/80"
                }`}
              >
                <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center">
                  <UserRound className="h-7 w-7 text-muted-foreground" />
                </div>
                <span className="text-lg font-bold text-foreground">No, just me</span>
              </button>
            </div>


            {flow.hasCompanions && (
              <div className="space-y-3">
                {flow.companions.map((comp, idx) => (
                  <div key={comp.id} className="rounded-2xl border-2 border-border bg-card p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-muted-foreground">Companion {idx + 1}</span>
                      <button
                        onClick={() => flow.setCompanions((prev) => prev.filter((c) => c.id !== comp.id))}
                        className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <KioskInput
                        label="First Name"
                        required
                        value={comp.firstName}
                        onChange={(e) => flow.setCompanions((prev) =>
                          prev.map((c) => c.id === comp.id ? { ...c, firstName: e.target.value } : c)
                        )}
                      />
                      <KioskInput
                        label="Surname"
                        required
                        value={comp.surname}
                        onChange={(e) => flow.setCompanions((prev) =>
                          prev.map((c) => c.id === comp.id ? { ...c, surname: e.target.value } : c)
                        )}
                      />
                    </div>
                    <KioskInput
                      label="Email"
                      value={comp.email}
                      onChange={(e) => flow.setCompanions((prev) =>
                        prev.map((c) => c.id === comp.id ? { ...c, email: e.target.value } : c)
                      )}
                      type="email"
                      inputMode="email"
                    />
                    <KioskInput
                      label="Mobile"
                      value={comp.mobile}
                      onChange={(e) => flow.setCompanions((prev) =>
                        prev.map((c) => c.id === comp.id ? { ...c, mobile: e.target.value } : c)
                      )}
                      type="tel"
                      inputMode="tel"
                    />
                  </div>
                ))}
                <Button
                  variant="secondary"
                  onClick={() => flow.setCompanions((prev) => [
                    ...prev,
                    { id: crypto.randomUUID(), firstName: "", surname: "", email: "", mobile: "" }
                  ])}
                  className="w-full h-12 text-base gap-2 border border-border"
                >
                  <UserPlus className="h-5 w-5" /> Add Companion
                </Button>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button variant="secondary" onClick={goBack} className="flex-1 h-14 text-base gap-2 border border-border">
                <ArrowLeft className="h-5 w-5" /> Back
              </Button>
              <Button
                onClick={goNext}
                disabled={
                  flow.hasCompanions === null ||
                  (flow.hasCompanions === true &&
                    (flow.companions.length === 0 ||
                      flow.companions.some((c) => !c.firstName.trim() || !c.surname.trim())))
                }
                className="flex-1 h-14 text-base gap-2"
              >
                Next <ArrowRight className="h-5 w-5" />
              </Button>
            </div>

          </motion.div>
        )}


        {step === "contractor" && (
          <motion.div key="contractor" {...anim} className="space-y-4">
            <h2 className="text-2xl font-bold text-foreground text-center">Contractor Screening</h2>
            <div className="max-h-[55vh] overflow-y-auto pr-1">
              <ContractorScreening
                jurisdiction={flow.jurisdiction}
                answers={flow.contractorAnswers}
                onAnswersChange={flow.setContractorAnswers}
                selectedSupplier={flow.selectedSupplier}
                onSupplierChange={flow.setSelectedSupplier}
                compact={false}
                onBlockedChange={(blocked, reason) => flow.setContractorGate({ blocked, reason })}
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="secondary" onClick={goBack} className="flex-1 h-14 text-base gap-2 border border-border">
                <ArrowLeft className="h-5 w-5" /> Back
              </Button>
              <Button onClick={goNext} disabled={flow.contractorBlocked} className="flex-1 h-14 text-base gap-2">
                Next <ArrowRight className="h-5 w-5" />
              </Button>
            </div>
          </motion.div>
        )}

        {/* Step: Health Screening */}
        {step === "screening" && (
          <motion.div key="screening" {...anim} className="space-y-4">
            <div className="text-center space-y-1">
              <h2 className="text-2xl font-bold text-foreground">Health Screening</h2>
              <p className="text-sm text-muted-foreground">
                {Object.keys(flow.healthAnswers).length} of {flow.healthQuestions.length} answered
              </p>
            </div>
            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1 kiosk-scroll-fade">
              {flow.healthQuestions.map((q, idx) => {
                const answer = flow.healthAnswers[q.id];
                const isYesNo = q.type === "yesno";
                const hasYes = isYesNo && answer === true;
                const hasNo = isYesNo && answer === false;
                return (
                  <div key={q.id} className={`rounded-2xl border-2 p-5 transition-all ${
                    hasNo ? "border-success/30 bg-success/5" : hasYes ? "border-destructive/30 bg-destructive/5" : "border-border bg-card"
                  }`}>
                    <div className="flex items-start gap-3 mb-3">
                      <span className={`text-sm font-bold shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${
                        hasNo ? "bg-success text-success-foreground" : hasYes ? "bg-destructive text-destructive-foreground" : "bg-muted text-muted-foreground"
                      }`}>{hasNo ? "✓" : hasYes ? "✗" : idx + 1}</span>
                      <p className="text-base text-foreground font-medium leading-relaxed">
                        {q.question}{q.required && <span className="text-destructive ml-0.5">*</span>}
                      </p>
                    </div>
                    <div className="ml-11">
                      {q.type === "yesno" && (
                        <div className="flex gap-3">
                          <button onClick={() => flow.setHealthAnswers((prev: Record<string, any>) => ({ ...prev, [q.id]: false }))}
                            className={`flex-1 py-4 rounded-xl text-base font-bold transition-all flex items-center justify-center gap-2 min-h-[52px] ${answer === false ? "bg-success text-success-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-success/20"}`}>
                            ✓ No
                          </button>
                          <button onClick={() => flow.setHealthAnswers((prev: Record<string, any>) => ({ ...prev, [q.id]: true }))}
                            className={`flex-1 py-4 rounded-xl text-base font-bold transition-all flex items-center justify-center gap-2 min-h-[52px] ${answer === true ? "bg-destructive text-destructive-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-destructive/20"}`}>
                            ✗ Yes
                          </button>
                        </div>
                      )}
                      {q.type === "text" && (
                        <Input value={answer || ""} onChange={(e) => flow.setHealthAnswers((prev: Record<string, any>) => ({ ...prev, [q.id]: e.target.value }))}
                          placeholder={q.placeholder || "Enter response..."} className="h-14 text-lg rounded-xl" />
                      )}
                      {q.type === "textarea" && (
                        <Textarea value={answer || ""} onChange={(e) => flow.setHealthAnswers((prev: Record<string, any>) => ({ ...prev, [q.id]: e.target.value }))}
                          placeholder={q.placeholder || "Enter details..."} className="min-h-[80px] text-base rounded-xl resize-none" />
                      )}
                      {q.type === "select" && q.options && (
                        <Select value={answer || ""} onValueChange={(val) => flow.setHealthAnswers((prev: Record<string, any>) => ({ ...prev, [q.id]: val }))}>
                          <SelectTrigger className="h-14 text-base rounded-xl"><SelectValue placeholder="Select..." /></SelectTrigger>
                          <SelectContent>{(q.options as string[]).map((opt) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent>
                        </Select>
                      )}
                      {q.type === "checkbox" && (
                        <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 cursor-pointer"
                          onClick={() => flow.setHealthAnswers((prev: Record<string, any>) => ({ ...prev, [q.id]: !prev[q.id] }))}>
                          <Checkbox checked={!!answer} className="h-6 w-6" />
                          <span className="text-base text-foreground font-medium">Yes, I confirm</span>
                        </div>
                      )}
                      {hasYes && (
                        <div className="mt-3 rounded-xl bg-destructive/10 border border-destructive/20 p-3 flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                          <p className="text-sm text-destructive font-medium">This may require staff review.</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {flow.vaccinationFields.length > 0 && (
                <div className="pt-3 mt-2 border-t border-border space-y-3">
                  <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Vaccination Records</p>
                  {flow.vaccinationFields.map((vf) => (
                    <div key={vf.id} className="rounded-2xl border-2 border-border bg-card p-5">
                      <label className="text-base text-foreground font-medium block mb-2">
                        {vf.label}{vf.required && <span className="text-destructive ml-0.5">*</span>}
                      </label>
                      <Input
                        type={vf.field_type === "date" ? "date" : "text"}
                        value={flow.healthAnswers[`vacc_${vf.name}`] || ""}
                        onChange={(e) => flow.setHealthAnswers((prev: Record<string, any>) => ({ ...prev, [`vacc_${vf.name}`]: e.target.value }))}
                        className="h-14 text-lg rounded-xl"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {!flow.screeningBlocked && flow.screeningFlagged && (
              <div className="rounded-2xl bg-warning/10 border-2 border-warning/30 p-5 flex items-start gap-3">
                <AlertTriangle className="h-6 w-6 text-warning shrink-0 mt-0.5" />
                <div>
                  <p className="text-lg font-bold text-warning">Please speak to reception</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Your answers have been flagged for staff review. You can continue, and a staff member will check in with you.
                  </p>
                </div>
              </div>
            )}

            {flow.screeningBlocked && (
              <div className="rounded-2xl bg-destructive/10 border-2 border-destructive/30 p-5 flex items-start gap-3">
                <AlertTriangle className="h-6 w-6 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="text-lg font-bold text-destructive">Please see a staff member</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {flow.highTemperature
                      ? `Your recorded temperature (${flow.bodyTemperature}°C) is above the safe limit. `
                      : ""}
                    We cannot complete your check-in at this screen. Reception has been notified and will assist you.
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button variant="secondary" onClick={goBack} className="flex-1 h-14 text-base gap-2 border border-border">
                <ArrowLeft className="h-5 w-5" /> Back
              </Button>
              <Button onClick={goNext} disabled={flow.screeningBlocked} className="flex-1 h-14 text-base gap-2">
                Next <ArrowRight className="h-5 w-5" />
              </Button>
            </div>

          </motion.div>
        )}

        {/* Step: Terms & Conditions */}
        {step === "terms" && flow.tcContent && (
          <motion.div key="terms" {...anim} className="space-y-4">
            <div className="text-center space-y-1">
              <h2 className="text-2xl font-bold text-foreground">Terms & Conditions</h2>
              <p className="text-base text-muted-foreground">Please read and accept before continuing</p>
            </div>
            <div className="rounded-2xl border-2 border-border bg-card p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <ScrollText className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-lg font-bold text-foreground">Terms & Privacy</h3>
              </div>
              <div className="max-h-[30vh] overflow-y-auto rounded-xl bg-muted/30 p-5 text-sm text-muted-foreground leading-relaxed border border-border whitespace-pre-line">
                {flow.tcContent}
              </div>
              <div
                className={`flex items-center gap-4 p-5 rounded-xl cursor-pointer transition-all active:scale-[0.98] ${
                  flow.privacyAcknowledged ? "bg-success/5 border-2 border-success/30" : "bg-secondary/50 border-2 border-border"
                }`}
                onClick={() => flow.setPrivacyAcknowledged(!flow.privacyAcknowledged)}
                role="button"
                tabIndex={0}
                aria-pressed={flow.privacyAcknowledged}
              >
                <Checkbox checked={flow.privacyAcknowledged} className="h-7 w-7" onCheckedChange={(c) => flow.setPrivacyAcknowledged(c === true)} />
                <span className="text-base text-foreground font-medium">
                  I accept the <strong>Terms & Conditions</strong> and acknowledge the <strong>Privacy Notice</strong>
                </span>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="secondary" onClick={goBack} className="flex-1 h-14 text-base gap-2 border border-border">
                <ArrowLeft className="h-5 w-5" /> Back
              </Button>
              <Button onClick={goNext} disabled={!flow.privacyAcknowledged} className="flex-1 h-14 text-base gap-2">
                Next <ArrowRight className="h-5 w-5" />
              </Button>
            </div>
          </motion.div>
        )}

        {/* Step: Review & Confirm */}
        {step === "confirm" && (
          <motion.div key="confirm" {...anim} className="space-y-4">
            <h2 className="text-2xl font-bold text-foreground text-center">Review & Confirm</h2>

            {/* Personal Details Section */}
            <div className="rounded-2xl border border-border bg-card p-5 space-y-2.5 text-sm">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5"><UserRound className="h-3.5 w-3.5" /> Personal</p>
              <div className="flex justify-between"><span className="text-muted-foreground">Name</span><span className="font-medium text-foreground">{flow.formValues.firstName} {flow.formValues.surname}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span className="font-medium text-foreground capitalize">{flow.selectedType}</span></div>
              {flow.formValues.email && <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span className="font-medium text-foreground">{flow.formValues.email}</span></div>}
              {flow.formValues.mobile && <div className="flex justify-between"><span className="text-muted-foreground">Mobile</span><span className="font-medium text-foreground">{flow.formValues.mobile}</span></div>}
            </div>

            {/* Visit Details Section */}
            {(flow.formValues.whomToVisit || flow.companions.length > 0 || (flow.selectedType === "contractor" && flow.selectedSupplier)) && (
              <div className="rounded-2xl border border-border bg-card p-5 space-y-2.5 text-sm">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5"><Heart className="h-3.5 w-3.5" /> Visit</p>
                {flow.formValues.whomToVisit && <div className="flex justify-between"><span className="text-muted-foreground">Visiting</span><span className="font-medium text-foreground">{flow.formValues.whomToVisit}</span></div>}
                {flow.selectedType === "contractor" && flow.selectedSupplier && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Supplier</span><span className="font-medium text-foreground">{flow.selectedSupplier.name}</span></div>
                )}
                {flow.companions.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-muted-foreground flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> Companions</span>
                      <span className="font-bold text-xs px-2 py-0.5 rounded-md bg-primary/10 text-primary">{flow.companions.length}</span>
                    </div>
                    {flow.companions.map((c) => (
                      <p key={c.id} className="text-sm text-foreground ml-5">{c.firstName} {c.surname}</p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Compliance Section */}
            {(flow.healthQuestions.length > 0 || flow.tcContent) && (
              <div className="rounded-2xl border border-border bg-card p-5 space-y-2.5 text-sm">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5"><Shield className="h-3.5 w-3.5" /> Compliance</p>
                {flow.healthQuestions.length > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Screening</span>
                    <span className={`font-bold text-xs px-2 py-0.5 rounded-md ${flow.hasYesFlags ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"}`}>
                      {flow.hasYesFlags ? "⚠ Flagged" : "✓ Clear"}
                    </span>
                  </div>
                )}
                {flow.tcContent && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Terms</span>
                    <span className={`font-bold text-xs px-2 py-0.5 rounded-md ${flow.privacyAcknowledged ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                      {flow.privacyAcknowledged ? "✓ Accepted" : "✗ Not accepted"}
                    </span>
                  </div>
                )}
              </div>
            )}

            {!flow.tcContent && (
              <div className="rounded-2xl border-2 border-border bg-card p-5">
                <div
                  className={`flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all active:scale-[0.98] ${
                    flow.privacyAcknowledged ? "bg-success/5 border-2 border-success/30" : "bg-secondary/50 border-2 border-border"
                  }`}
                  onClick={() => flow.setPrivacyAcknowledged(!flow.privacyAcknowledged)}
                  role="button"
                  tabIndex={0}
                  aria-pressed={flow.privacyAcknowledged}
                >
                  <Checkbox checked={flow.privacyAcknowledged} className="h-7 w-7" onCheckedChange={(c) => flow.setPrivacyAcknowledged(c === true)} />
                  <span className="text-base text-foreground font-medium">
                    I acknowledge that my data will be processed in accordance with data protection regulations and consent to this visit being recorded.
                  </span>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button variant="secondary" onClick={goBack} className="flex-1 h-14 text-base gap-2 border border-border">
                <ArrowLeft className="h-5 w-5" /> Back
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!flow.privacyAcknowledged}
                className="flex-1 h-14 text-base gap-2 bg-success hover:bg-success/90 text-success-foreground"
              >
                ✓ Complete Check In
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Start Over button removed — available in sticky header */}

      {watchlistEntry && (
        <WatchlistAlertDialog
          open={watchlistOpen}
          onOpenChange={setWatchlistOpen}
          entry={watchlistEntry}
          matchType={watchlistMatchType}
          onProceed={doCheckIn}
          onDeny={() => {
            toast({ title: "Entry Denied", description: "This visitor has been denied entry.", variant: "destructive" });
            setTimeout(() => navigate("/kiosk/home"), 2000);
          }}
        />
      )}
    </div>
  );
}
