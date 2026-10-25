import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { VisitorType, Visitor, CompanionDetail } from "@/types/visitor";
import { useActiveHealthQuestions, useActiveVaccinationFields } from "@/hooks/useHealthQuestions";
import { usePersonTypes } from "@/hooks/usePersonTypes";
import { resolveScreeningPolicy, screeningStepApplies } from "@/lib/screeningPolicy";
import { evaluateScreening, type ScreeningRuleQuestion } from "@/lib/screeningOutcome";
import { useCompanionFields, useFormFields } from "@/hooks/useFormFields";
import { mergeCompanionFields, missingCompanionFields, normaliseCompanion } from "@/lib/companionFields";
import {
  resolveCheckInFields,
  missingCheckInFields,
  missingFieldsMessage,
  pickEnabledValues,
} from "@/lib/checkInFields";
import { useResidents } from "@/hooks/useResidents";
import { useStaffMembers } from "@/hooks/useStaffMembers";
import { supabase } from "@/integrations/supabase/client";
import { Supplier } from "@/hooks/useSuppliers";
import { FoodFormState, emptyFoodForm, isFoodFormValid } from "@/components/food/FoodFormFields";
import { useOperatingContext, siteScopedKey } from "@/contexts/OperatingContext";
import { resolveTermsContent } from "@/lib/segmentPacks";
import { missingRequiredAnswers, staffCheckInIssues } from "@/lib/staffCheckInRules";
import { useOpenKeyIssues } from "@/hooks/useOpenKeyIssues";
import { useSite } from "@/contexts/SiteContext";


export type StepId = "identify" | "details" | "food" | "screening" | "confirm";

export interface VisitorProfile {
  id: string;
  firstName: string;
  surname: string;
  mobile: string;
  email: string;
  address: string;
  personQr?: string;
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

export interface StaffCheckInPrefill {
  firstName?: string; surname?: string; mobile?: string; email?: string; address?: string; type?: VisitorType;
}

export function useCheckInFlow(open: boolean, initialType?: VisitorType, prefill?: StaffCheckInPrefill) {
  const { pack, siteId } = useOperatingContext();
  const { currentSiteId, isLegacySite } = useSite();
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
  const [overrideApprovedBy, setOverrideApprovedBy] = useState<string | null>(null);
  const [privacyAcknowledged, setPrivacyAcknowledged] = useState(false);
  const [companions, setCompanions] = useState<CompanionDetail[]>([]);
  // Held for the whole attempt, including retries, so one arrival is saved once.
  const [requestId, setRequestId] = useState<string>(() => crypto.randomUUID());
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
  const [foodStepEnabled, setFoodStepEnabled] = useState(true);


  // Dynamic settings-driven fields
  const { personTypes, extras, loading: typesLoading } = usePersonTypes();
  const { overdueForName, policy: keyPolicy } = useOpenKeyIssues();
  const [keyOverrideReason, setKeyOverrideReason] = useState("");
  const [volunteerRole, setVolunteerRole] = useState("");
  const [volunteerSupervisor, setVolunteerSupervisor] = useState("");
  const [volunteerExpectedEnd, setVolunteerExpectedEnd] = useState("");
  const [otherReason, setOtherReason] = useState("");
  const openedRef = useRef(false);
  useEffect(() => {
    if (!open) { openedRef.current = false; return; }
    if (openedRef.current) return;
    openedRef.current = true;
    setSelectedType(prefill?.type || initialType || "visitor");
    if (prefill) {
      setFormData(prev => ({ ...prev, firstName: prefill.firstName || "", surname: prefill.surname || "", mobile: prefill.mobile || "", email: prefill.email || "", address: prefill.address || "" }));
      setIsReturning(true);
    }
  }, [open, initialType, prefill]);
  const personConfig = personTypes.find(p => p.type === selectedType);
  const overdueKeys = overdueForName(`${formData.firstName} ${formData.surname}`.trim());
  const keyBlocked = keyPolicy.enforcement === "block" && overdueKeys.length > 0 && keyOverrideReason.trim().length < 3;
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsError, setSettingsError] = useState(false);
  // One shared rule set for the desk and the kiosk.
  const policy = useMemo(
    () => resolveScreeningPolicy(personTypes.find((p) => p.type === (selectedType as any)) || null),
    [personTypes, selectedType]
  );
  const { data: dbQuestions = [], isPending: questionsLoading, isError: questionsError } = useActiveHealthQuestions(selectedType as any);
  const { data: dbVaccFields = [], isPending: vaccinationsLoading, isError: vaccinationsError } = useActiveVaccinationFields(selectedType as any);
  const { data: companionFieldsConfig = [], isPending: companionsLoading, isError: companionsError } = useCompanionFields(selectedType as any);
  const { data: mainVisitorFields = [], isPending: fieldsLoading, isError: fieldsError } = useFormFields(selectedType as any, "");

