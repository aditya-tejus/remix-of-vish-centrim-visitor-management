import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { VisitorType, Visitor, CompanionDetail } from "@/types/visitor";
import { useActiveHealthQuestions, useActiveVaccinationFields } from "@/hooks/useHealthQuestions";
import { useCompanionFields } from "@/hooks/useFormFields";
import { useResidents } from "@/hooks/useResidents";
import { useStaffMembers } from "@/hooks/useStaffMembers";
import { supabase } from "@/integrations/supabase/client";
import { Supplier } from "@/hooks/useSuppliers";
import { FoodFormState, emptyFoodForm, isFoodFormValid } from "@/components/food/FoodFormFields";

export type StepId = "identify" | "details" | "food" | "screening" | "confirm";

export interface VisitorProfile {
  id: string;
  firstName: string;
  surname: string;
  mobile: string;
  email: string;
  address: string;
}

export interface CheckInFormData {
  firstName: string;
  surname: string;
  email: string;
  mobile: string;
  address: string;
  whomToVisit: "" | "Resident" | "Staff";
  selectPerson: string;
  comments: string;
  bodyTemperature: string;
  healthDeclaration: boolean;
  influenzaVaccineDate: string;
  covidDose1Date: string;
  covidDose2Date: string;
}

export function useCheckInFlow(open: boolean) {
  const { residents: dbResidents } = useResidents();
  const { staff: dbStaff } = useStaffMembers();

  const [step, setStep] = useState<StepId>("identify");
  const [selectedType, setSelectedType] = useState<VisitorType>("visitor");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProfile, setSelectedProfile] = useState<VisitorProfile | null>(null);
  const [previousVisitors, setPreviousVisitors] = useState<VisitorProfile[]>([]);
  const [isReturning, setIsReturning] = useState(false);

  const [formData, setFormData] = useState<CheckInFormData>({
    firstName: "", surname: "", email: "", mobile: "", address: "",
    whomToVisit: "", selectPerson: "", comments: "",
    bodyTemperature: "", healthDeclaration: false,
    influenzaVaccineDate: "", covidDose1Date: "", covidDose2Date: "",
  });

  const [healthAnswers, setHealthAnswers] = useState<Record<string, any>>({});
  const [overrideReason, setOverrideReason] = useState("");
  const [privacyAcknowledged, setPrivacyAcknowledged] = useState(false);
  const [companions, setCompanions] = useState<CompanionDetail[]>([]);
  const [photo, setPhoto] = useState<string | null>(null);
  const [checkInTimeOverride, setCheckInTimeOverride] = useState<string | null>(null);
  const [contractorScreeningAnswers, setContractorScreeningAnswers] = useState<Record<string, any>>({});
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [jurisdiction, setJurisdiction] = useState<"AU" | "UK">("AU");
  const [contractorGate, setContractorGate] = useState<{ blocked: boolean; reason: string | null }>({ blocked: false, reason: null });
  const [branchTcUrl, setBranchTcUrl] = useState<string | null>(null);
  const [branchPrivacyUrl, setBranchPrivacyUrl] = useState<string | null>(null);
  const [tcContent, setTcContent] = useState<string | null>(null);
  const [badgePrintingEnabled, setBadgePrintingEnabled] = useState(false);

  // Food register (visitors/volunteers visiting a resident)
  const [bringingFood, setBringingFood] = useState<boolean | null>(null);
  const [foodForm, setFoodForm] = useState<FoodFormState>(emptyFoodForm);

  // Dynamic settings-driven fields
  const { data: dbQuestions = [] } = useActiveHealthQuestions(selectedType as any);
  const { data: dbVaccFields = [] } = useActiveVaccinationFields(selectedType as any);
  const { data: companionFieldsConfig = [] } = useCompanionFields(selectedType as any);
  const activeCompanionFields = companionFieldsConfig.filter((f) => f.is_active).sort((a, b) => a.sort_order - b.sort_order);

  const fallbackHealthQuestions = [
    { id: "fever", question: "Do you have a fever or feel unusually warm?", type: "yesno" as const, required: true },
    { id: "cough", question: "Do you have a new continuous cough?", type: "yesno" as const, required: true },
    { id: "consent_screening", question: "I consent to compliance screening and temperature check", type: "checkbox" as const, required: true },
  ];
  const healthQuestions = dbQuestions.length > 0 ? dbQuestions : fallbackHealthQuestions;

  const residentItems = useMemo(() => dbResidents.map(r => ({ id: r.visitorId, name: r.name, room: r.room, wing: r.wing })), [dbResidents]);
  const staffItems = useMemo(() => dbStaff.map(s => ({ id: s.id, name: s.name, role: s.role, department: s.department || "" })), [dbStaff]);

  // Food register only applies to visitors/volunteers who are visiting a resident
  const selectedResident = useMemo(
    () => residentItems.find((r) => r.name === formData.selectPerson) || null,
    [residentItems, formData.selectPerson]
  );
  const foodStepApplies =
    (selectedType === "visitor" || selectedType === "volunteer") &&
    formData.whomToVisit === "Resident" &&
    !!selectedResident;

  // Assemble step pipeline dynamically
  const steps = useMemo<StepId[]>(() => {
    const pipeline: StepId[] = ["identify"];

    // Details always shown (even for returning, they might want to edit)
    pipeline.push("details");

    if (foodStepApplies) pipeline.push("food");

    // Screening: only if there are health questions OR it's a contractor
    const hasScreening = selectedType === "contractor" || healthQuestions.length > 0 || dbVaccFields.length > 0;
    if (hasScreening) {
      pipeline.push("screening");
    }

    pipeline.push("confirm");
    return pipeline;
  }, [selectedType, healthQuestions.length, dbVaccFields.length, foodStepApplies]);

  const currentStepIndex = steps.indexOf(step);
  const totalSteps = steps.length;
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === totalSteps - 1;

  // Load settings (including dynamic T&C content per type)
  useEffect(() => {
    supabase
      .from("settings")
      .select("key, value")
      .in("key", [
        "branch_tc_url", "branch_privacy_url", "show_branch_docs_in_form", "jurisdiction",
        "badge_printing_enabled",
        `tc_content_${selectedType}`,
      ])
      .then(({ data }) => {
        if (data) {
          const map: Record<string, string> = {};
          data.forEach((r: any) => { map[r.key] = r.value; });
          const showDocs = map.show_branch_docs_in_form !== "false";
          setBranchTcUrl(showDocs && map.branch_tc_url ? map.branch_tc_url : null);
          setBranchPrivacyUrl(showDocs && map.branch_privacy_url ? map.branch_privacy_url : null);
          setTcContent(map[`tc_content_${selectedType}`] || null);
          if (map.jurisdiction === "UK" || map.jurisdiction === "AU") setJurisdiction(map.jurisdiction);
          setBadgePrintingEnabled(map.badge_printing_enabled === "true");
        }
      });
  }, [selectedType]);

  // Fetch previous visitors
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setPreviousVisitors([]);
      return;
    }
    const q = searchQuery.toLowerCase();
    supabase
      .from("visitors")
      .select("id, first_name, surname, mobile, email, address")
      .or(`first_name.ilike.%${q}%,surname.ilike.%${q}%,mobile.ilike.%${q}%`)
      .neq("type", "resident")
      .order("check_in_time", { ascending: false })
      .limit(10)
      .then(({ data }) => {
        if (data) {
          const seen = new Set<string>();
          const unique: VisitorProfile[] = [];
          for (const r of data) {
            const key = `${r.first_name}|${r.surname}|${r.email}`.toLowerCase();
            if (!seen.has(key)) {
              seen.add(key);
              unique.push({
                id: r.id, firstName: r.first_name, surname: r.surname,
                mobile: r.mobile || "", email: r.email || "", address: r.address || "",
              });
            }
          }
          setPreviousVisitors(unique);
        }
      });
  }, [searchQuery]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return previousVisitors;
    const q = searchQuery.toLowerCase();
    return previousVisitors.filter(
      (p) => p.firstName.toLowerCase().includes(q) || p.surname.toLowerCase().includes(q) ||
        p.mobile.includes(q) || `${p.firstName} ${p.surname}`.toLowerCase().includes(q)
    );
  }, [searchQuery, previousVisitors]);

  const selectProfile = (profile: VisitorProfile) => {
    setSelectedProfile(profile);
    setIsReturning(true);
    setFormData((prev) => ({
      ...prev,
      firstName: profile.firstName, surname: profile.surname,
      email: profile.email, mobile: profile.mobile, address: profile.address,
    }));
  };

  const updateField = (field: string, value: string | number | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const goNext = () => {
    const nextIdx = currentStepIndex + 1;
    if (nextIdx < totalSteps) setStep(steps[nextIdx]);
  };

  const goBack = () => {
    const prevIdx = currentStepIndex - 1;
    if (prevIdx >= 0) setStep(steps[prevIdx]);
  };

  const resetForm = () => {
    setStep("identify");
    setSelectedType("visitor");
    setSearchQuery("");
    setSelectedProfile(null);
    setIsReturning(false);
    setFormData({
      firstName: "", surname: "", email: "", mobile: "", address: "",
      whomToVisit: "", selectPerson: "", comments: "",
      bodyTemperature: "", healthDeclaration: false,
      influenzaVaccineDate: "", covidDose1Date: "", covidDose2Date: "",
    });
    setHealthAnswers({});
    setOverrideReason("");
    setPrivacyAcknowledged(false);
    setCompanions([]);
    setPhoto(null);
    setCheckInTimeOverride(null);
    setContractorScreeningAnswers({});
    setSelectedSupplier(null);
    setBringingFood(null);
    setFoodForm(emptyFoodForm);
  };

  // Health screening gate (attended desk: staff may override with a recorded reason)
  const hasSymptomFlag = Object.values(healthAnswers).some((v) => v === true);
  const hasHighTemperature = !!formData.bodyTemperature && parseFloat(formData.bodyTemperature) > 37.8;
  const screeningFlagged = hasSymptomFlag || hasHighTemperature;
  const overrideValid = overrideReason.trim().length >= 3;

  // The screening step owns credential evaluation and reports the gate up
  const contractorBlocked = selectedType === "contractor" && contractorGate.blocked;

  const canProceed = useMemo(() => {
    switch (step) {
      case "identify":
        return true; // Can always proceed (new or returning)
      case "details":
        return !!(formData.firstName && formData.surname);
      case "food":
        return bringingFood === false || (bringingFood === true && isFoodFormValid(foodForm));
      case "screening":
        // Contractors are blocked when the highest-risk credential is missing/expired
        return !contractorBlocked;
      case "confirm":
        return privacyAcknowledged && !contractorBlocked && (!screeningFlagged || overrideValid);
      default:
        return true;
    }
  }, [step, formData, privacyAcknowledged, screeningFlagged, overrideValid, contractorBlocked, bringingFood, foodForm]);


  const buildVisitor = (): Omit<Visitor, "id"> => {
    const allHealthClear = Object.values(healthAnswers).every((v) => v === false);
    return {
      firstName: formData.firstName,
      surname: formData.surname,
      email: formData.email,
      mobile: formData.mobile,
      type: selectedType,
      checkInTime: checkInTimeOverride ? (() => { const now = new Date(); const [h, m] = checkInTimeOverride.split(":").map(Number); now.setHours(h, m, 0, 0); return now; })() : new Date(),
      checkOutTime: null,
      whomToVisit: formData.selectPerson,
      address: formData.address,
      status: "checked-in",
      healthDeclaration: allHealthClear && formData.healthDeclaration,
      additionalVisitors: companions.length,
      companionDetails: companions.length > 0 ? companions : undefined,
      comments: formData.comments,
      bodyTemperature: formData.bodyTemperature ? parseFloat(formData.bodyTemperature) : undefined,
      influenzaVaccineDate: formData.influenzaVaccineDate || undefined,
      covidDose1Date: formData.covidDose1Date || undefined,
      covidDose2Date: formData.covidDose2Date || undefined,
      retentionExpiry: new Date(Date.now() + 86400000 * 60),
      acknowledgedPrivacy: privacyAcknowledged,
      healthAnswers: { ...healthAnswers, ...contractorScreeningAnswers },
    };
  };

  return {
    // Step engine
    step, steps, currentStepIndex, totalSteps, isFirstStep, isLastStep,
    goNext, goBack, setStep,

    // Type
    selectedType, setSelectedType,

    // Search / returning visitor
    searchQuery, setSearchQuery, searchResults, selectedProfile, selectProfile, isReturning,

    // Form
    formData, updateField, setFormData,

    // Health / screening
    healthQuestions, healthAnswers, setHealthAnswers,
    dbVaccFields, contractorScreeningAnswers, setContractorScreeningAnswers,
    selectedSupplier, setSelectedSupplier, jurisdiction,
    contractorBlocked, contractorBlockReason: selectedType === "contractor" ? contractorGate.reason : null,
    setContractorGate,

    // Companions
    companions, setCompanions, activeCompanionFields,

    // Photo
    photo, setPhoto,

    // Privacy
    privacyAcknowledged, setPrivacyAcknowledged,
    branchTcUrl, branchPrivacyUrl, tcContent,

    // Time override
    checkInTimeOverride, setCheckInTimeOverride,

    // Resident/staff items for "visiting" dropdown
    residentItems, staffItems,

    // Actions
    canProceed, resetForm, buildVisitor,

    // Food register
    bringingFood, setBringingFood, foodForm, setFoodForm, foodStepApplies, selectedResident,

    // Badge printing
    badgePrintingEnabled,

    // Health screening override
    screeningFlagged, hasSymptomFlag, hasHighTemperature, overrideReason, setOverrideReason,
  };
}
