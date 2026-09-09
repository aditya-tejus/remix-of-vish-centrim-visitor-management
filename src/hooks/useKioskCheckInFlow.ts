import { useState, useMemo, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchKeyPolicy, DEFAULT_KEY_POLICY, type KeyPolicy } from "@/hooks/useKeyPolicy";
import { useFormFields, FormField } from "@/hooks/useFormFields";
import { resolveCheckInFields, missingCheckInFields, missingFieldsMessage, isFieldEnabled } from "@/lib/checkInFields";
import { useActiveHealthQuestions, useActiveVaccinationFields } from "@/hooks/useHealthQuestions";
import { useResidents } from "@/hooks/useResidents";
import { useStaffMembers } from "@/hooks/useStaffMembers";
import { useWatchlist } from "@/hooks/useWatchlist";
import type { VisitorType } from "@/types/visitor";
import { FoodFormState, emptyFoodForm, isFoodFormValid } from "@/components/food/FoodFormFields";
import { usePersonTypes } from "@/hooks/usePersonTypes";
import { useOperatingContext, siteScopedKey } from "@/contexts/OperatingContext";
import { resolveTermsContent } from "@/lib/segmentPacks";
import { resolveScreeningPolicy, screeningStepApplies } from "@/lib/screeningPolicy";
import { evaluateScreening, type ScreeningRuleQuestion } from "@/lib/screeningOutcome";
import { kioskRpc } from "@/lib/kioskRpc";

export type KioskStepId = "type" | "details" | "visiting" | "food" | "companions" | "screening" | "contractor" | "terms" | "confirm";

export interface KioskStep {
  id: KioskStepId;
  label: string;
}

