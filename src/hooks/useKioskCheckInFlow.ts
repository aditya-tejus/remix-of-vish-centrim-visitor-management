import { useState, useMemo, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFormFields, FormField } from "@/hooks/useFormFields";
import { useActiveHealthQuestions, useActiveVaccinationFields } from "@/hooks/useHealthQuestions";
import { useResidents } from "@/hooks/useResidents";
import { useStaffMembers } from "@/hooks/useStaffMembers";
import { useWatchlist } from "@/hooks/useWatchlist";
import type { VisitorType } from "@/types/visitor";

export type KioskStepId = "type" | "details" | "visiting" | "screening" | "contractor" | "terms" | "confirm";

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
  const [contractorAnswers, setContractorAnswers] = useState<Record<string, any>>({});
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  const [returningVisitor, setReturningVisitor] = useState<any>(null);

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
  const { residents } = useResidents();
  const { staff } = useStaffMembers();

  // Watchlist
  const { checkVisitor } = useWatchlist();

  // Load T&C content + jurisdiction
  useEffect(() => {
    supabase
      .from("settings")
      .select("key, value")
      .in("key", [`tc_content_${selectedType}`, "jurisdiction"])
      .then(({ data }) => {
        const tc = data?.find((d) => d.key === `tc_content_${selectedType}`);
        const jur = data?.find((d) => d.key === "jurisdiction");
        setTcContent(tc?.value || null);
        if (jur?.value === "AU" || jur?.value === "UK") setJurisdiction(jur.value);
      });
  }, [selectedType]);

  // Returning visitor search
  const searchReturningVisitor = useCallback(async (firstName: string, surname: string) => {
    if (!firstName.trim() || !surname.trim()) return null;
    const { data } = await supabase
      .from("visitors")
      .select("first_name, surname, email, mobile, address, whom_to_visit")
      .ilike("first_name", firstName.trim())
      .ilike("surname", surname.trim())
      .order("check_in_time", { ascending: false })
      .limit(1);
    if (data && data.length > 0) {
      const prev = data[0];
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
  }, [selectedType, healthQuestions.length, tcContent]);

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
    reset,
  };
}