  // Companion-only fields, plus the main visitor's own fields where they still
  // make sense for a second person on the same arrival.
  const activeCompanionFields = useMemo(
    () => mergeCompanionFields(companionFieldsConfig, mainVisitorFields),
    [companionFieldsConfig, mainVisitorFields]
  );
  // Exactly what this site asks the person at the desk, in order. Nothing is
  // shown, validated or written unless it is configured for this person type.
  const activeFields = useMemo(() => resolveCheckInFields(mainVisitorFields), [mainVisitorFields]);
  const missingFields = useMemo(
    () => missingCheckInFields(formData as unknown as Record<string, unknown>, activeFields),
    [formData, activeFields]
  );
  const missingFieldsHint = missingFieldsMessage(missingFields);

  // Nothing is invented: if a site has switched check-in questions off, or has
  // configured none, the desk asks nothing.
  const healthQuestions = policy.screeningEnabled ? dbQuestions : [];
  const vaccinationFields = policy.vaccinationEnabled ? dbVaccFields : [];


  const residentItems = useMemo(() => dbResidents.map(r => ({ id: r.visitorId, name: r.name, room: r.room, wing: r.wing })), [dbResidents]);
  const staffItems = useMemo(() => dbStaff.map(s => ({ id: s.id, name: s.name, role: s.role, department: s.department || "" })), [dbStaff]);

  // Food register only applies to visitors/volunteers who are visiting a resident
  const selectedResident = useMemo(
    () => residentItems.find((r) => r.name === formData.selectPerson) || null,
    [residentItems, formData.selectPerson]
  );
  const foodStepApplies =
    foodStepEnabled &&
    (selectedType === "visitor" || selectedType === "volunteer") &&
    formData.whomToVisit === "Resident" &&
    !!selectedResident;


  // Assemble step pipeline dynamically
  const steps = useMemo<StepId[]>(() => {
    const pipeline: StepId[] = ["identify"];

    // Details always shown (even for returning, they might want to edit)
    pipeline.push("details");

    if (foodStepApplies) pipeline.push("food");

    // Screening: only when this site asks this person type something
    if (
      screeningStepApplies(policy, {
        questionCount: healthQuestions.length,
        vaccinationFieldCount: vaccinationFields.length,
        isContractor: selectedType === "contractor",
      })
    ) {
      pipeline.push("screening");
    }

    pipeline.push("confirm");
    return pipeline;
  }, [selectedType, healthQuestions.length, vaccinationFields.length, foodStepApplies, policy]);


  const currentStepIndex = steps.indexOf(step);
  const totalSteps = steps.length;
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === totalSteps - 1;

  // Load settings (including dynamic T&C content per type)
  useEffect(() => {
    let cancelled = false;
    setSettingsLoading(true);
    supabase
      .from("settings")
      .select("key, value")
      .in("key", [
        "branch_tc_url", "branch_privacy_url", "show_branch_docs_in_form", "jurisdiction",
        "badge_printing_enabled",
        `tc_content_${selectedType}`,
        siteScopedKey(`tc_content_${selectedType}`, siteId),
        `food_register_checkin_${selectedType}`,
      ])

      .then(({ data, error }) => {
        if (cancelled) return;
        setSettingsError(!!error);
        setSettingsLoading(false);
        if (data) {
          const map: Record<string, string> = {};
          data.forEach((r: any) => { map[r.key] = r.value; });
          const showDocs = map.show_branch_docs_in_form !== "false";
          setBranchTcUrl(showDocs && map.branch_tc_url ? map.branch_tc_url : null);
          setBranchPrivacyUrl(showDocs && map.branch_privacy_url ? map.branch_privacy_url : null);
          const accountJur = map.jurisdiction === "UK" || map.jurisdiction === "AU" ? map.jurisdiction : null;
          setTcContent(
            resolveTermsContent(
              map[siteScopedKey(`tc_content_${selectedType}`, siteId)],
              map[`tc_content_${selectedType}`],
              accountJur,
              pack
            )
          );
          setJurisdiction(pack.jurisdiction);
          setBadgePrintingEnabled(map.badge_printing_enabled === "true");
          setFoodStepEnabled(map[`food_register_checkin_${selectedType}`] !== "false");

        }
      });
    return () => { cancelled = true; };
  }, [selectedType, siteId, pack]);

