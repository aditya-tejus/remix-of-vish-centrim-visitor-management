import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { User, Truck, Heart, ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";

const TYPES = [
  { type: "visitor", label: "Visitor", icon: User },
  { type: "contractor", label: "Contractor", icon: Truck },
  { type: "volunteer", label: "Volunteer", icon: Heart },
];

const STEPS = ["type", "details", "confirm"];

export default function KioskCheckIn() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [selectedType, setSelectedType] = useState("");
  const [form, setForm] = useState({ firstName: "", surname: "", email: "", mobile: "", whomToVisit: "" });
  const [submitted, setSubmitted] = useState(false);

  const update = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async () => {
    await supabase.from("visitors").insert({
      first_name: form.firstName,
      surname: form.surname,
      email: form.email,
      mobile: form.mobile,
      type: selectedType,
      whom_to_visit: form.whomToVisit,
      status: "checked-in",
      health_declaration: false,
      privacy_acknowledged: false,
    });
    setSubmitted(true);
    toast({ title: "Checked In", description: `Welcome, ${form.firstName}!` });
    setTimeout(() => navigate("/kiosk"), 3000);
  };

  if (submitted) {
    return (
      <div className="text-center space-y-6 max-w-md">
        <div className="h-20 w-20 rounded-full bg-success/10 flex items-center justify-center mx-auto">
          <CheckCircle2 className="h-10 w-10 text-success" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">Welcome, {form.firstName}!</h2>
        <p className="text-muted-foreground">You have been checked in successfully.</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg space-y-6">
      {/* Progress */}
      <div className="flex items-center gap-2 justify-center">
        {STEPS.map((s, i) => (
          <div key={s} className={`h-2 rounded-full transition-all ${i <= step ? "bg-primary w-12" : "bg-muted w-8"}`} />
        ))}
      </div>

      {step === 0 && (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-foreground text-center">I am a...</h2>
          <div className="grid grid-cols-3 gap-4">
            {TYPES.map((t) => (
              <button
                key={t.type}
                onClick={() => { setSelectedType(t.type); setStep(1); }}
                className={`flex flex-col items-center gap-3 p-6 rounded-xl border-2 transition-all duration-150 min-h-[120px]
                  ${selectedType === t.type ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
              >
                <t.icon className="h-8 w-8 text-primary" />
                <span className="text-base font-semibold">{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-foreground text-center">Your Details</h2>
          <Input placeholder="First Name *" value={form.firstName} onChange={(e) => update("firstName", e.target.value)} className="h-12 text-base" />
          <Input placeholder="Surname *" value={form.surname} onChange={(e) => update("surname", e.target.value)} className="h-12 text-base" />
          <Input placeholder="Email" value={form.email} onChange={(e) => update("email", e.target.value)} className="h-12 text-base" />
          <Input placeholder="Mobile" value={form.mobile} onChange={(e) => update("mobile", e.target.value)} className="h-12 text-base" />
          <Input placeholder="Who are you visiting?" value={form.whomToVisit} onChange={(e) => update("whomToVisit", e.target.value)} className="h-12 text-base" />
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(0)} className="flex-1 h-12 text-base gap-2">
              <ArrowLeft className="h-5 w-5" /> Back
            </Button>
            <Button onClick={() => setStep(2)} disabled={!form.firstName.trim() || !form.surname.trim()} className="flex-1 h-12 text-base gap-2">
              Next <ArrowRight className="h-5 w-5" />
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-foreground text-center">Confirm</h2>
          <div className="rounded-xl border border-border bg-card p-6 space-y-3">
            <div className="flex justify-between"><span className="text-muted-foreground">Name</span><span className="font-medium">{form.firstName} {form.surname}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span className="font-medium capitalize">{selectedType}</span></div>
            {form.whomToVisit && <div className="flex justify-between"><span className="text-muted-foreground">Visiting</span><span className="font-medium">{form.whomToVisit}</span></div>}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(1)} className="flex-1 h-12 text-base gap-2">
              <ArrowLeft className="h-5 w-5" /> Back
            </Button>
            <Button onClick={handleSubmit} className="flex-1 h-12 text-base gap-2 bg-success hover:bg-success/90 text-success-foreground">
              <CheckCircle2 className="h-5 w-5" /> Complete
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