export function useKioskCheckInFlow() {
  const [selectedType, setSelectedType] = useState<VisitorType>("visitor");
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [healthAnswers, setHealthAnswers] = useState<Record<string, any>>({});
  const [privacyAcknowledged, setPrivacyAcknowledged] = useState(false);
  const [tcContent, setTcContent] = useState<string | null>(null);
  const [jurisdiction, setJurisdiction] = useState<"AU" | "UK">("UK");
  const [contractorGate, setContractorGate] = useState<{ blocked: boolean; reason: string | null }>({ blocked: false, reason: null });
  const [keyPolicy, setKeyPolicy] = useState<KeyPolicy>(DEFAULT_KEY_POLICY);
  const [overdueKeyCount, setOverdueKeyCount] = useState(0);
  const [residentLookupMode, setResidentLookupMode] = useState<"show_all" | "search_first">("search_first");
  const [staffLookupMode, setStaffLookupMode] = useState<"search_first" | "by_department" | "free_text">("search_first");
  const [returningOptions, setReturningOptions] = useState({ mobile: false, qr: false, name: false, suggestResident: false });
  const [personQr, setPersonQr] = useState<string | null>(null);

  // The kiosk cannot read the keys register. It asks a narrow server check that
  // answers with counts only, and only for a recognised person code.
  useEffect(() => {
    fetchKeyPolicy().then(setKeyPolicy);
  }, []);
  useEffect(() => {
    let cancelled = false;
    if (!personQr) { setOverdueKeyCount(0); return; }
    kioskRpc<any[]>("kioskd_open_key_holds", { p_person_qr: personQr }).then(({ data }: any) => {
      if (!cancelled) setOverdueKeyCount(Number(data?.[0]?.overdue_items ?? 0));
    });
    return () => { cancelled = true; };
  }, [personQr]);

  const [contractorAnswers, setContractorAnswers] = useState<Record<string, any>>({});
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  const [returningVisitor, setReturningVisitor] = useState<any>(null);
  const [companions, setCompanions] = useState<Array<{ id: string; firstName: string; surname: string; email: string; mobile: string }>>([]);
  const [hasCompanions, setHasCompanions] = useState<boolean | null>(null);
  const [outbreakMode, setOutbreakMode] = useState(false);
  const [badgePrintingEnabled, setBadgePrintingEnabled] = useState(false);
  const [foodStepEnabled, setFoodStepEnabled] = useState(true);

  const [bringingFood, setBringingFood] = useState<boolean | null>(null);
  const [foodForm, setFoodForm] = useState<FoodFormState>(emptyFoodForm);
  const [visitedResidentId, setVisitedResidentId] = useState<string | null>(null);

  // Operating context and per-person-type rules (Stage 4)
  const { modules, terms, pack, siteId } = useOperatingContext();
  const { personTypes } = usePersonTypes();
  const typeConfig = useMemo(
    () => personTypes.find((t) => t.type === (selectedType as any)),
    [personTypes, selectedType]
  );
  const destinationRequired = typeConfig?.destinationRequired ?? selectedType !== "contractor";
  // Exactly the same rule set as the front desk.
  const policy = useMemo(() => resolveScreeningPolicy(typeConfig || null), [typeConfig]);
  const screeningApplies = policy.screeningEnabled;
  const privacyApplies = policy.privacyRequired;
  const badgeApplies = typeConfig?.badgeApplies ?? true;

  // Dynamic form fields
  const { data: formFields = [] } = useFormFields(selectedType as any);
  const activeFormFields = useMemo(
    () => formFields.filter((f) => f.is_active && !f.field_key.startsWith("companion_")).sort((a, b) => a.sort_order - b.sort_order),
    [formFields]
  );
  // Same resolver as the staff desk, so kiosk and reception can never diverge.
  const activeFields = useMemo(() => resolveCheckInFields(formFields), [formFields]);

  // Health questions
  const { data: dbHealthQuestions = [] } = useActiveHealthQuestions(selectedType as any);
  const healthQuestions = policy.screeningEnabled ? dbHealthQuestions : [];

  // Vaccination fields
  const { data: dbVaccinationFields = [] } = useActiveVaccinationFields(selectedType as any);
  const vaccinationFields = policy.vaccinationEnabled ? dbVaccinationFields : [];

  // Residents & staff for "who are you visiting" picker
  const { residents } = useResidents({ publicMode: true, siteId });
  const { staff } = useStaffMembers({ publicMode: true, siteId });

  // Watchlist
  const { checkVisitorRemote } = useWatchlist({ publicMode: true, siteId });

  // Load T&C content + jurisdiction
  useEffect(() => {
    supabase
      .from("settings")
      .select("key, value")
      .in("key", [`tc_content_${selectedType}`, siteScopedKey(`tc_content_${selectedType}`, siteId), "jurisdiction", "kiosk_resident_lookup_mode", `kiosk_resident_lookup_mode_${selectedType}`, "kiosk_staff_lookup_mode", `kiosk_staff_lookup_mode_${selectedType}`, "outbreak_mode", "badge_printing_enabled", `food_register_checkin_${selectedType}`, `kiosk_returning_mobile_${selectedType}`, `kiosk_returning_qr_${selectedType}`, `kiosk_returning_name_${selectedType}`, `kiosk_suggest_last_resident_${selectedType}`])
      .then(({ data }) => {
        const tc = data?.find((d) => d.key === `tc_content_${selectedType}`);
        const jur = data?.find((d) => d.key === "jurisdiction");
        // Prefer type-specific resident lookup mode, fall back to global
        const rlmSpecific = data?.find((d) => d.key === `kiosk_resident_lookup_mode_${selectedType}`);
        const rlmGlobal = data?.find((d) => d.key === "kiosk_resident_lookup_mode");
        const rlmValue = rlmSpecific?.value || rlmGlobal?.value;
        // Prefer type-specific staff lookup mode, fall back to global
        const slmSpecific = data?.find((d) => d.key === `kiosk_staff_lookup_mode_${selectedType}`);
        const slmGlobal = data?.find((d) => d.key === "kiosk_staff_lookup_mode");
        const slmValue = slmSpecific?.value || slmGlobal?.value;
        const siteTc = data?.find((d) => d.key === siteScopedKey(`tc_content_${selectedType}`, siteId));
        const accountJur = jur?.value === "AU" || jur?.value === "UK" ? jur.value : null;
        setTcContent(resolveTermsContent(siteTc?.value, tc?.value, accountJur, pack));
        setJurisdiction(pack.jurisdiction);
        setOutbreakMode(data?.find((d) => d.key === "outbreak_mode")?.value === "true");
        setBadgePrintingEnabled(data?.find((d) => d.key === "badge_printing_enabled")?.value === "true");
        setFoodStepEnabled(data?.find((d) => d.key === `food_register_checkin_${selectedType}`)?.value !== "false");
        if (rlmValue === "show_all" || rlmValue === "search_first") setResidentLookupMode(rlmValue);
        if (slmValue === "search_first" || slmValue === "by_department" || slmValue === "free_text") setStaffLookupMode(slmValue);
        const isOn = (key: string) => data?.find((d) => d.key === key)?.value === "true";
        setReturningOptions({
          mobile: isOn(`kiosk_returning_mobile_${selectedType}`),
          qr: isOn(`kiosk_returning_qr_${selectedType}`),
          name: isOn(`kiosk_returning_name_${selectedType}`),
          suggestResident: isOn(`kiosk_suggest_last_resident_${selectedType}`),
        });
      });
  }, [selectedType, siteId, pack]);

  // Returning visitor lookup — restricted database helper that returns at most one
  // person's own saved details. The kiosk never reads the visitor table directly.
  const lookupReturningVisitor = useCallback(
    async (params: { firstName?: string; surname?: string; mobile?: string; qr?: string }) => {
      const hasName = !!params.firstName?.trim() && !!params.surname?.trim();
      const hasMobile = (params.mobile || "").replace(/\D/g, "").length >= 6;
      const hasQr = !!params.qr?.trim();
      if (!hasName && !hasMobile && !hasQr) return null;

      const { data } = await kioskRpc<any[]>("kioskd_returning_lookup", {
        p_first: hasName ? params.firstName!.trim() : null,
        p_last: hasName ? params.surname!.trim() : null,
        p_mobile: hasMobile ? params.mobile!.trim() : null,
        p_qr: hasQr ? params.qr!.trim().toUpperCase() : null,
      });
      const prev = Array.isArray(data) ? (data[0] as any) : null;
      if (!prev) return null;
      return {
        firstName: prev.first_name || "",
        surname: prev.surname || "",
        email: prev.email || "",
        mobile: prev.mobile || "",
        address: prev.address || "",
        whomToVisit: prev.whom_to_visit || "",
        lastResidentId: Array.isArray(prev.visited_resident_ids) ? prev.visited_resident_ids[0] || null : null,
        personQr: prev.person_qr || null,
        lastVisit: prev.last_visit || null,
      };
    },
    [siteId]
  );

  // Legacy name-only prefill used on the details step
  const searchReturningVisitor = useCallback(
    async (firstName: string, surname: string) => {
      const match = await lookupReturningVisitor({ firstName, surname });
      if (!match) return null;
      return {
        email: match.email,
        mobile: match.mobile,
        address: match.address,
        whomToVisit: match.whomToVisit,
      };
    },
    [lookupReturningVisitor]
  );



  // Build dynamic step pipeline
  const steps = useMemo<KioskStep[]>(() => {
    const pipeline: KioskStep[] = [{ id: "type", label: "Type" }];
    pipeline.push({ id: "details", label: "Your Details" });
    // Visiting step for non-contractor types
    if (selectedType !== "contractor" && destinationRequired) {
      pipeline.push({ id: "visiting", label: "Visiting" });
    }
    // Food register — visitors/volunteers visiting a resident
    if (foodStepEnabled && modules.foodRegister && (selectedType === "visitor" || selectedType === "volunteer") && visitedResidentId) {
      pipeline.push({ id: "food", label: "Food" });
    }
    // Companions step (always after visiting/contractor)
    pipeline.push({ id: "companions", label: "Companions" });
    // Contractor screening
    if (selectedType === "contractor") {
      pipeline.push({ id: "contractor", label: "Screening" });
    }
    // Health screening (if questions configured)
    if (screeningStepApplies(policy, { questionCount: healthQuestions.length, vaccinationFieldCount: vaccinationFields.length })) {
      pipeline.push({ id: "screening", label: "Health" });
    }
    // T&C
    if (privacyApplies && tcContent) {
      pipeline.push({ id: "terms", label: "Terms" });
    }
    pipeline.push({ id: "confirm", label: "Review" });
    return pipeline;
  }, [selectedType, policy, vaccinationFields.length, healthQuestions.length, tcContent, visitedResidentId, foodStepEnabled, destinationRequired, screeningApplies, privacyApplies, modules.foodRegister]);

  const updateField = (key: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
  };

  const reset = () => {
    setFormValues({});
    setHealthAnswers({});
    setPrivacyAcknowledged(false);
    setContractorAnswers({});
    setSelectedSupplier(null);
    setReturningVisitor(null);
    setSelectedType("visitor");
    setCompanions([]);
    setHasCompanions(null);
    setBringingFood(null);
    setFoodForm(emptyFoodForm);
    setVisitedResidentId(null);
    setPersonQr(null);
  };


  // Same validation contract as the staff desk: names always, plus whatever
  // this site has configured for this person type.
  const missingFields = useMemo(
    () => missingCheckInFields(formValues, activeFields),
    [formValues, activeFields]
  );
  const missingFieldsHint = missingFieldsMessage(missingFields);
  const detailsValid = missingFields.length === 0;

  // Temperature can arrive either as a form field or as a numeric screening answer
  const bodyTemperature = useMemo(() => {
    const candidates: unknown[] = [
      formValues.bodyTemperature,
      formValues.body_temperature,
      formValues.temperature,
      ...Object.entries(healthAnswers)
        .filter(([k]) => k.toLowerCase().includes("temp"))
        .map(([, v]) => v),
    ];
    for (const c of candidates) {
      const n = parseFloat(String(c ?? ""));
      if (!Number.isNaN(n) && n > 0) return n;
    }
    return null;
  }, [formValues, healthAnswers]);

  // Same configured rules as the desk. The kiosk has no override: a blocked
  // outcome always sends the person to reception.
  const evaluation = useMemo(
    () => evaluateScreening(healthQuestions as unknown as ScreeningRuleQuestion[], healthAnswers, { bodyTemperature }),
    [healthQuestions, healthAnswers, bodyTemperature]
  );
  const hasYesFlags = evaluation.flags.some((f) => f.questionId !== "body_temperature");
  const highTemperature = evaluation.flags.some((f) => f.questionId === "body_temperature");
  const screeningFlagged = evaluation.flagged;
  // Unattended kiosk: a rule that blocks, or any concern during Outbreak Mode,
  // hard-stops the check-in and asks the person to see reception.
  const screeningBlocked = evaluation.blocked || (outbreakMode && screeningFlagged);

  // Outstanding keys or fobs: at an unattended kiosk we ask the person to see
  // reception rather than silently letting them in.
  const fullName = `${(formValues.firstName || "").trim()} ${(formValues.surname || "").trim()}`.trim();
  const keyBlocked = keyPolicy.enforcement === "block" && overdueKeyCount > 0;

  const foodStepValid = bringingFood === false || (bringingFood === true && isFoodFormValid(foodForm));


  return {
    typeConfig,
    destinationRequired,
    screeningApplies,
    privacyApplies,
    badgeApplies,
    terms,
    modules,
    selectedType,
    setSelectedType,
    formValues,
    updateField,
    setFormValues,
    healthAnswers,
    setHealthAnswers,
    privacyAcknowledged,
    setPrivacyAcknowledged,
    tcContent,
    jurisdiction,
    contractorBlocked: selectedType === "contractor" && contractorGate.blocked,
    contractorBlockReason: selectedType === "contractor" ? contractorGate.reason : null,
    setContractorGate,
    contractorAnswers,
    setContractorAnswers,
    selectedSupplier,
    setSelectedSupplier,
    returningVisitor,
    setReturningVisitor,
    searchReturningVisitor,
    lookupReturningVisitor,
    returningOptions,
    personQr,
    setPersonQr,
    steps,
    activeFormFields,
    activeFields,
    missingFields,
    missingFieldsHint,
    isFieldOn: (key: string) => isFieldEnabled(activeFields, key),

    policy,
    screeningEvaluation: evaluation,
    healthQuestions,
    vaccinationFields,
    residents,
    staff,
    checkVisitor: checkVisitorRemote,
    detailsValid,
    hasYesFlags,
    bodyTemperature,
    highTemperature,
    screeningBlocked,
    screeningFlagged,
    overdueKeyCount,
    keyBlocked,
    keyEnforcement: keyPolicy.enforcement,
    outbreakMode,
    badgePrintingEnabled: badgePrintingEnabled && badgeApplies,
    bringingFood,
    setBringingFood,
    foodForm,
    setFoodForm,
    foodStepValid,
    visitedResidentId,
    setVisitedResidentId,

    reset,
    residentLookupMode,
    staffLookupMode,
    companions,
    setCompanions,
    hasCompanions,
    setHasCompanions,
  };
}
