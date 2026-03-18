import { Checkbox } from "@/components/ui/checkbox";
import { ScrollText, Shield, FileText, Users, Phone, Mail, Check } from "lucide-react";
import { CompanionDetail, VisitorType } from "@/types/visitor";
import { CheckInFormData } from "./useCheckInFlow";

interface StepConfirmProps {
  formData: CheckInFormData;
  selectedType: VisitorType;
  photo: string | null;
  healthAnswers: Record<string, any>;
  companions: CompanionDetail[];
  privacyAcknowledged: boolean;
  setPrivacyAcknowledged: (val: boolean) => void;
  branchTcUrl: string | null;
  branchPrivacyUrl: string | null;
}

export function StepConfirm({
  formData,
  selectedType,
  photo,
  healthAnswers,
  companions,
  privacyAcknowledged,
  setPrivacyAcknowledged,
  branchTcUrl,
  branchPrivacyUrl,
}: StepConfirmProps) {
  const typeLabels: Record<string, string> = {
    visitor: "👋 Visitor",
    contractor: "🔧 Contractor",
    volunteer: "🤝 Volunteer",
    staff: "💼 Staff",
  };

  const hasHealthFlags = Object.values(healthAnswers).some((v) => v === true);

  return (
    <div className="space-y-5">
      {/* Summary card */}
      <div className="rounded-2xl border border-border bg-muted/30 p-5 shadow-sm">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-4">Summary</p>

        <div className="flex items-center gap-4 mb-4">
          {photo ? (
            <img src={photo} alt="" className="h-14 w-14 rounded-2xl object-cover border-2 border-border" />
          ) : (
            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-lg font-bold text-primary">
              {formData.firstName?.[0]}{formData.surname?.[0]}
            </div>
          )}
          <div className="flex-1">
            <p className="text-[16px] font-bold text-foreground">{formData.firstName} {formData.surname}</p>
            <p className="text-[13px] text-muted-foreground">
              {typeLabels[selectedType] || selectedType}
              {formData.selectPerson && ` • Visiting ${formData.selectPerson}`}
            </p>
          </div>
          <div className={`text-[12px] font-bold px-2.5 py-1 rounded-lg ${
            hasHealthFlags ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"
          }`}>
            {hasHealthFlags ? "⚠ Flagged" : "✓ Clear"}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {formData.mobile && (
            <div className="rounded-xl bg-card p-3 border border-border">
              <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" /> Phone</p>
              <p className="text-[13px] font-semibold text-foreground mt-0.5">{formData.mobile}</p>
            </div>
          )}
          {formData.email && (
            <div className="rounded-xl bg-card p-3 border border-border">
              <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" /> Email</p>
              <p className="text-[13px] font-semibold text-foreground mt-0.5 truncate">{formData.email}</p>
            </div>
          )}
          {formData.bodyTemperature && (
            <div className="rounded-xl bg-card p-3 border border-border">
              <p className="text-[11px] text-muted-foreground">Temperature</p>
              <p className="text-[13px] font-semibold text-foreground mt-0.5">{formData.bodyTemperature}°C</p>
            </div>
          )}
        </div>

        {/* Companions */}
        {companions.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2.5 flex items-center gap-1.5">
              <Users className="h-3 w-3" /> Companions ({companions.length})
            </p>
            <div className="space-y-1.5">
              {companions.map((c, i) => (
                <div key={i} className="rounded-xl bg-card p-2.5 border border-border flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-[11px] font-bold text-primary">
                    {(c.name || "?")[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-foreground truncate">{c.name || `Person ${i + 1}`}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{[c.relation, c.phone, c.email].filter(Boolean).join(" • ")}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Terms & Privacy */}
      <div className="rounded-xl border border-border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <ScrollText className="h-4 w-4 text-primary shrink-0" />
          <h4 className="text-[13px] font-bold text-foreground">Terms & Privacy</h4>
        </div>
        <div className="max-h-[80px] overflow-y-auto rounded-xl bg-muted/30 p-3 text-[11px] text-muted-foreground leading-relaxed space-y-1 border border-border">
          <p>1. I agree to follow all care home policies during my visit.</p>
          <p>2. I agree to sign out upon leaving the premises.</p>
          <p>3. I confirm that all information provided is accurate.</p>
          <p>4. My visit data will be processed per applicable data protection regulations.</p>
        </div>
        {(branchTcUrl || branchPrivacyUrl) && (
          <div className="flex flex-wrap gap-3">
            {branchTcUrl && (
              <a href={branchTcUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[12px] text-primary hover:underline font-medium">
                <FileText className="h-3 w-3" /> View Terms & Conditions
              </a>
            )}
            {branchPrivacyUrl && (
              <a href={branchPrivacyUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[12px] text-primary hover:underline font-medium">
                <Shield className="h-3 w-3" /> View Privacy Policy
              </a>
            )}
          </div>
        )}
        <div
          className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 cursor-pointer transition-colors"
          onClick={() => setPrivacyAcknowledged(!privacyAcknowledged)}
        >
          <Checkbox checked={privacyAcknowledged} className="h-5 w-5" onCheckedChange={(c) => setPrivacyAcknowledged(c === true)} />
          <span className="text-[13px] text-foreground">
            I accept the <strong>Terms & Conditions</strong> and acknowledge the <strong>Privacy Notice</strong>
          </span>
        </div>
      </div>
    </div>
  );
}
