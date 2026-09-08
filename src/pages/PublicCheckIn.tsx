import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Check, User, Truck, UserCog, Users, Thermometer, Shield, Heart } from "lucide-react";
import { PrivacyNotice } from "@/components/PrivacyNotice";
import { VisitorType } from "@/types/visitor";

const visitorTypes: { type: VisitorType; label: string; emoji: string }[] = [
  { type: "visitor", label: "Visitor", emoji: "👋" },
  { type: "contractor", label: "Contractor", emoji: "🔧" },
  { type: "volunteer", label: "Volunteer", emoji: "🤝" },
];

const healthQuestions = [
  { id: "fever", question: "Do you have a fever or feel unusually warm?", icon: Thermometer },
  { id: "cough", question: "Do you have a new continuous cough?", icon: Shield },
  { id: "taste", question: "Have you lost your sense of taste or smell?", icon: Heart },
  { id: "contact", question: "Contact with COVID-19 positive person in last 7 days?", icon: Users },
  { id: "diarrhea", question: "Diarrhea or vomiting in the last 48 hours?", icon: Shield },
];

export default function PublicCheckIn() {
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [selectedType, setSelectedType] = useState<VisitorType>("visitor");
  const [formData, setFormData] = useState({
    firstName: "", surname: "", email: "", mobile: "", address: "",
    whomToVisit: "", comments: "", bodyTemperature: "",
  });
  const [healthAnswers, setHealthAnswers] = useState<Record<string, boolean>>({});
  const [privacyAcknowledged, setPrivacyAcknowledged] = useState(false);

  const updateField = (field: string, value: string) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const allHealthAnswered = healthQuestions.every((q) => healthAnswers[q.id] !== undefined);

  const handleSubmit = async () => {
    // Public arrivals go through the restricted server function — no table access.
    const { error } = await supabase.rpc("kiosk_check_in" as any, {
      p_payload: {
        first_name: formData.firstName,
        surname: formData.surname,
        email: formData.email,
        mobile: formData.mobile,
        type: selectedType,
        whom_to_visit: formData.whomToVisit,
        address: formData.address,
        comments: formData.comments,
        body_temperature: formData.bodyTemperature || null,
        health_declaration: Object.values(healthAnswers).every((v) => v === false),
        health_answers: healthAnswers,
        privacy_acknowledged: privacyAcknowledged,
      } as any,
    });
    if (!error) setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Check className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-xl font-bold text-foreground">You're All Set!</h1>
            <p className="text-sm text-muted-foreground">
              Thank you, <span className="font-semibold text-foreground">{formData.firstName} {formData.surname}</span>.
              Your visit has been registered successfully. Please proceed to the reception desk.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile-friendly header */}
      <header className="sticky top-0 z-10 border-b border-border bg-card/90 backdrop-blur-sm px-4 py-3">
        <h1 className="text-lg font-bold text-foreground text-center">Welcome — Visitor Check-In</h1>
        <div className="flex items-center justify-center gap-1 mt-2">
          {["Who You Are", "Your Details", "Health Check", "Review & Submit"].map((s, i) => (
            <div key={s} className="flex items-center flex-1">
              <div className={`h-7 rounded-full flex items-center justify-center px-2 text-[10px] font-semibold w-full transition-all ${
                i + 1 < step ? "bg-primary/15 text-primary"
                  : i + 1 === step ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}>
                {i + 1 < step ? <Check className="h-3 w-3" /> : s}
              </div>
              {i < 3 && <div className={`w-3 h-[2px] mx-0.5 rounded ${i + 1 < step ? "bg-primary/40" : "bg-border"}`} />}
            </div>
          ))}
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 pb-28 space-y-4">
        {/* Step 1: Type */}
        {step === 1 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Please select the option that best describes you.</p>
            <div className="grid grid-cols-2 gap-3">
              {visitorTypes.map(({ type, label, emoji }) => (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                    selectedType === type
                      ? "border-primary bg-primary/5 shadow-md"
                      : "border-border hover:border-primary/30"
                  }`}
                >
                  <span className="text-2xl">{emoji}</span>
                  <span className={`text-sm font-semibold ${selectedType === type ? "text-primary" : "text-foreground"}`}>{label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Details */}
        {step === 2 && (
          <div className="space-y-4">
            <PrivacyNotice visitorType={selectedType === "staff" ? "visitor" : selectedType as any} />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">First Name *</Label>
                <Input value={formData.firstName} onChange={(e) => updateField("firstName", e.target.value)} placeholder="John" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Surname *</Label>
                <Input value={formData.surname} onChange={(e) => updateField("surname", e.target.value)} placeholder="Smith" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email *</Label>
              <Input type="email" value={formData.email} onChange={(e) => updateField("email", e.target.value)} placeholder="john@example.com" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Mobile *</Label>
              <Input type="tel" value={formData.mobile} onChange={(e) => updateField("mobile", e.target.value)} placeholder="07700 900123" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Address</Label>
              <Input value={formData.address} onChange={(e) => updateField("address", e.target.value)} placeholder="Street address" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Who are you visiting?</Label>
              <Input value={formData.whomToVisit} onChange={(e) => updateField("whomToVisit", e.target.value)} placeholder="Resident name" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Comments</Label>
              <Textarea value={formData.comments} onChange={(e) => updateField("comments", e.target.value)} placeholder="Any additional notes..." rows={2} />
            </div>
          </div>
        )}

        {/* Step 3: Health */}
        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">For your safety and ours, please answer honestly.</p>
            <div className="space-y-3">
              {healthQuestions.map(({ id, question, icon: Icon }) => (
                <div key={id} className={`rounded-xl border-2 p-3 transition-all ${
                  healthAnswers[id] === true ? "border-destructive/40 bg-destructive/5"
                    : healthAnswers[id] === false ? "border-primary/30 bg-primary/5"
                    : "border-border"
                }`}>
                  <p className="text-sm text-foreground mb-2 flex items-start gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    {question}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant={healthAnswers[id] === false ? "default" : "outline"}
                      size="sm"
                      className="flex-1"
                      onClick={() => setHealthAnswers((p) => ({ ...p, [id]: false }))}
                    >
                      No
                    </Button>
                    <Button
                      variant={healthAnswers[id] === true ? "destructive" : "outline"}
                      size="sm"
                      className="flex-1"
                      onClick={() => setHealthAnswers((p) => ({ ...p, [id]: true }))}
                    >
                      Yes
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Body Temperature (°C) — optional</Label>
              <Input type="number" step="0.1" value={formData.bodyTemperature} onChange={(e) => updateField("bodyTemperature", e.target.value)} placeholder="36.6" />
            </div>
          </div>
        )}

        {/* Step 4: Confirm */}
        {step === 4 && (
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-4 space-y-2 text-sm">
                <p><span className="text-muted-foreground">Name:</span> <span className="font-semibold text-foreground">{formData.firstName} {formData.surname}</span></p>
                <p><span className="text-muted-foreground">Email:</span> <span className="text-foreground">{formData.email}</span></p>
                <p><span className="text-muted-foreground">Mobile:</span> <span className="text-foreground">{formData.mobile}</span></p>
                {formData.whomToVisit && <p><span className="text-muted-foreground">Visiting:</span> <span className="text-foreground">{formData.whomToVisit}</span></p>}
                <p><span className="text-muted-foreground">Type:</span> <span className="capitalize text-foreground">{selectedType}</span></p>
              </CardContent>
            </Card>
            <div className="flex items-start gap-2 p-3 rounded-xl border border-border">
              <Checkbox
                id="privacy"
                checked={privacyAcknowledged}
                onCheckedChange={(c) => setPrivacyAcknowledged(!!c)}
              />
              <label htmlFor="privacy" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
                I acknowledge that my data will be processed in accordance with the facility's privacy policy and GDPR regulations. Data will be retained for a limited period for safety purposes.
              </label>
            </div>
          </div>
        )}
      </main>

      {/* Fixed bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border p-4 flex gap-3 max-w-md mx-auto">
        {step > 1 && (
          <Button variant="outline" className="flex-1" onClick={() => setStep(step - 1)}>
            Back
          </Button>
        )}
        {step < 4 ? (
          <Button
            className="flex-1"
            disabled={step === 2 && (!formData.firstName || !formData.surname || !formData.email || !formData.mobile)}
            onClick={() => setStep(step + 1)}
          >
            Next
          </Button>
        ) : (
          <Button className="flex-1" disabled={!privacyAcknowledged} onClick={handleSubmit}>
            Complete Check-In
          </Button>
        )}
      </div>
    </div>
  );
}
