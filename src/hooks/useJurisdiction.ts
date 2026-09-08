import { useOperatingContext } from "@/contexts/OperatingContext";

export type Jurisdiction = "AU" | "UK";

/**
 * Which privacy regime the site works under (Australian Privacy Act 1988 / APPs
 * or UK GDPR). Resolved from the site's operating-context pack. Configuration
 * alone does not prove legal compliance.
 */
export function useJurisdiction() {
  const { pack, loading } = useOperatingContext();
  const jurisdiction = pack.jurisdiction;
  const isUK = jurisdiction === "UK";

  return {
    jurisdiction,
    loading,
    isUK,
    regimeName: isUK ? "UK GDPR" : "Australian Privacy Act 1988",
    regimeShort: isUK ? "UK GDPR" : "Privacy Act 1988 (Cth)",
    principlesName: isUK ? "GDPR Articles" : "Australian Privacy Principles (APPs)",
    regulator: pack.privacy.regulator,
    controllerTerm: pack.privacy.controllerTerm,
    subjectAccessTerm: isUK ? "Subject Access Request (SAR)" : "Access Request (APP 12)",
    accessDeadline: isUK ? "30-day statutory deadline (Art. 15/20)" : "30-day response period (APP 12)",
    erasureRef: isUK ? "Art. 17" : "APP 11.2",
    portabilityRef: isUK ? "Art. 20" : "APP 12.5",
    retentionNote: pack.privacy.retentionNote,
    credentialLabels: pack.credentialLabels,
  };
}
