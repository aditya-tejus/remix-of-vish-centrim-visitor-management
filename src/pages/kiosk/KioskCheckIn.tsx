import { useState, useCallback, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useVisitors } from "@/hooks/useVisitors";
import { useWatchlist } from "@/hooks/useWatchlist";
import { useActiveHealthQuestions } from "@/hooks/useHealthQuestions";
import { WatchlistAlertDialog } from "@/components/WatchlistAlertDialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { User, Truck, Heart, ArrowLeft, ArrowRight, Shield, ScrollText, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { KioskProgressStepper } from "@/components/kiosk/KioskProgressStepper";
import { KioskSuccessScreen } from "@/components/kiosk/KioskSuccessScreen";

const TYPES = [
  { type: "visitor", label: "Visitor", icon: User },
  { type: "contractor", label: "Contractor", icon: Truck },
  { type: "volunteer", label: "Volunteer", icon: Heart },
];

type StepId = "type" | "details" | "screening" | "terms" | "confirm";

export default function KioskCheckIn() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { addVisitor } = useVisitors();
  const { checkVisitor } = useWatchlist();

  const [step, setStep] = useState<StepId>("type");
  const [selectedType, setSelectedType] = useState("visitor");
  const [form, setForm] = useState({ firstName: "", surname: "", email: "", mobile: "", whomToVisit: "" });
  const [healthAnswers, setHealthAnswers] = useState<Record<string, any>>({});
  const [privacyAcknowledged, setPrivacyAcknowledged] = useState(false);
  const [tcContent, setTcContent] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [watchlistEntry, setWatchlistEntry] = useState<any>(null);
  const [watchlistOpen, setWatchlistOpen] = useState(false);

  // Load health questions for selected type
  const { data: healthQuestions = [] } = useActiveHealthQuestions(selectedType as any);

  // Load T&C content for selected type
  useEffect(() => {
    supabase
      .from("settings")
      .select("key, value")
      .eq("key", `tc_content_${selectedType}`)
      .maybeSingle()
      .then(({ data }) => {
        setTcContent(data?.value || null);
      });
  }, [selectedType]);

  // Dynamic step pipeline
  const steps = useMemo<{ id: StepId; label: string }[]>(() => {
    const pipeline: { id: StepId; label: string }[] = [
      { id: "type", label: "Type" },
      { id: "details", label: "Your Details" },
    ];
    if (healthQuestions.length > 0) {
      pipeline.push({ id: "screening", label: "Screening" });
    }
    if (tcContent) {
      pipeline.push({ id: "terms", label: "Terms" });
    }
    pipeline.push({ id: "confirm", label: "Review" });
    return pipeline;
  }, [healthQuestions.length, tcContent]);

  const currentIdx = steps.findIndex((s) => s.id === step);
  const isLast = currentIdx === steps.length - 1;

  const update = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  const goNext = () => {
    const nextIdx = currentIdx + 1;
    if (nextIdx < steps.length) setStep(steps[nextIdx].id);
  };

  const goBack = () => {
    const prevIdx = currentIdx - 1;
    if (prevIdx >= 0) setStep(steps[prevIdx].id);
  };

  const doCheckIn = () => {
    const allHealthClear = Object.values(healthAnswers).every((v) => v === false);
    addVisitor({
      firstName: form.firstName,
      surname: form.surname,
      email: form.email || "",
      mobile: form.mobile || "",
      type: selectedType as any,
      checkInTime: new Date(),
      checkOutTime: null,
      whomToVisit: form.whomToVisit,
      address: "",
      status: "checked-in",
      healthDeclaration: allHealthClear,
      healthAnswers,
      additionalVisitors: 0,
      comments: "",
      retentionExpiry: new Date(Date.now() + 86400000 * 60),
      acknowledgedPrivacy: privacyAcknowledged,
    });
    setSubmitted(true);
    toast({ title: "Checked In", description: `Welcome, ${form.firstName}!` });
  };

  const handleSubmit = () => {
    const match = checkVisitor(form.firstName, form.surname);
    if (match) {
      setWatchlistEntry(match);
      setWatchlistOpen(true);
      if (match.alert_type === "hard") return;
    }
    doCheckIn();
  };

  const handleComplete = useCallback(() => navigate("/kiosk/home"), [navigate]);

  if (submitted) {
    return (
      <KioskSuccessScreen
        title={`Welcome, ${form.firstName}!`}
        subtitle="You have been checked in successfully."
        accentColor="primary"
        onComplete={handleComplete}
      />
    );
  }

  const hasYesFlags = healthQuestions.some((q) => q.type === "yesno" && healthAnswers[q.id] === true);

  return (
    <div className="w-full max-w-xl space-y-6 px-2">
      <KioskProgressStepper steps={steps} currentIndex={currentIdx} accentColor="primary" />

      <AnimatePresence mode="wait">
        {/* Step: Type Selection */}
        {step === "type" && (
          <motion.div key="type" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.25 }} className="space-y-4">
            <h2 className="text-3xl font-bold text-foreground text-center">I am a...</h2>
            <div className="grid grid-cols-3 gap-4">
              {TYPES.map((t) => (
                <button key={t.type}
                  onClick={() => { setSelectedType(t.type); setStep("details"); }}
                  className={`flex flex-col items-center gap-3 p-6 sm:p-8 rounded-xl border-2 transition-all duration-150 min-h-[140px]
                    ${selectedType === t.type ? "border-primary bg-primary/5 shadow-md" : "border-border hover:border-primary/50"}`}>
                  <t.icon className="h-9 w-9 sm:h-10 sm:w-10 text-primary" />
                  <span className="text-base sm:text-lg font-semibold">{t.label}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Step: Details */}
        {step === "details" && (
          <motion.div key="details" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.25 }} className="space-y-4">
            <h2 className="text-3xl font-bold text-foreground text-center">Your Details</h2>
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="First Name *" value={form.firstName} onChange={(e) => update("firstName", e.target.value)} className="h-14 text-lg" />
              <Input placeholder="Surname *" value={form.surname} onChange={(e) => update("surname", e.target.value)} className="h-14 text-lg" />
            </div>
            <Input placeholder="Email" value={form.email} onChange={(e) => update("email", e.target.value)} className="h-14 text-lg" />
            <Input placeholder="Mobile" value={form.mobile} onChange={(e) => update("mobile", e.target.value)} className="h-14 text-lg" />
            <Input placeholder="Who are you visiting?" value={form.whomToVisit} onChange={(e) => update("whomToVisit", e.target.value)} className="h-14 text-lg" />
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={goBack} className="flex-1 h-14 text-base gap-2">
                <ArrowLeft className="h-5 w-5" /> Back
              </Button>
              <Button onClick={goNext} disabled={!form.firstName.trim() || !form.surname.trim()} className="flex-1 h-14 text-base gap-2">
                Next <ArrowRight className="h-5 w-5" />
              </Button>
            </div>
          </motion.div>
        )}

        {/* Step: Screening */}
        {step === "screening" && (
          <motion.div key="screening" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.25 }} className="space-y-4">
            <div className="text-center space-y-1">
              <h2 className="text-3xl font-bold text-foreground">Screening</h2>
              <p className="text-base text-muted-foreground">Please answer the following questions</p>
            </div>

            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
              {healthQuestions.map((q, idx) => {
                const answer = healthAnswers[q.id];
                const isYesNo = q.type === "yesno";
                const hasYes = isYesNo && answer === true;
                const hasNo = isYesNo && answer === false;

                return (
                  <div key={q.id} className={`rounded-2xl border-2 p-5 transition-all ${
                    hasNo ? "border-success/30 bg-success/5"
                      : hasYes ? "border-destructive/30 bg-destructive/5"
                      : "border-border bg-card"
                  }`}>
                    <div className="flex items-start gap-3 mb-3">
                      <span className={`text-sm font-bold shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${
                        hasNo ? "bg-success text-success-foreground"
                          : hasYes ? "bg-destructive text-destructive-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}>{hasNo ? "✓" : hasYes ? "✗" : idx + 1}</span>
                      <p className="text-base text-foreground font-medium leading-relaxed">
                        {q.question}{q.required && <span className="text-destructive ml-0.5">*</span>}
                      </p>
                    </div>
                    <div className="ml-11">
                      {q.type === "yesno" && (
                        <div className="flex gap-3">
                          <button onClick={() => setHealthAnswers((prev) => ({ ...prev, [q.id]: false }))}
                            className={`flex-1 py-4 rounded-xl text-base font-bold transition-all ${answer === false ? "bg-success text-success-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-success/20"}`}>No</button>
                          <button onClick={() => setHealthAnswers((prev) => ({ ...prev, [q.id]: true }))}
                            className={`flex-1 py-4 rounded-xl text-base font-bold transition-all ${answer === true ? "bg-destructive text-destructive-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-destructive/20"}`}>Yes</button>
                        </div>
                      )}
                      {q.type === "text" && (
                        <Input value={answer || ""} onChange={(e) => setHealthAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                          placeholder={q.placeholder || "Enter response..."} className="h-14 text-lg rounded-xl" />
                      )}
                      {q.type === "textarea" && (
                        <Textarea value={answer || ""} onChange={(e) => setHealthAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                          placeholder={q.placeholder || "Enter details..."} className="min-h-[80px] text-base rounded-xl resize-none" />
                      )}
                      {q.type === "select" && q.options && (
                        <Select value={answer || ""} onValueChange={(val) => setHealthAnswers((prev) => ({ ...prev, [q.id]: val }))}>
                          <SelectTrigger className="h-14 text-base rounded-xl"><SelectValue placeholder="Select..." /></SelectTrigger>
                          <SelectContent>{(q.options as string[]).map((opt: string) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent>
                        </Select>
                      )}
                      {q.type === "checkbox" && (
                        <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 cursor-pointer"
                          onClick={() => setHealthAnswers((prev) => ({ ...prev, [q.id]: !prev[q.id] }))}>
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

            {hasYesFlags && (
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
        {step === "terms" && tcContent && (
          <motion.div key="terms" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.25 }} className="space-y-4">
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
              <div className="max-h-[35vh] overflow-y-auto rounded-xl bg-muted/30 p-5 text-sm text-muted-foreground leading-relaxed border border-border whitespace-pre-line">
                {tcContent}
              </div>
              <div
                className={`flex items-center gap-4 p-5 rounded-xl cursor-pointer transition-all ${
                  privacyAcknowledged
                    ? "bg-success/5 border-2 border-success/30"
                    : "bg-muted/30 border-2 border-border hover:border-primary/30"
                }`}
                onClick={() => setPrivacyAcknowledged(!privacyAcknowledged)}
              >
                <Checkbox checked={privacyAcknowledged} className="h-7 w-7" onCheckedChange={(c) => setPrivacyAcknowledged(c === true)} />
                <span className="text-base text-foreground font-medium">
                  I accept the <strong>Terms & Conditions</strong> and acknowledge the <strong>Privacy Notice</strong>
                </span>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={goBack} className="flex-1 h-14 text-base gap-2">
                <ArrowLeft className="h-5 w-5" /> Back
              </Button>
              <Button onClick={goNext} disabled={!privacyAcknowledged} className="flex-1 h-14 text-base gap-2">
                Next <ArrowRight className="h-5 w-5" />
              </Button>
            </div>
          </motion.div>
        )}

        {/* Step: Review & Confirm */}
        {step === "confirm" && (
          <motion.div key="confirm" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.25 }} className="space-y-4">
            <h2 className="text-3xl font-bold text-foreground text-center">Review</h2>
            <div className="rounded-2xl border-2 border-border bg-card p-6 sm:p-8 space-y-3 text-base">
              <div className="flex justify-between"><span className="text-muted-foreground">Name</span><span className="font-medium">{form.firstName} {form.surname}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span className="font-medium capitalize">{selectedType}</span></div>
              {form.email && <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span className="font-medium">{form.email}</span></div>}
              {form.mobile && <div className="flex justify-between"><span className="text-muted-foreground">Mobile</span><span className="font-medium">{form.mobile}</span></div>}
              {form.whomToVisit && <div className="flex justify-between"><span className="text-muted-foreground">Visiting</span><span className="font-medium">{form.whomToVisit}</span></div>}

              {/* Screening summary */}
              {healthQuestions.length > 0 && (
                <div className="pt-3 mt-3 border-t border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Shield className="h-4 w-4" /> Screening
                    </span>
                    <span className={`font-bold text-sm px-2.5 py-1 rounded-lg ${
                      hasYesFlags ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"
                    }`}>
                      {hasYesFlags ? "⚠ Flagged" : "✓ Clear"}
                    </span>
                  </div>
                </div>
              )}

              {/* T&C acknowledgment */}
              {tcContent && (
                <div className="pt-3 mt-3 border-t border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <ScrollText className="h-4 w-4" /> Terms
                    </span>
                    <span className={`font-bold text-sm px-2.5 py-1 rounded-lg ${
                      privacyAcknowledged ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                    }`}>
                      {privacyAcknowledged ? "✓ Accepted" : "✗ Not accepted"}
                    </span>
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={goBack} className="flex-1 h-14 text-base gap-2">
                <ArrowLeft className="h-5 w-5" /> Back
              </Button>
              <Button onClick={handleSubmit}
                disabled={tcContent ? !privacyAcknowledged : false}
                className="flex-1 h-14 text-base gap-2 bg-success hover:bg-success/90 text-success-foreground">
                ✓ Complete
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
