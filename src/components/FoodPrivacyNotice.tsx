import { Shield } from "lucide-react";
import { useJurisdiction } from "@/hooks/useJurisdiction";

interface FoodPrivacyNoticeProps {
  /** Larger text/padding for kiosk screens */
  size?: "default" | "kiosk";
}

/**
 * Privacy notice for the Food Register — shown at the food registration step
 * (kiosk and staff check-in) and at the top of the Food Register page.
 */
export function FoodPrivacyNotice({ size = "default" }: FoodPrivacyNoticeProps) {
  const { isUK, regimeShort, controllerTerm, regulator } = useJurisdiction();
  const kiosk = size === "kiosk";
  const text = kiosk ? "text-[13px]" : "text-[11px]";

  return (
    <div className={`rounded-xl border border-primary/15 bg-primary/[0.03] ${kiosk ? "p-5" : "p-4"}`}>
      <div className="flex items-center gap-2 mb-2.5">
        <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center">
          <Shield className="h-3.5 w-3.5 text-primary" />
        </div>
        <h4 className={`${kiosk ? "text-sm" : "text-xs"} font-semibold text-primary`}>
          How we use this food record
        </h4>
      </div>
      <div className={`space-y-2 ${text} text-muted-foreground leading-relaxed`}>
        <p>
          <span className="font-semibold text-foreground">Why we record it:</span> to protect resident
          safety and to trace food brought into the home if a food-related illness or incident is investigated.
        </p>
        <p>
          <span className="font-semibold text-foreground">What we record:</span> the food described, the
          food type, who brought it, which resident it is for, any residents it is shared with, the date
          and time, and any notes. No photographs, allergen assessment or dietary analysis is carried out.
        </p>
        <p>
          <span className="font-semibold text-foreground">{isUK ? "Lawful basis" : "Basis for collection"}:</span>{" "}
          {isUK
            ? "Legitimate Interests (resident safety) and Legal Obligation (food safety and care records)."
            : "Collected under APP 3 as reasonably necessary for resident safety and our care and food-safety obligations."}
        </p>
        <p>
          <span className="font-semibold text-foreground">Retention:</span> food records follow the same
          retention period as visitor records and are deleted automatically once that period passes, unless
          the linked record is under a legal hold.
        </p>
        <p>
          <span className="font-semibold text-foreground">Your rights:</span>{" "}
          {isUK
            ? "You can ask the care home for a copy of, correction of, or deletion of this record."
            : "You can ask the care home for access to or correction of this record (APP 12 and APP 13)."}{" "}
          The {controllerTerm.toLowerCase()} is the care home; concerns can be raised with the {regulator} under the {regimeShort}.
        </p>
      </div>
    </div>
  );
}