  // Fetch previous visitors
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setPreviousVisitors([]);
      return;
    }
    if (!currentSiteId) { setPreviousVisitors([]); return; }
    let cancelled = false;
    const q = searchQuery.toLowerCase();
    let query = supabase
      .from("visitors")
      .select("id, first_name, surname, mobile, email, address, person_qr")
      .or(`first_name.ilike.%${q}%,surname.ilike.%${q}%,mobile.ilike.%${q}%`)
      .neq("type", "resident");

    // Site isolation: only offer people who have visited this site before.
    // Records with no site stay visible only on the original/legacy site.
    if (currentSiteId) {
      query = isLegacySite
        ? query.or(`branch_id.eq.${currentSiteId},branch_id.is.null`)
        : query.eq("branch_id", currentSiteId);
    }

    query
      .order("check_in_time", { ascending: false })
      .limit(10)
      .then(({ data }) => {
        if (cancelled) return;
        if (data) {
          const seen = new Set<string>();
          const unique: VisitorProfile[] = [];
          for (const r of data) {
            const key = `${r.first_name}|${r.surname}|${r.email}`.toLowerCase();
            if (!seen.has(key)) {
              seen.add(key);
              unique.push({
                id: r.id, firstName: r.first_name, surname: r.surname,
                mobile: r.mobile || "", email: r.email || "", address: r.address || "", personQr: r.person_qr || undefined,
              });
            }
          }
          setPreviousVisitors(unique);
        }
      });
    return () => { cancelled = true; };
  }, [searchQuery, currentSiteId, isLegacySite]);

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
    setKeyOverrideReason(""); setVolunteerRole(""); setVolunteerSupervisor(""); setVolunteerExpectedEnd(""); setOtherReason(""); setContractorGate({ blocked: false, reason: null });
    setOverrideReason("");
    setOverrideApprovedBy(null);
    setPrivacyAcknowledged(false);
    setCompanions([]);
    setPhoto(null);
    setCheckInTimeOverride(null);
    setContractorScreeningAnswers({});
    setSelectedSupplier(null);
    setBringingFood(null);
    setFoodForm(emptyFoodForm);
    setRequestId(crypto.randomUUID());
  };

  // Configured question outcomes. Questions with no rules keep their previous
  // behaviour, so nothing changes for sites that have not set rules up.
  const bodyTemperature = formData.bodyTemperature ? parseFloat(formData.bodyTemperature) : null;
  const evaluation = useMemo(
    () =>
      evaluateScreening(
        healthQuestions.map(q => ({ ...q, expectedAnswer: q.expected_answer, warningAnswers: q.warning_answers, staffMessage: q.staff_message, outcomeAction: q.outcome_action })) as ScreeningRuleQuestion[],
        healthAnswers,
        { bodyTemperature: Number.isNaN(bodyTemperature as number) ? null : bodyTemperature }
      ),
    [healthQuestions, healthAnswers, bodyTemperature]
  );
  const hasSymptomFlag = evaluation.flags.some((f) => f.questionId !== "body_temperature");
  const hasHighTemperature = evaluation.flags.some((f) => f.questionId === "body_temperature");
  const screeningFlagged = evaluation.flagged;
  const screeningBlocked = evaluation.blocked;
  // A blocked sign-in needs a supervisor approval with a written reason.
  const overrideValid = overrideReason.trim().length >= 10;

  /** Records the supervisor approval server-side; returns an error message on refusal. */
  const approveBlockedScreening = useCallback(async (): Promise<string | null> => {
    if (!overrideValid) return "Enter a reason of at least 10 characters.";
    const { error } = await supabase.rpc("override_screening_block" as any, {
      p_reason: overrideReason.trim(),
      p_context: {
        person_type: selectedType,
        outcome: evaluation.outcome,
        flags: evaluation.flags.map((f) => ({ question_id: f.questionId, severity: f.severity })),
      } as any,
    });
    if (error) return error.message || "You do not have permission to approve this check-in.";
    const { data } = await supabase.auth.getUser();
    setOverrideApprovedBy(data.user?.email || "Supervisor");
    return null;
  }, [overrideValid, overrideReason, selectedType, evaluation]);

  // The screening step owns credential evaluation and reports the gate up
  const contractorBlocked = selectedType === "contractor" && contractorGate.blocked;

  // Every companion must satisfy the fields configured for this person type
  // before anyone can be signed in.
  const companionsComplete = useMemo(
    () => companions.every((c) => missingCompanionFields(c as any, activeCompanionFields).length === 0),
    [companions, activeCompanionFields]
  );

  const missingAnswers = missingRequiredAnswers(healthQuestions, healthAnswers).concat(
    missingRequiredAnswers(vaccinationFields.map(v => ({ id: `vacc_${v.name}`, label: v.label, type: v.field_type, required: v.required })), healthAnswers)
  );
  const configurationLoading = !!(typesLoading || fieldsLoading || companionsLoading || questionsLoading || vaccinationsLoading || settingsLoading);
  const configurationError = !!(fieldsError || companionsError || questionsError || vaccinationsError || settingsError);
  const validationIssues = staffCheckInIssues({
    missingDetails: missingFields.map(f => f.label),
    destinationRequired: !!personConfig?.destinationRequired,
    destination: formData.selectPerson,
    companionsComplete, missingAnswers,
    foodApplies: foodStepApplies,
    foodComplete: bringingFood === false || (bringingFood === true && isFoodFormValid(foodForm)),
    privacyRequired: policy.privacyRequired, privacyAcknowledged,
    contractorBlocked, contractorReason: contractorGate.reason,
    screeningBlocked, screeningFlagged, overrideApproved: !!overrideApprovedBy, overrideValid,
    keyBlocked, otherReasonRequired: selectedType === "other", otherReason,
  });
  if (!currentSiteId) validationIssues.unshift("Select a site before checking in");
  if (configurationLoading) validationIssues.unshift("Loading check-in requirements…");
  if (configurationError) validationIssues.unshift("Check-in requirements could not be loaded. Close and reopen to retry.");
  const canSubmit = validationIssues.length === 0;
  const canProceed = !configurationLoading && !configurationError && (step === "confirm" ? canSubmit :
    step === "details" ? missingFields.length === 0 && companionsComplete && (!personConfig?.destinationRequired || !!formData.selectPerson.trim()) && (selectedType !== "other" || otherReason.trim().length >= 3) :
    step === "food" ? bringingFood === false || (bringingFood === true && isFoodFormValid(foodForm)) :
    step === "screening" ? !contractorBlocked && missingAnswers.length === 0 : true);



  const buildVisitor = (): Omit<Visitor, "id"> => {
    const allHealthClear = Object.values(healthAnswers).every((v) => v === false);
    const visitQr = crypto.randomUUID().slice(0, 12).toUpperCase();
    // Details the site has switched off are never written to the arrival.
    const enabled = pickEnabledValues(
      formData as unknown as Record<string, unknown>,
      activeFields,
      ["email", "mobile", "address"]
    );
    return {
      qrCode: visitQr,
      clientRequestId: requestId,
      // Stable personal card code — reused when a returning visitor is recognised
      personQr: selectedProfile?.personQr || visitQr,

      supplierId: selectedType === "contractor" ? selectedSupplier?.id : undefined,
      contractorScreening: selectedType === "contractor" ? { ...contractorScreeningAnswers } : undefined,
      volunteerRole: selectedType === "volunteer" && extras.volunteerRoleEnabled ? volunteerRole.trim() || undefined : undefined,
      volunteerSupervisor: selectedType === "volunteer" && extras.volunteerSupervisorEnabled ? volunteerSupervisor.trim() || undefined : undefined,
      volunteerExpectedEnd: selectedType === "volunteer" && extras.volunteerExpectedEndEnabled && volunteerExpectedEnd ? (() => { const date = new Date(); const [h,m] = volunteerExpectedEnd.split(":").map(Number); date.setHours(h,m,0,0); return date; })() : undefined,
      visitReasonOther: selectedType === "other" ? otherReason.trim() || undefined : undefined,
      termsConfirmedBy: policy.privacyRequired && privacyAcknowledged ? `${formData.firstName} ${formData.surname}`.trim() : undefined,
      termsConfirmationMode: policy.privacyRequired && privacyAcknowledged ? "self" : undefined,
      firstName: formData.firstName,
      surname: formData.surname,
      email: enabled.email,
      mobile: enabled.mobile,
      type: selectedType,
      checkInTime: checkInTimeOverride ? (() => { const now = new Date(); const [h, m] = checkInTimeOverride.split(":").map(Number); now.setHours(h, m, 0, 0); return now; })() : new Date(),
      checkOutTime: null,
      whomToVisit: formData.selectPerson,
      address: enabled.address,
      status: "checked-in",
      healthDeclaration: policy.screeningEnabled ? allHealthClear && formData.healthDeclaration : false,
      additionalVisitors: companions.length,
      companionDetails: companions.length > 0 ? companions.map(normaliseCompanion) : undefined,
      comments: formData.comments,
      bodyTemperature: policy.screeningEnabled && formData.bodyTemperature ? parseFloat(formData.bodyTemperature) : undefined,
      influenzaVaccineDate: policy.vaccinationEnabled ? formData.influenzaVaccineDate || undefined : undefined,
      covidDose1Date: policy.vaccinationEnabled ? formData.covidDose1Date || undefined : undefined,
      covidDose2Date: policy.vaccinationEnabled ? formData.covidDose2Date || undefined : undefined,
      retentionExpiry: new Date(Date.now() + 86400000 * 60),
      acknowledgedPrivacy: policy.privacyRequired ? privacyAcknowledged : false,
      healthAnswers: policy.screeningEnabled
        ? { ...healthAnswers, ...contractorScreeningAnswers }
        : (Object.keys(contractorScreeningAnswers).length ? { ...contractorScreeningAnswers } : undefined),
      // The outcome only — never a second copy of the answers themselves.
      screeningOutcome: policy.screeningEnabled ? evaluation.outcome : undefined,
      screeningFlags: policy.screeningEnabled && evaluation.flags.length
        ? evaluation.flags.map((f) => ({ question_id: f.questionId, severity: f.severity, action: f.action }))
        : undefined,
      // Proper link to the resident being visited, not just the typed name
      visitedResidentIds: selectedResident ? [selectedResident.id] : undefined,
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
    policy,
    healthQuestions, healthAnswers, setHealthAnswers,
    dbVaccFields: vaccinationFields, contractorScreeningAnswers, setContractorScreeningAnswers,
    selectedSupplier, setSelectedSupplier, jurisdiction,
    contractorBlocked, contractorBlockReason: selectedType === "contractor" ? contractorGate.reason : null,
    setContractorGate,

    // Companions
    companions, setCompanions, activeCompanionFields, companionsComplete,

    // Configured fields for the main person
    activeFields, missingFields, missingFieldsHint,

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
    canProceed, canSubmit, validationIssues, configurationLoading, configurationError, resetForm, buildVisitor,
    extras, volunteerRole, setVolunteerRole, volunteerSupervisor, setVolunteerSupervisor,
    volunteerExpectedEnd, setVolunteerExpectedEnd, otherReason, setOtherReason,
    overdueKeys, keyPolicy, keyOverrideReason, setKeyOverrideReason,

    // Food register
    bringingFood, setBringingFood, foodForm, setFoodForm, foodStepApplies, selectedResident,

    // Badge printing
    badgePrintingEnabled,

    // Screening outcome and supervisor approval
    screeningFlagged, screeningBlocked, screeningEvaluation: evaluation,
    hasSymptomFlag, hasHighTemperature,
    overrideReason, setOverrideReason, overrideValid,
    overrideApprovedBy, approveBlockedScreening,
  };
}
