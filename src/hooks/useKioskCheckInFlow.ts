import { useState, useMemo, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFormFields, FormField } from "@/hooks/useFormFields";
import { useActiveHealthQuestions, useActiveVaccinationFields } from "@/hooks/useHealthQuestions";
import { useResidents } from "@/hooks/useResidents";
import { useStaffMembers } from "@/hooks/useStaffMembers";
import { useWatchlist } from "@/hooks/useWatchlist";
import type { VisitorType } from "@/types/visitor";
import { FoodFormState, emptyFoodForm, isFoodFormValid } from "@/components/food/FoodFormFields";

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
  const [residentLookupMode, setResidentLookupMode] = useState<"show_all" | "search_first">("search_first");
  const [staffLookupMode, setStaffLookupMode] = useState<"search_first" | "by_department" | "free_text">("search_first");
  const [returningOptions, setReturningOptions] = useState({ mobile: false, qr: false, name: false, suggestResident: false });
  const [personQr, setPersonQr] = useState<string | null>(null);

  const [contractorAnswers, setContractorAnswers] = useState<Record<string, any>>({});
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  const [returningVisitor, setReturningVisitor] = useState<any>(null);
  const [companions, setCompanions] = useState<Array<{ id: string; firstName: string; surname: string; email: string; mobile: string }>>([]);
  const [hasCompanions, setHasCompanions] = useState<boolean | null>(null);
  const [outbreakMode, setOutbreakMode] = useState(false);
  const [badgePrintingEnabled, setBadgePrintingEnabled] = useState(false);
  const [bringingFood, setBringingFood] = useState<boolean | null>(null);
  const [foodForm, setFoodForm] = useState<FoodFormState>(emptyFoodForm);
  const [visitedResidentId, setVisitedResidentId] = useState<string | null>(null);

  // Dynamic form fields
  const { data: formFields = [] } = useFormFields(selectedType as any);
  const activeFormFields = useMemo(
    () => formFields.filter((f) => f.is_active && !f.field_key.startsWith("companion_")).sort((a, b) => a.sort_order - b.sort_order),
    [formFields]
  );

  // Health questions
  const { data: healthQuestions = [] } = useActiveHealthQuestions(selectedType as any);

  // Vaccination fields
  const { data: vaccinationFields = [] } = useActiveVaccinationFields(selectedType as any);

  // Residents & staff for "who are you visiting" picker
  const { residents } = useResidents({ publicMode: true });
  const { staff } = useStaffMembers();

  // Watchlist
  const { checkVisitor } = useWatchlist();

  // Load T&C content + jurisdiction
  useEffect(() => {
    supabase
      .from("settings")
      .select("key, value")
      .in("key", [`tc_content_${selectedType}`, "jurisdiction", "kiosk_resident_lookup_mode", `kiosk_resident_lookup_mode_${selectedType}`, "kiosk_staff_lookup_mode", `kiosk_staff_lookup_mode_${selectedType}`, "outbreak_mode", "badge_printing_enabled"])
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
        setTcContent(tc?.value || null);
        if (jur?.value === "AU" || jur?.value === "UK") setJurisdiction(jur.value);
        setOutbreakMode(data?.find((d) => d.key === "outbreak_mode")?.value === "true");
        setBadgePrintingEnabled(data?.find((d) => d.key === "badge_printing_enabled")?.value === "true");
        if (rlmValue === "show_all" || rlmValue === "search_first") setResidentLookupMode(rlmValue);
        if (slmValue === "search_first" || slmValue === "by_department" || slmValue === "free_text") setStaffLookupMode(slmValue);
      });
  }, [selectedType]);

  // Returning visitor search
  const searchReturningVisitor = useCallback(async (firstName: string, surname: string) => {
    if (!firstName.trim() || !surname.trim()) return null;
    // Uses a restricted database helper — the kiosk cannot read the visitor table directly
    const { data } = await supabase.rpc("kiosk_prefill_visitor" as any, {
      p_first: firstName.trim(),
      p_last: surname.trim(),
    });
    const prev = Array.isArray(data) ? (data[0] as any) : null;
    if (prev) {
      return {
        email: prev.email || "",
        mobile: prev.mobile || "",
        address: prev.address || "",
        whomToVisit: prev.whom_to_visit || "",
      };
    }
    return null;
  }, []);


  // Build dynamic step pipeline
  const steps = useMemo<KioskStep[]>(() => {
    const pipeline: KioskStep[] = [{ id: "type", label: "Type" }];
    pipeline.push({ id: "details", label: "Your Details" });
    // Visiting step for non-contractor types
    if (selectedType !== "contractor") {
      pipeline.push({ id: "visiting", label: "Visiting" });
    }
    // Food register — visitors/volunteers visiting a resident
    if ((selectedType === "visitor" || selectedType === "volunteer") && visitedResidentId) {
      pipeline.push({ id: "food", label: "Food" });
    }
    // Companions step (always after visiting/contractor)
    pipeline.push({ id: "companions", label: "Companions" });
    // Contractor screening
    if (selectedType === "contractor") {
      pipeline.push({ id: "contractor", label: "Screening" });
    }
    // Health screening (if questions configured)
    if (healthQuestions.length > 0) {
      pipeline.push({ id: "screening", label: "Health" });
    }
    // T&C
    if (tcContent) {
      pipeline.push({ id: "terms", label: "Terms" });
    }
    pipeline.push({ id: "confirm", label: "Review" });
    return pipeline;
  }, [selectedType, healthQuestions.length, tcContent, visitedResidentId]);

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
  };

  // Check if details step has required fields filled
  const detailsValid = useMemo(() => {
    // Always require firstName + surname
    if (!formValues.firstName?.trim() || !formValues.surname?.trim()) return false;
    // Check dynamic required fields
    for (const field of activeFormFields) {
      if (field.required && !formValues[field.field_key]?.trim()) return false;
    }
    return true;
  }, [formValues, activeFormFields]);

  const hasYesFlags = healthQuestions.some((q) => q.type === "yesno" && healthAnswers[q.id] === true);

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

  const highTemperature = bodyTemperature !== null && bodyTemperature > 37.8;
  const screeningFlagged = hasYesFlags || highTemperature;
  // Unattended kiosk: during Outbreak Mode a positive symptom or high temperature
  // hard-stops the check-in. Outside outbreak periods it is flagged for staff instead.
  const screeningBlocked = outbreakMode && screeningFlagged;

  const foodStepValid = bringingFood === false || (bringingFood === true && isFoodFormValid(foodForm));


  return {
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
    steps,
    activeFormFields,
    healthQuestions,
    vaccinationFields,
    residents,
    staff,
    checkVisitor,
    detailsValid,
    hasYesFlags,
    bodyTemperature,
    highTemperature,
    screeningBlocked,
    screeningFlagged,
    outbreakMode,
    badgePrintingEnabled,
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
