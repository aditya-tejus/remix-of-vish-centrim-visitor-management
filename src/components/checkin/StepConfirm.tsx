import { Checkbox } from "@/components/ui/checkbox";
import { ScrollText, Shield, FileText, Users, Phone, Mail, Check, MapPin, Thermometer } from "lucide-react";
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
  tcContent?: string | null;
}

const TYPE_BADGES: Record<string, { label: string; emoji: string; className: string }> = {
  visitor: { label: "Visitor", emoji: "👋", className: "bg-primary/10 text-primary border-primary/20" },
  contractor: { label: "Contractor", emoji: "🔧", className: "bg-warning/10 text-warning border-warning/20" },
  volunteer: { label: "Volunteer", emoji: "🤝", className: "bg-success/10 text-success border-success/20" },
  staff: { label: "Staff", emoji: "💼", className: "bg-muted text-muted-foreground border-border" },
};

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
  tcContent,
}: StepConfirmProps) {
  const typeBadge = TYPE_BADGES[selectedType] || TYPE_BADGES.visitor;
  const hasHealthFlags = Object.values(healthAnswers).some((v) => v === true);

  return (
    <div className="space-y-5">
      {/* Summary card */}
      <div className="rounded-2xl border-2 border-border bg-card p-6 shadow-sm">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-5">Check-In Summary</p>

        {/* Visitor identity */}
        <div className="flex items-center gap-4 mb-5 pb-5 border-b border-border">
          {photo ? (
            <img src={photo} alt="" className="h-16 w-16 rounded-2xl object-cover border-2 border-border shadow-sm" />
          ) : (
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center text-[18px] font-bold text-primary">
              {formData.firstName?.[0]}{formData.surname?.[0]}
            </div>
          )}
          <div className="flex-1">
            <p className="text-[18px] font-bold text-foreground">{formData.firstName} {formData.surname}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${typeBadge.className}`}>
                {typeBadge.emoji} {typeBadge.label}
              </span>
              {formData.selectPerson && (
                <span className="text-[12px] text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> Visiting {formData.selectPerson}
                </span>
              )}
            </div>
          </div>
          <div className={`text-[12px] font-bold px-3 py-1.5 rounded-lg ${
            hasHealthFlags ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"
          }`}>
            {hasHealthFlags ? "⚠ Flagged" : "✓ Clear"}
          </div>
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-3 gap-3">
          {formData.mobile && (
            <div className="rounded-xl bg-muted/30 p-3.5 border border-border">
              <p className="text-[11px] text-muted-foreground flex items-center gap-1 mb-1"><Phone className="h-3 w-3" /> Phone</p>
              <p className="text-[13px] font-semibold text-foreground">{formData.mobile}</p>
            </div>
          )}
          {formData.email && (
            <div className="rounded-xl bg-muted/30 p-3.5 border border-border">
              <p className="text-[11px] text-muted-foreground flex items-center gap-1 mb-1"><Mail className="h-3 w-3" /> Email</p>
              <p className="text-[13px] font-semibold text-foreground truncate">{formData.email}</p>
            </div>
          )}
          {formData.bodyTemperature && (
            <div className="rounded-xl bg-muted/30 p-3.5 border border-border">
              <p className="text-[11px] text-muted-foreground flex items-center gap-1 mb-1"><Thermometer className="h-3 w-3" /> Temp</p>
              <p className={`text-[13px] font-semibold ${
                parseFloat(formData.bodyTemperature) > 37.8 ? "text-destructive" : "text-foreground"
              }`}>{formData.bodyTemperature}°C</p>
            </div>
          )}
          {formData.address && (
            <div className="rounded-xl bg-muted/30 p-3.5 border border-border">
              <p className="text-[11px] text-muted-foreground flex items-center gap-1 mb-1"><MapPin className="h-3 w-3" /> Address</p>
              <p className="text-[13px] font-semibold text-foreground truncate">{formData.address}</p>
            </div>
          )}
        </div>

        {/* Companions */}
        {companions.length > 0 && (
          <div className="mt-5 pt-5 border-t border-border">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
              <Users className="h-3 w-3" /> Companions ({companions.length})
            </p>
            <div className="grid grid-cols-2 gap-2">
              {companions.map((c, i) => (
                <div key={i} className="rounded-xl bg-muted/30 p-3 border border-border flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-[11px] font-bold text-primary shrink-0">
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

        {/* Comments */}
        {formData.comments && (
          <div className="mt-5 pt-5 border-t border-border">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Notes</p>
            <p className="text-[13px] text-foreground bg-muted/30 rounded-xl p-3 border border-border">{formData.comments}</p>
          </div>
        )}
      </div>

      {/* Terms & Privacy */}
      <div className="rounded-2xl border-2 border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <ScrollText className="h-4 w-4 text-primary" />
          </div>
          <h4 className="text-[14px] font-bold text-foreground">Terms & Privacy</h4>
        </div>
        <div className="max-h-[100px] overflow-y-auto rounded-xl bg-muted/30 p-4 text-[12px] text-muted-foreground leading-relaxed space-y-1.5 border border-border">
          <p>1. I agree to follow all care home policies during my visit.</p>
          <p>2. I agree to sign out upon leaving the premises.</p>
          <p>3. I confirm that all information provided is accurate.</p>
          <p>4. My visit data will be processed per applicable data protection regulations.</p>
        </div>
        {(branchTcUrl || branchPrivacyUrl) && (
          <div className="flex flex-wrap gap-4">
            {branchTcUrl && (
              <a href={branchTcUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[12px] text-primary hover:underline font-medium">
                <FileText className="h-3.5 w-3.5" /> View Terms & Conditions
              </a>
            )}
            {branchPrivacyUrl && (
              <a href={branchPrivacyUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[12px] text-primary hover:underline font-medium">
                <Shield className="h-3.5 w-3.5" /> View Privacy Policy
              </a>
            )}
          </div>
        )}
        <div
          className={`flex items-center gap-3 p-4 rounded-xl cursor-pointer transition-all ${
            privacyAcknowledged
              ? "bg-success/5 border-2 border-success/30"
              : "bg-muted/30 border-2 border-border hover:border-primary/30"
          }`}
          onClick={() => setPrivacyAcknowledged(!privacyAcknowledged)}
        >
          <Checkbox checked={privacyAcknowledged} className="h-5 w-5" onCheckedChange={(c) => setPrivacyAcknowledged(c === true)} />
          <span className="text-[13px] text-foreground">
            I accept the <strong>Terms & Conditions</strong> and acknowledge the <strong>Privacy Notice</strong>
          </span>
          {privacyAcknowledged && (
            <Check className="h-4 w-4 text-success ml-auto shrink-0" />
          )}
        </div>
      </div>
    </div>
  );
}
