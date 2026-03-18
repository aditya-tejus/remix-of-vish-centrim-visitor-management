import { Shield, ExternalLink } from "lucide-react";

type VisitorTypeForPrivacy = "visitor" | "contractor" | "resident";

const privacyContent: Record<VisitorTypeForPrivacy, {
  purpose: string;
  collected: string;
  basis: string;
  retention: string;
}> = {
  visitor: {
    purpose: "To manage visitor access, ensure safety, maintain security records, and respond to emergencies.",
    collected: "Name, contact details, check-in/out times, health declarations, companion details, and vaccination status.",
    basis: "Legitimate Interests / Legal Obligation.",
    retention: "Default 60 days (configurable by the care home).",
  },
  contractor: {
    purpose: "To manage contractor site access, verify compliance with health & safety requirements, maintain work records, and fulfil regulatory obligations.",
    collected: "Name, company, contact details, check-in/out times, health & safety declarations, insurance/certification details, and work area access logs.",
    basis: "Contractual Necessity / Legal Obligation / Legitimate Interests.",
    retention: "Default 60 days (configurable by the care home). May be retained longer for audit and insurance purposes.",
  },
  resident: {
    purpose: "To maintain resident welfare records, coordinate care visits, and ensure safeguarding compliance.",
    collected: "Name, contact details, visit records, health information, and next-of-kin details.",
    basis: "Vital Interests / Legal Obligation / Legitimate Interests.",
    retention: "Default 60 days (configurable by the care home).",
  },
};

interface PrivacyNoticeProps {
  visitorType?: VisitorTypeForPrivacy;
}

export function PrivacyNotice({ visitorType = "visitor" }: PrivacyNoticeProps) {
  const content = privacyContent[visitorType];

  return (
    <div className="rounded-xl border border-primary/15 bg-primary/[0.03] p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center">
          <Shield className="h-3.5 w-3.5 text-primary" />
        </div>
        <h4 className="text-xs font-semibold text-primary">Privacy Information</h4>
      </div>
      <div className="space-y-2 text-[11px] text-muted-foreground leading-relaxed">
        <p><span className="font-semibold text-foreground">Why we collect your information:</span> {content.purpose}</p>
        <p><span className="font-semibold text-foreground">What we collect:</span> {content.collected}</p>
        <p><span className="font-semibold text-foreground">Lawful basis:</span> {content.basis}</p>
        <p><span className="font-semibold text-foreground">Data usage:</span> Only for {visitorType} management and safety. Never for marketing.</p>
        <p><span className="font-semibold text-foreground">Retention:</span> {content.retention}</p>
        <p><span className="font-semibold text-foreground">Your rights:</span> Request access, correction, or deletion via the care home.</p>
        <p><span className="font-semibold text-foreground">Data Controller:</span> The care home you are visiting. Centrim Life processes data under strict GDPR rules.</p>
      </div>
      <a href="https://app.centrimlife.uk/legal" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] text-primary font-medium mt-3 hover:underline">
        View Full Privacy Notice
        <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}
