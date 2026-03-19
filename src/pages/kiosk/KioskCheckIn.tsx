import { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useVisitors } from "@/hooks/useVisitors";
import { useToast } from "@/hooks/use-toast";
import { WatchlistAlertDialog } from "@/components/WatchlistAlertDialog";
import { ContractorScreening } from "@/components/ContractorScreening";
import { KioskProgressStepper } from "@/components/kiosk/KioskProgressStepper";
import { KioskSuccessScreen } from "@/components/kiosk/KioskSuccessScreen";
import { KioskPersonCard } from "@/components/kiosk/KioskPersonCard";
import { useKioskCheckInFlow, KioskStepId } from "@/hooks/useKioskCheckInFlow";
import {
  User, Truck, Heart, ArrowLeft, ArrowRight, Shield, ScrollText,
  AlertTriangle, Search, RotateCcw, UserSearch
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const TYPES = [
  { type: "visitor" as const, label: "Visitor", icon: User, description: "Family, friend, or guest" },
  { type: "contractor" as const, label: "Contractor", icon: Truck, description: "Tradesperson or supplier" },
  { type: "volunteer" as const, label: "Volunteer", icon: Heart, description: "Volunteer or helper" },
];

export default function KioskCheckIn() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { addVisitor } = useVisitors();
  const flow = useKioskCheckInFlow();

  const [step, setStep] = useState<KioskStepId>("type");
  const [submitted, setSubmitted] = useState(false);
  const [watchlistEntry, setWatchlistEntry] = useState<any>(null);
  const [watchlistOpen, setWatchlistOpen] = useState(false);
  const [visitingSearch, setVisitingSearch] = useState("");
  const [visitingMode, setVisitingMode] = useState<"resident" | "staff" | null>(null);
  const [returningChecked, setReturningChecked] = useState(false);

  const currentIdx = flow.steps.findIndex((s) => s.id === step);

  const goNext = () => {
    const nextIdx = currentIdx + 1;
    if (nextIdx < flow.steps.length) setStep(flow.steps[nextIdx].id);
  };
  const goBack = () => {
    const prevIdx = currentIdx - 1;
    if (prevIdx >= 0) setStep(flow.steps[prevIdx].id);
  };

  // Returning visitor auto-fill
  const handleNameBlur = async () => {
    if (returningChecked) return;
    const firstName = flow.formValues.firstName?.trim();
    const surname = flow.formValues.surname?.trim();
    if (!firstName || !surname) return;
    setReturningChecked(true);
    const prev = await flow.searchReturningVisitor(firstName, surname);
    if (prev) {
      flow.setReturningVisitor(prev);
      // Auto-fill empty fields
      flow.setFormValues((fv: Record<string, string>) => ({
        ...fv,
        email: fv.email || prev.email,
        mobile: fv.mobile || prev.mobile,
      }));
      toast({ title: "Welcome back!", description: "We've pre-filled your details from your last visit." });
    }
  };

  // Filtered residents/staff for visiting step
  const filteredVisiting = useMemo(() => {
    const q = visitingSearch.toLowerCase();
    if (visitingMode === "staff") {
      return flow.staff.filter((s) => s.name.toLowerCase().includes(q));
    }
    return flow.residents.filter((r) =>
      r.name.toLowerCase().includes(q) || r.room?.toLowerCase().includes(q)
    );
  }, [visitingSearch, visitingMode, flow.residents, flow.staff]);

  const doCheckIn = useCallback(() => {
    const allHealthClear = Object.values(flow.healthAnswers).every((v) => v === false);
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
      additionalVisitors: 0,
      comments: flow.formValues.comments || "",
      retentionExpiry: new Date(Date.now() + 86400000 * 60),
      acknowledgedPrivacy: flow.privacyAcknowledged,
      contractorScreening: flow.selectedType === "contractor" ? flow.contractorAnswers : undefined,
      supplierId: flow.selectedSupplier?.id || undefined,
    });
    setSubmitted(true);
    toast({ title: "Checked In", description: `Welcome, ${flow.formValues.firstName}!` });
  }, [flow, addVisitor, toast]);

  const handleSubmit = () => {
    const match = flow.checkVisitor(flow.formValues.firstName || "", flow.formValues.surname || "");
    if (match) {
      setWatchlistEntry(match);
      setWatchlistOpen(true);
      if (match.alert_type === "hard") return;
    }
    doCheckIn();
  };

  const handleComplete = useCallback(() => navigate("/kiosk/home"), [navigate]);
  const handleStartOver = () => {
    flow.reset();
    setStep("type");
    setSubmitted(false);
    setReturningChecked(false);
    setVisitingSearch("");
    setVisitingMode(null);
  };

  if (submitted) {
    return (
      <KioskSuccessScreen
        title={`Welcome, ${flow.formValues.firstName}!`}
        subtitle="You have been checked in successfully."
        accentColor="primary"
        onComplete={handleComplete}
      />
    );
  }

  const anim = { initial: { opacity: 0, x: 40 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -40 }, transition: { duration: 0.25 } };

  return (
    <div className="w-full max-w-2xl space-y-6 px-2">
      <KioskProgressStepper steps={flow.steps} currentIndex={currentIdx} accentColor="primary" />

      <AnimatePresence mode="wait">
        {/* Step: Type Selection */}
        {step === "type" && (
          <motion.div key="type" {...anim} className="space-y-5">
            <h2 className="text-3xl font-bold text-foreground text-center">I am a...</h2>
            <div className="grid grid-cols-3 gap-4">
              {TYPES.map((t) => (
                <button
                  key={t.type}
                  onClick={() => { flow.setSelectedType(t.type); goNext(); }}
                  className={`flex flex-col items-center gap-3 p-6 rounded-2xl border-2 transition-all duration-150 min-h-[160px] active:scale-[0.96]
                    ${flow.selectedType === t.type ? "border-primary bg-primary/5 shadow-md" : "border-border hover:border-primary/50"}`}
                >
                  <t.icon className="h-10 w-10 text-primary" />
                  <div className="text-center">
                    <span className="text-lg font-bold block">{t.label}</span>
                    <span className="text-xs text-muted-foreground mt-1 block">{t.description}</span>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Step: Details — Dynamic from form_fields */}
        {step === "details" && (
          <motion.div key="details" {...anim} className="space-y-4">
            <h2 className="text-3xl font-bold text-foreground text-center">Your Details</h2>

            {flow.returningVisitor && (
              <div className="rounded-xl border-2 border-success/20 bg-success/5 p-3 flex items-center gap-2 text-sm text-success">
                <UserSearch className="h-4 w-4 shrink-0" />
                <span className="font-medium">Welcome back! Details pre-filled from your last visit.</span>
              </div>
            )}

            {/* Core fields: always first name + surname */}
            <div className="grid grid-cols-2 gap-3">
              <Input
                placeholder="First Name *"
                value={flow.formValues.firstName || ""}
                onChange={(e) => flow.updateField("firstName", e.target.value)}
                onBlur={handleNameBlur}
                className="h-14 text-lg"
                autoFocus
              />
              <Input
                placeholder="Surname *"
                value={flow.formValues.surname || ""}
                onChange={(e) => flow.updateField("surname", e.target.value)}
                onBlur={handleNameBlur}
                className="h-14 text-lg"
              />
            </div>

            {/* Dynamic form fields */}
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
                        <SelectItem value="option1">Option 1</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      placeholder={`${field.label}${field.required ? " *" : ""}`}
                      value={flow.formValues[field.field_key] || ""}
                      onChange={(e) => flow.updateField(field.field_key, e.target.value)}
                      type={field.field_type === "email" ? "email" : field.field_type === "tel" ? "tel" : "text"}
                      className="h-14 text-lg"
                    />
                  )}
                </div>
              );
            })}

            {/* Fallback: if no form fields configured, show email + mobile */}
            {flow.activeFormFields.length === 0 && (
              <>
                <Input placeholder="Email" value={flow.formValues.email || ""} onChange={(e) => flow.updateField("email", e.target.value)} className="h-14 text-lg" />
                <Input placeholder="Mobile" value={flow.formValues.mobile || ""} onChange={(e) => flow.updateField("mobile", e.target.value)} className="h-14 text-lg" />
              </>
            )}

            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={goBack} className="flex-1 h-14 text-base gap-2">
                <ArrowLeft className="h-5 w-5" /> Back
              </Button>
              <Button onClick={goNext} disabled={!flow.formValues.firstName?.trim() || !flow.formValues.surname?.trim()} className="flex-1 h-14 text-base gap-2">
                Next <ArrowRight className="h-5 w-5" />
              </Button>
            </div>
          </motion.div>
        )}

        {/* Step: Who are you visiting — Structured picker */}
        {step === "visiting" && (
          <motion.div key="visiting" {...anim} className="space-y-4">
            <h2 className="text-3xl font-bold text-foreground text-center">Who Are You Visiting?</h2>

            {/* Mode toggle: Resident vs Staff */}
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => { setVisitingMode("resident"); setVisitingSearch(""); }}
                className={`px-6 py-3 rounded-xl text-base font-semibold transition-all ${
                  visitingMode === "resident" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-primary/10"
                }`}
              >
                Resident
              </button>
              <button
                onClick={() => { setVisitingMode("staff"); setVisitingSearch(""); }}
                className={`px-6 py-3 rounded-xl text-base font-semibold transition-all ${
                  visitingMode === "staff" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-primary/10"
                }`}
              >
                Staff Member
              </button>
            </div>

            {visitingMode && (
              <>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    value={visitingSearch}
                    onChange={(e) => setVisitingSearch(e.target.value)}
                    placeholder={visitingMode === "resident" ? "Search by name or room..." : "Search by name..."}
                    className="pl-12 h-14 text-lg"
                    autoFocus
                  />
                </div>
                <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                  {filteredVisiting.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground">No {visitingMode}s found</p>
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
                          flow.updateField("whomToVisit", person.name);
                          goNext();
                        }}
                      />
                    ))
                  )}
                </div>
              </>
            )}

            {/* Allow skip / manual entry */}
            {flow.formValues.whomToVisit && (
              <div className="rounded-xl border-2 border-success/20 bg-success/5 p-3 text-center text-sm text-success font-medium">
                Visiting: {flow.formValues.whomToVisit}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={goBack} className="flex-1 h-14 text-base gap-2">
                <ArrowLeft className="h-5 w-5" /> Back
              </Button>
              <Button variant="ghost" onClick={goNext} className="flex-1 h-14 text-base gap-2 text-muted-foreground">
                Skip <ArrowRight className="h-5 w-5" />
              </Button>
            </div>
          </motion.div>
        )}

        {/* Step: Contractor Screening */}
        {step === "contractor" && (
          <motion.div key="contractor" {...anim} className="space-y-4">
            <h2 className="text-3xl font-bold text-foreground text-center">Contractor Screening</h2>
            <div className="max-h-[55vh] overflow-y-auto pr-1">
              <ContractorScreening
                jurisdiction={flow.jurisdiction}
                answers={flow.contractorAnswers}
                onAnswersChange={flow.setContractorAnswers}
                selectedSupplier={flow.selectedSupplier}
                onSupplierChange={flow.setSelectedSupplier}
                compact={false}
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={goBack} className="flex-1 h-14 text-base gap-2">
                <ArrowLeft className="h-5 w-5" /> Back
              </Button>
              <Button onClick={goNext} className="flex-1 h-14 text-base gap-2">
                Next <ArrowRight className="h-5 w-5" />
              </Button>
            </div>
          </motion.div>
        )}

        {/* Step: Health Screening */}
        {step === "screening" && (
          <motion.div key="screening" {...anim} className="space-y-4">
            <div className="text-center space-y-1">
              <h2 className="text-3xl font-bold text-foreground">Health Screening</h2>
              <p className="text-sm text-muted-foreground">
                {Object.keys(flow.healthAnswers).length} of {flow.healthQuestions.length} answered
              </p>
            </div>
            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
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
                            className={`flex-1 py-4 rounded-xl text-base font-bold transition-all ${answer === false ? "bg-success text-success-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-success/20"}`}>No</button>
                          <button onClick={() => flow.setHealthAnswers((prev: Record<string, any>) => ({ ...prev, [q.id]: true }))}
                            className={`flex-1 py-4 rounded-xl text-base font-bold transition-all ${answer === true ? "bg-destructive text-destructive-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-destructive/20"}`}>Yes</button>
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
            </div>

            {flow.hasYesFlags && (
              <div className="rounded-2xl bg-destructive/10 border-2 border-destructive/20 p-4 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="text-base font-bold text-destructive">Health Concern Flagged</p>
                  <p className="text-sm text-muted-foreground mt-0.5">Staff review may be required.</p>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={goBack} className="flex-1 h-14 text-base gap-2">
                <ArrowLeft className="h-5 w-5" /> Back
              </Button>
              <Button onClick={goNext} className="flex-1 h-14 text-base gap-2">
                Next <ArrowRight className="h-5 w-5" />
              </Button>
            </div>
          </motion.div>
        )}

        {/* Step: Terms & Conditions */}
        {step === "terms" && flow.tcContent && (
          <motion.div key="terms" {...anim} className="space-y-4">
            <div className="text-center space-y-1">
              <h2 className="text-3xl font-bold text-foreground">Terms & Conditions</h2>
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
                className={`flex items-center gap-4 p-5 rounded-xl cursor-pointer transition-all ${
                  flow.privacyAcknowledged ? "bg-success/5 border-2 border-success/30" : "bg-muted/30 border-2 border-border hover:border-primary/30"
                }`}
                onClick={() => flow.setPrivacyAcknowledged(!flow.privacyAcknowledged)}
              >
                <Checkbox checked={flow.privacyAcknowledged} className="h-7 w-7" onCheckedChange={(c) => flow.setPrivacyAcknowledged(c === true)} />
                <span className="text-base text-foreground font-medium">
                  I accept the <strong>Terms & Conditions</strong> and acknowledge the <strong>Privacy Notice</strong>
                </span>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={goBack} className="flex-1 h-14 text-base gap-2">
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
            <h2 className="text-3xl font-bold text-foreground text-center">Review & Confirm</h2>
            <div className="rounded-2xl border-2 border-border bg-card p-6 space-y-3 text-base">
              <div className="flex justify-between"><span className="text-muted-foreground">Name</span><span className="font-medium">{flow.formValues.firstName} {flow.formValues.surname}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span className="font-medium capitalize">{flow.selectedType}</span></div>
              {flow.formValues.email && <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span className="font-medium">{flow.formValues.email}</span></div>}
              {flow.formValues.mobile && <div className="flex justify-between"><span className="text-muted-foreground">Mobile</span><span className="font-medium">{flow.formValues.mobile}</span></div>}
              {flow.formValues.whomToVisit && <div className="flex justify-between"><span className="text-muted-foreground">Visiting</span><span className="font-medium">{flow.formValues.whomToVisit}</span></div>}

              {flow.healthQuestions.length > 0 && (
                <div className="pt-3 mt-3 border-t border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-2"><Shield className="h-4 w-4" /> Screening</span>
                    <span className={`font-bold text-sm px-2.5 py-1 rounded-lg ${flow.hasYesFlags ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"}`}>
                      {flow.hasYesFlags ? "⚠ Flagged" : "✓ Clear"}
                    </span>
                  </div>
                </div>
              )}

              {flow.tcContent && (
                <div className="pt-3 mt-3 border-t border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-2"><ScrollText className="h-4 w-4" /> Terms</span>
                    <span className={`font-bold text-sm px-2.5 py-1 rounded-lg ${flow.privacyAcknowledged ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                      {flow.privacyAcknowledged ? "✓ Accepted" : "✗ Not accepted"}
                    </span>
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={goBack} className="flex-1 h-14 text-base gap-2">
                <ArrowLeft className="h-5 w-5" /> Back
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={flow.tcContent ? !flow.privacyAcknowledged : false}
                className="flex-1 h-14 text-base gap-2 bg-success hover:bg-success/90 text-success-foreground"
              >
                ✓ Complete Check In
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Start Over button */}
      {step !== "type" && (
        <div className="text-center pt-2">
          <Button variant="ghost" size="sm" onClick={handleStartOver} className="text-muted-foreground gap-2">
            <RotateCcw className="h-4 w-4" /> Start Over
          </Button>
        </div>
      )}

      {watchlistEntry && (
        <WatchlistAlertDialog
          open={watchlistOpen}
          onOpenChange={setWatchlistOpen}
          entry={watchlistEntry}
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
