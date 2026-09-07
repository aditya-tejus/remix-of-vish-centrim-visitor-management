import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Visitor, VisitorType, CompanionDetail } from "@/types/visitor";
import { Users, User, Truck, UserCog, Heart, Search, ArrowLeft, ArrowRight, Check, Phone, Mail, Shield, ScrollText, Camera, X, Thermometer, Syringe, Upload, FileText, Plus, Trash2, CalendarDays, Home, Clock } from "lucide-react";
import { PrivacyNotice } from "@/components/PrivacyNotice";
import { useActiveHealthQuestions, useActiveVaccinationFields } from "@/hooks/useHealthQuestions";
import { useCompanionFields } from "@/hooks/useFormFields";
import { useActiveLeaveTypes } from "@/hooks/useLeaveTypes";
import { format } from "date-fns";
import { useOpenKeyIssues } from "@/hooks/useOpenKeyIssues";
import { supabase } from "@/integrations/supabase/client";
import { ContractorScreening } from "@/components/ContractorScreening";
import { Supplier } from "@/hooks/useSuppliers";
import { useResidents } from "@/hooks/useResidents";
import { useStaffMembers } from "@/hooks/useStaffMembers";

interface AddVisitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (visitor: Omit<Visitor, "id">) => Visitor;
}

const visitorTypes: { type: VisitorType; label: string; icon: typeof User; emoji: string }[] = [
  { type: "visitor", label: "Visitor", icon: User, emoji: "👋" },
  { type: "contractor", label: "Contractor", icon: Truck, emoji: "🔧" },
  { type: "volunteer", label: "Volunteer", icon: Heart, emoji: "🤝" },
  { type: "staff", label: "Staff", icon: UserCog, emoji: "💼" },
];

interface VisitorProfile {
  id: string;
  firstName: string;
  surname: string;
  mobile: string;
  email: string;
  address: string;
}



type QuestionType = "yesno" | "text" | "textarea" | "select" | "checkbox" | "file";

interface HealthQuestion {
  id: string;
  question: string;
  type: QuestionType;
  required?: boolean;
  placeholder?: string | null;
  options?: string[];
}

const fallbackHealthQuestions: HealthQuestion[] = [
  { id: "fever", question: "Do you have a fever or feel unusually warm?", type: "yesno", required: true },
  { id: "cough", question: "Do you have a new continuous cough?", type: "yesno", required: true },
  { id: "consent_screening", question: "I consent to compliance screening and temperature check", type: "checkbox", required: true },
];

export interface CheckInPrefill {
  firstName?: string;
  surname?: string;
  mobile?: string;
  email?: string;
  address?: string;
  type?: VisitorType;
}

export function AddVisitDialog({ open, onOpenChange, onAdd, initialType, prefill }: AddVisitDialogProps & { initialType?: VisitorType; prefill?: CheckInPrefill }) {

  const { residents: dbResidents } = useResidents();
  const { staff: dbStaff } = useStaffMembers();
  const [previousVisitors, setPreviousVisitors] = useState<VisitorProfile[]>([]);
  const residentItems = useMemo(() => dbResidents.map(r => ({ id: r.visitorId, name: r.name, room: r.room, wing: r.wing })), [dbResidents]);
  const staffItems = useMemo(() => dbStaff.map(s => ({ id: s.id, name: s.name, role: s.role, department: s.department || "" })), [dbStaff]);
  const [step, setStep] = useState(1);
  const [selectedType, setSelectedType] = useState<VisitorType>("visitor");
  const { data: dbQuestions = [] } = useActiveHealthQuestions(selectedType as any);
  const { data: dbVaccFields = [] } = useActiveVaccinationFields(selectedType as any);
  const { data: companionFieldsConfig = [] } = useCompanionFields(selectedType as any);
  const { data: leaveTypesData = [] } = useActiveLeaveTypes();
  const activeCompanionFields = companionFieldsConfig.filter((f) => f.is_active).sort((a, b) => a.sort_order - b.sort_order);
  const healthQuestions: HealthQuestion[] = dbQuestions.length > 0 ? dbQuestions : fallbackHealthQuestions;
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProfile, setSelectedProfile] = useState<VisitorProfile | null>(null);
  const [selectedResident, setSelectedResident] = useState<{ id: string; name: string; room: string; wing: string } | null>(null);
  const [formData, setFormData] = useState({
    firstName: "", surname: "", email: "", mobile: "", address: "",
    additionalVisitors: 0, whomToVisit: "" as "" | "Resident" | "Staff",
    selectPerson: "", comments: "",
    bodyTemperature: "", healthDeclaration: false,
    influenzaVaccineDate: "", covidDose1Date: "", covidDose2Date: "",
    checkoutReason: "", checkoutReasonOther: "",
    leaveType: "",
    accompaniedBy: "",
    accompaniedByName: "",
  });
  const [expectedReturnDate, setExpectedReturnDate] = useState<Date | undefined>(undefined);
  const [expectedReturnTime, setExpectedReturnTime] = useState("12:00");
  const [healthAnswers, setHealthAnswers] = useState<Record<string, any>>({});
  const [overrideReason, setOverrideReason] = useState("");
  const [privacyAcknowledged, setPrivacyAcknowledged] = useState(false);
  const { overdueForName, policy: keyPolicy } = useOpenKeyIssues();

  const [branchTcUrl, setBranchTcUrl] = useState<string | null>(null);
  const [branchPrivacyUrl, setBranchPrivacyUrl] = useState<string | null>(null);
  const [returnNotificationOptIn, setReturnNotificationOptIn] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [companions, setCompanions] = useState<CompanionDetail[]>([]);
  const [residentSearchQuery, setResidentSearchQuery] = useState("");
  const [contractorScreeningAnswers, setContractorScreeningAnswers] = useState<Record<string, any>>({});
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [jurisdiction, setJurisdiction] = useState<"AU" | "UK">("AU");
  const [contractorGate, setContractorGate] = useState<{ blocked: boolean; reason: string | null }>({ blocked: false, reason: null });

  const isResident = selectedType === "resident";
  const isContractor = selectedType === "contractor";
  const steps = isResident
    ? ["Resident", "Schedule", "Reason", "Companions", "Confirm"]
    : isContractor
    ? ["Search", "Details", "Screening", "Confirm"]
    : ["Search", "Details", "Health", "Confirm"];
  const totalSteps = steps.length;

  // Load branch document URLs and jurisdiction from settings
  useEffect(() => {
    supabase
      .from("settings")
      .select("key, value")
      .in("key", ["branch_tc_url", "branch_privacy_url", "show_branch_docs_in_form", "jurisdiction"])
      .then(({ data }) => {
        if (data) {
          const map: Record<string, string> = {};
          data.forEach((r: any) => { map[r.key] = r.value; });
          const showDocs = map.show_branch_docs_in_form !== "false";
          setBranchTcUrl(showDocs && map.branch_tc_url ? map.branch_tc_url : null);
          setBranchPrivacyUrl(showDocs && map.branch_privacy_url ? map.branch_privacy_url : null);
          if (map.jurisdiction === "UK" || map.jurisdiction === "AU") setJurisdiction(map.jurisdiction);
        }
      });
  }, []);

  // Set initial type from prop
  useEffect(() => {
    if (!open) return;
    if (initialType) setSelectedType(initialType);
    if (prefill) {
      if (prefill.type) setSelectedType(prefill.type);
      setFormData((prev) => ({
        ...prev,
        firstName: prefill.firstName ?? prev.firstName,
        surname: prefill.surname ?? prev.surname,
        email: prefill.email ?? prev.email,
        mobile: prefill.mobile ?? prev.mobile,
        address: prefill.address ?? prev.address,
      }));
      // Known person: skip the "who is this?" lookup, still ask every question fresh.
      setStep(2);
    }
  }, [initialType, prefill, open]);


  const filteredResidents = useMemo(() => {
    if (!residentSearchQuery.trim()) return residentItems;
    const q = residentSearchQuery.toLowerCase();
    return residentItems.filter(
      (r) => r.name.toLowerCase().includes(q) || r.room.toLowerCase().includes(q) || r.wing.toLowerCase().includes(q)
    );
  }, [residentSearchQuery, residentItems]);

  // Query previous visitors from DB for returning visitor lookup
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return previousVisitors;
    const q = searchQuery.toLowerCase();
    return previousVisitors.filter(
      (p) =>
        p.firstName.toLowerCase().includes(q) ||
        p.surname.toLowerCase().includes(q) ||
        p.mobile.includes(q) ||
        `${p.firstName} ${p.surname}`.toLowerCase().includes(q)
    );
  }, [searchQuery, previousVisitors]);

  // Fetch previous visitors when search query changes
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
                id: r.id,
                firstName: r.first_name,
                surname: r.surname,
                mobile: r.mobile || "",
                email: r.email || "",
                address: r.address || "",
              });
            }
          }
          setPreviousVisitors(unique);
        }
      });
  }, [searchQuery]);

  const resetForm = () => {
    setStep(1); setSelectedType("visitor"); setSearchQuery(""); setSelectedProfile(null);
    setSelectedResident(null); setResidentSearchQuery("");
    setFormData({
      firstName: "", surname: "", email: "", mobile: "", address: "",
      additionalVisitors: 0, whomToVisit: "", selectPerson: "", comments: "",
      bodyTemperature: "", healthDeclaration: false,
      influenzaVaccineDate: "", covidDose1Date: "", covidDose2Date: "",
      checkoutReason: "", checkoutReasonOther: "",
      leaveType: "",
      accompaniedBy: "",
      accompaniedByName: "",
    });
    setExpectedReturnDate(undefined); setExpectedReturnTime("12:00");
    setHealthAnswers({}); setOverrideReason(""); setPrivacyAcknowledged(false);
    setReturnNotificationOptIn(false);
    setPhoto(null); setCompanions([]); stopCamera();
    setContractorScreeningAnswers({}); setSelectedSupplier(null);
  };

  const handleSelectProfile = (profile: VisitorProfile) => {
    setSelectedProfile(profile);
    setFormData((prev) => ({
      ...prev,
      firstName: profile.firstName, surname: profile.surname,
      email: profile.email, mobile: profile.mobile, address: profile.address,
    }));
  };

  const handleSelectResident = (resident: { id: string; name: string; room: string; wing: string }) => {
    setSelectedResident(resident);
    const [firstName, ...rest] = resident.name.split(" ");
    setFormData((prev) => ({
      ...prev,
      firstName: firstName || "",
      surname: rest.join(" ") || "",
      address: `${resident.room}, ${resident.wing}`,
    }));
  };

  const handleSubmit = () => {
    const allHealthClear = Object.values(healthAnswers).every((v) => v === false);
    const reason = formData.checkoutReason === "Other" ? formData.checkoutReasonOther : formData.checkoutReason;
    // Combine date + time for expected return
    let combinedReturnDate: Date | undefined;
    if (isResident && expectedReturnDate) {
      const [h, m] = expectedReturnTime.split(":").map(Number);
      combinedReturnDate = new Date(expectedReturnDate);
      combinedReturnDate.setHours(h, m, 0, 0);
    }
    const visitor: Omit<Visitor, "id"> = {
      firstName: formData.firstName, surname: formData.surname,
      email: formData.email, mobile: formData.mobile, type: selectedType,
      checkInTime: isResident ? new Date() : new Date(),
      checkOutTime: isResident ? new Date() : null,
      whomToVisit: formData.selectPerson, address: formData.address,
      visitedResidentIds: selectedResident ? [selectedResident.id] : undefined,
      status: isResident ? "checked-out" : "checked-in",
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
      expectedReturnDate: combinedReturnDate,
      checkoutReason: isResident ? formData.checkoutReason || undefined : undefined,
      leaveType: isResident && formData.checkoutReason ? formData.checkoutReason : undefined,
      returnNotificationOptIn: isResident ? returnNotificationOptIn : undefined,
      accompaniedBy: isResident ? formData.accompaniedBy || undefined : undefined,
      accompaniedByName: isResident ? formData.accompaniedByName || undefined : undefined,
    };
    onAdd(visitor);

    // Record a staff override of an outstanding key or fob
    if (!screeningFlagged && overdueKeys.length > 0 && keyPolicy.enforcement === "block" && overrideReason.trim()) {
      const reason = overrideReason.trim();
      const items = overdueKeys.map((i) => i.keyLabel);
      void (async () => {
        const { data: auth } = await supabase.auth.getUser();
        const { data: profile } = auth.user
          ? await supabase.from("profiles").select("display_name").eq("user_id", auth.user.id).maybeSingle()
          : { data: null as any };
        await supabase.from("audit_log").insert({
          action: "key_overdue_override",
          performed_by: profile?.display_name || auth.user?.email || "Unknown staff",
          user_id: auth.user?.id ?? null,
          change_reason: reason,
          records_affected: 1,
          details: {
            visitor: `${formData.firstName} ${formData.surname}`,
            visitor_type: selectedType,
            outstanding_items: items,
          },
        });
      })();
    }

    // Record a staff override of a failed health screening
    if (screeningFlagged && overrideReason.trim()) {
      void (async () => {
        const { data: auth } = await supabase.auth.getUser();
        const { data: profile } = auth.user
          ? await supabase.from("profiles").select("display_name").eq("user_id", auth.user.id).maybeSingle()
          : { data: null as any };
        await supabase.from("audit_log").insert({
          action: "health_screening_override",
          performed_by: profile?.display_name || auth.user?.email || "Unknown staff",
          user_id: auth.user?.id ?? null,
          change_reason: overrideReason.trim(),
          records_affected: 1,
          details: {
            visitor: `${formData.firstName} ${formData.surname}`,
            visitor_type: selectedType,
            symptom_flag: hasSymptomFlag,
            body_temperature: formData.bodyTemperature || null,
            overridden_at: new Date().toISOString(),
          } as any,
        });
      })();
    }

    resetForm();
    onOpenChange(false);
  };


  const handleClose = () => { resetForm(); onOpenChange(false); };
  const updateField = (field: string, value: string | number | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Camera functions
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 320, height: 320 } });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
      setShowCamera(true);
    } catch { fileInputRef.current?.click(); }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    setShowCamera(false);
  }, []);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current; canvas.width = 200; canvas.height = 200;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const video = videoRef.current;
    const size = Math.min(video.videoWidth, video.videoHeight);
    const sx = (video.videoWidth - size) / 2; const sy = (video.videoHeight - size) / 2;
    ctx.drawImage(video, sx, sy, size, size, 0, 0, 200, 200);
    setPhoto(canvas.toDataURL("image/jpeg", 0.8)); stopCamera();
  }, [stopCamera]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhoto(reader.result as string);
    reader.readAsDataURL(file); e.target.value = "";
  };

  // Validation
  const canProceedStep2NonResident = formData.firstName && formData.surname && formData.email &&
    formData.whomToVisit && formData.selectPerson;
  const canProceedResidentStep1 = !!selectedResident;
  const canProceedResidentStep2 = formData.email && formData.mobile;

  // Health screening gate (attended desk: staff may override with a reason)
  const hasSymptomFlag = Object.values(healthAnswers).some((v) => v === true);
  const hasHighTemperature = !!formData.bodyTemperature && parseFloat(formData.bodyTemperature) > 37.8;
  const screeningFlagged = !isResident && (hasSymptomFlag || hasHighTemperature);
  const overrideValid = overrideReason.trim().length >= 3;
  // Contractor credential gate: only the highest-risk credential blocks check-in
  const contractorBlocked = isContractor && contractorGate.blocked;

  // Outstanding keys/fobs gate
  const overdueKeys = useMemo(
    () => (isResident ? [] : overdueForName(`${formData.firstName} ${formData.surname}`.trim())),
    [overdueForName, formData.firstName, formData.surname, isResident]
  );
  const keyBlocked = keyPolicy.enforcement === "block" && overdueKeys.length > 0 && !overrideValid;
  const canSubmit =
    privacyAcknowledged && !contractorBlocked && !keyBlocked && (!screeningFlagged || overrideValid);


  // Render health questions shared component
  const renderHealthQuestions = () => (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-primary" />
        <p className="text-xs font-bold text-foreground">Check-in Compliance</p>
      </div>
      <p className="text-[11px] text-muted-foreground">Please complete all required questions before proceeding.</p>
      <div className="space-y-2.5">
        {healthQuestions.map((q, idx) => {
          const answer = healthAnswers[q.id];
          const isYesNo = q.type === "yesno";
          const hasYesAnswer = isYesNo && answer === true;
          const hasNoAnswer = isYesNo && answer === false;
          const isFilled = answer !== undefined && answer !== null && answer !== "";
          return (
            <div key={q.id} className={`rounded-xl border-2 p-3.5 transition-all ${
              hasNoAnswer ? "border-success/30 bg-success/5"
                : hasYesAnswer ? "border-destructive/30 bg-destructive/5"
                : isFilled ? "border-primary/20 bg-primary/5" : "border-border"
            }`}>
              <div className="flex items-start gap-3 mb-2.5">
                <span className={`text-[10px] font-bold mt-0.5 shrink-0 h-5 w-5 rounded-full flex items-center justify-center ${
                  hasNoAnswer ? "bg-success text-success-foreground"
                    : hasYesAnswer ? "bg-destructive text-destructive-foreground"
                    : isFilled ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}>{hasNoAnswer ? "✓" : hasYesAnswer ? "✗" : isFilled ? "✓" : idx + 1}</span>
                <p className="text-xs text-foreground flex-1 leading-relaxed">
                  {q.question}{q.required && <span className="text-destructive ml-0.5">*</span>}
                </p>
              </div>
              <div className="ml-8">
                {q.type === "yesno" && (
                  <div className="flex gap-2">
                    <button onClick={() => setHealthAnswers((prev) => ({ ...prev, [q.id]: false }))}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${answer === false ? "bg-success text-success-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-success/20"}`}>No</button>
                    <button onClick={() => setHealthAnswers((prev) => ({ ...prev, [q.id]: true }))}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${answer === true ? "bg-destructive text-destructive-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-destructive/20"}`}>Yes</button>
                  </div>
                )}
                {q.type === "text" && (
                  <Input value={answer || ""} onChange={(e) => setHealthAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                    placeholder={q.placeholder || "Enter response..."} className="rounded-lg h-9 text-sm" />
                )}
                {q.type === "textarea" && (
                  <Textarea value={answer || ""} onChange={(e) => setHealthAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                    placeholder={q.placeholder || "Enter details..."} className="min-h-[60px] resize-none rounded-lg text-sm" />
                )}
                {q.type === "select" && q.options && (
                  <Select value={answer || ""} onValueChange={(val) => setHealthAnswers((prev) => ({ ...prev, [q.id]: val }))}>
                    <SelectTrigger className="rounded-lg h-9 text-sm"><SelectValue placeholder="Select an option..." /></SelectTrigger>
                    <SelectContent>{q.options.map((opt) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent>
                  </Select>
                )}
                {q.type === "checkbox" && (
                  <div className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                    onClick={() => setHealthAnswers((prev) => ({ ...prev, [q.id]: !prev[q.id] }))}>
                    <Checkbox checked={!!answer} onCheckedChange={(c) => setHealthAnswers((prev) => ({ ...prev, [q.id]: c === true }))} />
                    <span className="text-xs text-foreground">Yes, I confirm</span>
                  </div>
                )}
                {q.type === "file" && (
                  <div>
                    {answer ? (
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 border border-border">
                        <FileText className="h-4 w-4 text-primary shrink-0" />
                        <span className="text-xs text-foreground flex-1 truncate">{answer.name || "File uploaded"}</span>
                        <button onClick={() => setHealthAnswers((prev) => ({ ...prev, [q.id]: null }))} className="text-muted-foreground hover:text-destructive"><X className="h-3.5 w-3.5" /></button>
                      </div>
                    ) : (
                      <label className="flex items-center gap-2 p-2.5 rounded-lg border-2 border-dashed border-border hover:border-primary/30 cursor-pointer transition-colors">
                        <Upload className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Choose file to upload</span>
                        <input type="file" className="hidden" accept="image/*,.pdf,.doc,.docx"
                          onChange={(e) => { const file = e.target.files?.[0]; if (file) setHealthAnswers((prev) => ({ ...prev, [q.id]: { name: file.name, file } })); e.target.value = ""; }} />
                      </label>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {healthQuestions.some((q) => q.type === "yesno" && healthAnswers[q.id] === true) && (
        <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3 flex items-start gap-2.5">
          <span className="text-lg">⚠️</span>
          <div>
            <p className="text-xs font-bold text-destructive">Health Concern Flagged</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Staff review required before entry is permitted.</p>
          </div>
        </div>
      )}
    </div>
  );

  // Render temperature section
  const renderTemperature = () => (
    <div className="rounded-xl border border-border p-3.5 space-y-2">
      <h4 className="text-xs font-bold text-foreground flex items-center gap-2">
        <Thermometer className="h-3.5 w-3.5 text-primary" /> Body Temperature
      </h4>
      <div className="flex items-center gap-2">
        <Input type="number" step="0.1" value={formData.bodyTemperature} placeholder="36.5"
          onChange={(e) => updateField("bodyTemperature", e.target.value)} className="h-9 rounded-lg text-sm w-24" />
        <span className="text-sm text-muted-foreground font-semibold">°C</span>
      </div>
      {formData.bodyTemperature && parseFloat(formData.bodyTemperature) > 37.8 && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-2 flex items-center gap-2">
          <span className="text-sm">🌡️</span>
          <p className="text-[11px] text-destructive font-semibold">High temperature detected — staff review required.</p>
        </div>
      )}
    </div>
  );

  // Render vaccination fields
  const renderVaccination = () => dbVaccFields.length > 0 ? (
    <div className="rounded-xl border border-border p-3.5 space-y-3">
      <h4 className="text-xs font-bold text-foreground flex items-center gap-2">
        <Syringe className="h-3.5 w-3.5 text-primary" /> Vaccination Records
        <span className="text-[10px] font-normal text-muted-foreground">(optional)</span>
      </h4>
      <div className="grid grid-cols-2 gap-2.5">
        {dbVaccFields.map((vf) => (
          <div key={vf.id} className="space-y-1">
            <Label className="text-[11px]">{vf.label}{vf.required && <span className="text-destructive ml-0.5">*</span>}</Label>
            {vf.field_type === "date" && <Input type="date" value={healthAnswers[`vacc_${vf.name}`] || ""} onChange={(e) => setHealthAnswers((prev) => ({ ...prev, [`vacc_${vf.name}`]: e.target.value }))} className="rounded-lg text-xs h-9" />}
            {vf.field_type === "text" && <Input value={healthAnswers[`vacc_${vf.name}`] || ""} onChange={(e) => setHealthAnswers((prev) => ({ ...prev, [`vacc_${vf.name}`]: e.target.value }))} className="rounded-lg text-xs h-9" />}
            {vf.field_type === "select" && vf.options && (
              <Select value={healthAnswers[`vacc_${vf.name}`] || ""} onValueChange={(val) => setHealthAnswers((prev) => ({ ...prev, [`vacc_${vf.name}`]: val }))}>
                <SelectTrigger className="rounded-lg h-9 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>{vf.options.map((opt) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent>
              </Select>
            )}
            {vf.field_type === "file" && (
              <label className="flex items-center gap-2 p-2 rounded-lg border-2 border-dashed border-border hover:border-primary/30 cursor-pointer transition-colors">
                <Upload className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground">Upload</span>
                <input type="file" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) setHealthAnswers((prev) => ({ ...prev, [`vacc_${vf.name}`]: { name: file.name, file } })); e.target.value = ""; }} />
              </label>
            )}
          </div>
        ))}
      </div>
    </div>
  ) : null;

  // Render companions section
  const renderCompanions = () => activeCompanionFields.length > 0 ? (
    <div className="space-y-2.5 pt-2 border-t border-border">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Users className="h-3 w-3" /> Additional People
        </p>
        <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1"
          onClick={() => { const empty: CompanionDetail = {}; activeCompanionFields.forEach((f) => { empty[f.field_key.replace("companion_", "")] = ""; }); setCompanions((prev) => [...prev, empty]); }}>
          <Plus className="h-3 w-3" /> Add Person
        </Button>
      </div>
      {companions.map((companion, cIdx) => (
        <div key={cIdx} className="rounded-xl border border-border p-3 space-y-2 relative">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-semibold text-muted-foreground">Person {cIdx + 1}</span>
            <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive hover:text-destructive"
              onClick={() => setCompanions((prev) => prev.filter((_, i) => i !== cIdx))}><Trash2 className="h-3 w-3" /></Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {activeCompanionFields.map((f) => {
              const key = f.field_key.replace("companion_", "");
              return (
                <div key={f.id} className="space-y-1">
                  <Label className="text-[11px]">{f.label}{f.required && <span className="text-destructive ml-0.5">*</span>}</Label>
                  <Input value={companion[key] || ""} onChange={(e) => setCompanions((prev) => prev.map((c, i) => i === cIdx ? { ...c, [key]: e.target.value } : c))}
                    placeholder={f.label} className="rounded-lg h-8 text-sm" />
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {companions.length === 0 && <p className="text-[11px] text-muted-foreground text-center py-2">No additional people added</p>}
    </div>
  ) : null;

  // Render review/confirm
  const renderReview = () => (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-muted/30 p-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Summary</p>
        <div className="flex items-center gap-3 mb-3">
          {photo ? (
            <img src={photo} alt="" className="h-12 w-12 rounded-xl object-cover border border-border" />
          ) : (
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
              {formData.firstName?.[0]}{formData.surname?.[0]}
            </div>
          )}
          <div className="flex-1">
            <p className="text-sm font-bold text-foreground">{formData.firstName} {formData.surname}</p>
            <p className="text-[11px] text-muted-foreground capitalize">
              {selectedType} {isResident && selectedResident ? `• ${selectedResident.room}, ${selectedResident.wing}` : `• ${formData.selectPerson || "—"}`}
            </p>
          </div>
          <div className={`text-[11px] font-bold px-2 py-1 rounded-md ${
            Object.values(healthAnswers).some((v) => v === true)
              ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"
          }`}>
            {Object.values(healthAnswers).some((v) => v === true) ? "⚠ Flagged" : "✓ Clear"}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {formData.mobile && (
            <div className="rounded-lg bg-card p-2.5 border border-border">
              <p className="text-[10px] text-muted-foreground">Phone</p>
              <p className="text-xs font-semibold text-foreground">{formData.mobile}</p>
            </div>
          )}
          {formData.email && (
            <div className="rounded-lg bg-card p-2.5 border border-border">
              <p className="text-[10px] text-muted-foreground">Email</p>
              <p className="text-xs font-semibold text-foreground truncate">{formData.email}</p>
            </div>
          )}
          {formData.bodyTemperature && (
            <div className="rounded-lg bg-card p-2.5 border border-border">
              <p className="text-[10px] text-muted-foreground">Temperature</p>
              <p className="text-xs font-semibold text-foreground">{formData.bodyTemperature}°C</p>
            </div>
          )}
          {isResident && formData.checkoutReason && (() => {
            const lt = leaveTypesData.find((l) => l.name === formData.checkoutReason);
            return (
              <div className="rounded-lg bg-card p-2.5 border border-border">
                <p className="text-[10px] text-muted-foreground">Reason</p>
                <p className="text-xs font-semibold text-foreground">{lt ? `${lt.emoji} ${lt.name}` : formData.checkoutReason}</p>
              </div>
            );
          })()}
          {isResident && expectedReturnDate && (
            <div className="rounded-lg bg-card p-2.5 border border-border">
              <p className="text-[10px] text-muted-foreground">Expected Return</p>
              <p className="text-xs font-semibold text-foreground">{format(expectedReturnDate, "dd MMM yyyy")} at {expectedReturnTime}</p>
            </div>
          )}
          {isResident && formData.accompaniedBy && (() => {
            const labels: Record<string, string> = {
              family: "👨‍👩‍👧 Family Member", friend: "👤 Friend", staff: "🧑‍⚕️ Staff Member",
              transport: "🚌 Transport / Driver", "medical-escort": "🏥 Medical Escort",
              alone: "🚶 Going Alone", group: "👥 Group Outing",
            };
            return (
              <div className="rounded-lg bg-card p-2.5 border border-border">
                <p className="text-[10px] text-muted-foreground">Accompanied By</p>
                <p className="text-xs font-semibold text-foreground">
                  {labels[formData.accompaniedBy] || formData.accompaniedBy}
                  {formData.accompaniedByName && ` — ${formData.accompaniedByName}`}
                </p>
              </div>
            );
          })()}
        </div>
        {companions.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
              <Users className="h-3 w-3" /> Companions ({companions.length})
            </p>
            <div className="space-y-1.5">
              {companions.map((c, i) => (
                <div key={i} className="rounded-lg bg-card p-2 border border-border flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                    {(c.name || "?")[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">{c.name || `Person ${i + 1}`}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{[c.relation, c.phone, c.email].filter(Boolean).join(" • ")}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {/* Terms + Privacy */}
      <div className="rounded-xl border border-border p-3 space-y-3">
        <div className="flex items-center gap-2">
          <ScrollText className="h-3.5 w-3.5 text-primary shrink-0" />
          <h4 className="text-xs font-bold text-foreground">Terms & Privacy</h4>
        </div>
        <div className="max-h-[100px] overflow-y-auto rounded-lg bg-muted/30 p-3 text-[10px] text-muted-foreground leading-relaxed space-y-1 border border-border">
          <p>1. I agree to follow all care home policies during my visit.</p>
          <p>2. I agree to sign out upon leaving the premises.</p>
          <p>3. I confirm that all information provided is accurate.</p>
          <p>4. My visit data will be processed per UK GDPR regulations.</p>
        </div>
        {(branchTcUrl || branchPrivacyUrl) && (
          <div className="flex flex-wrap gap-2">
            {branchTcUrl && (
              <a href={branchTcUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[11px] text-primary hover:underline font-medium">
                <FileText className="h-3 w-3" /> View Branch Terms & Conditions
              </a>
            )}
            {branchPrivacyUrl && (
              <a href={branchPrivacyUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[11px] text-primary hover:underline font-medium">
                <Shield className="h-3 w-3" /> View Branch Privacy Policy
              </a>
            )}
          </div>
        )}
        {overdueKeys.length > 0 && keyPolicy.enforcement !== "off" && (
          <div className={`rounded-xl border p-3 space-y-1 ${keyPolicy.enforcement === "block" ? "border-destructive/30 bg-destructive/10" : "border-warning/30 bg-warning/10"}`}>
            <p className="text-xs font-bold text-foreground">
              {keyPolicy.enforcement === "block" ? "Outstanding key or fob — not returned" : "Still holding a key or fob"}
            </p>
            <ul className="text-[11px] text-muted-foreground space-y-0.5">
              {overdueKeys.map((i) => (
                <li key={i.id}>
                  {i.keyLabel}{i.propertyLabel ? ` · ${i.propertyLabel}` : ""}
                  {i.expectedReturn ? ` · due ${format(i.expectedReturn, "hh:mm a dd MMM")}` : ""}
                </li>
              ))}
            </ul>
            {keyPolicy.enforcement === "block" && (
              <p className="text-[11px] text-destructive">
                Take the item back in the Keys Register, or record a reason below to let them in anyway.
              </p>
            )}
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 cursor-pointer" onClick={() => setPrivacyAcknowledged(!privacyAcknowledged)}>
            <Checkbox checked={privacyAcknowledged} onCheckedChange={(c) => setPrivacyAcknowledged(c === true)} />
            <span className="text-xs text-foreground">I accept the <strong>Terms & Conditions</strong> and acknowledge the <strong>Privacy Notice</strong></span>
          </div>
          {isResident && expectedReturnDate && (
            <div className="rounded-lg border border-border p-2.5 space-y-2">
              <div className="flex items-center gap-2 cursor-pointer" onClick={() => setReturnNotificationOptIn(!returnNotificationOptIn)}>
                <Checkbox checked={returnNotificationOptIn} onCheckedChange={(c) => setReturnNotificationOptIn(c === true)} />
                <span className="text-xs text-foreground">Notify staff if I have not returned by <strong>{format(expectedReturnDate, "dd MMM yyyy")} at {expectedReturnTime}</strong></span>
              </div>
              <p className="text-[10px] text-muted-foreground ml-6">Optional — enables return monitoring for safety purposes.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Navigation logic
  const canProceedCurrentStep = () => {
    if (isResident) {
      if (step === 1) return canProceedResidentStep1;
      if (step === 2) return !!expectedReturnDate;
      if (step === 3) return !!formData.checkoutReason;
      if (step === 4) return !!formData.accompaniedBy;
      return true;
    } else {
      if (step === 2) return canProceedStep2NonResident;
      return true;
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="right" className="sm:max-w-[520px] w-full p-0 gap-0 flex flex-col overflow-hidden">
        <SheetHeader className="px-6 pt-5 pb-3 shrink-0">
          <SheetTitle className="text-lg font-semibold text-foreground">
            {isResident ? "Resident Check-Out" : "Quick Check-In"}
          </SheetTitle>
          {/* Step indicator */}
          <div className="flex items-center gap-1 pt-2">
            {steps.map((s, i) => (
              <div key={s} className="flex items-center flex-1">
                <button
                  onClick={() => { if (i + 1 < step) setStep(i + 1); }}
                  className={`h-7 rounded-full flex items-center gap-1 px-2.5 text-[11px] font-semibold transition-all ${
                    i + 1 < step ? "bg-success/15 text-success cursor-pointer"
                      : i + 1 === step ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted text-muted-foreground cursor-default"
                  }`}>
                  {i + 1 < step ? <Check className="h-3 w-3" /> : <span className="text-[10px]">{i + 1}</span>}
                  <span className="hidden sm:inline">{s}</span>
                </button>
                {i < steps.length - 1 && (
                  <div className={`flex-1 h-[2px] mx-1 rounded-full ${i + 1 < step ? "bg-success/40" : "bg-border"}`} />
                )}
              </div>
            ))}
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-2">

          {/* ============ RESIDENT FLOW ============ */}
          {isResident && step === 1 && (
            <div className="space-y-4">
              {/* Type selector */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Type</p>
                <div className="flex gap-2">
                  {visitorTypes.map(({ type, label, emoji }) => (
                    <button key={type} onClick={() => { setSelectedType(type); setSelectedResident(null); setSelectedProfile(null); }}
                      className={`flex-1 flex flex-col items-center gap-1 py-3 px-2 rounded-xl border-2 text-center transition-all ${
                        selectedType === type ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/30"
                      }`}>
                      <span className="text-lg">{emoji}</span>
                      <span className={`text-[11px] font-bold ${selectedType === type ? "text-primary" : "text-foreground"}`}>{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Resident search */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Select Resident</p>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input value={residentSearchQuery} onChange={(e) => setResidentSearchQuery(e.target.value)}
                    placeholder="Search by name, room, or wing..." className="pl-10 h-10 rounded-xl text-sm" autoFocus />
                </div>
              </div>

              <div className="space-y-1.5 max-h-[280px] overflow-y-auto">
                {filteredResidents.map((resident) => (
                  <button key={resident.id} onClick={() => handleSelectResident(resident)}
                    className={`w-full text-left p-3 rounded-xl border transition-all ${
                      selectedResident?.id === resident.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                    }`}>
                    <div className="flex items-center gap-3">
                      <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
                        selectedResident?.id === resident.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      }`}>
                        <Home className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{resident.name}</p>
                        <span className="text-[10px] text-muted-foreground">{resident.room} • {resident.wing}</span>
                      </div>
                      {selectedResident?.id === resident.id && <Check className="h-4 w-4 text-primary shrink-0" />}
                    </div>
                  </button>
                ))}
                {filteredResidents.length === 0 && (
                  <div className="text-center py-6 border border-dashed border-border rounded-xl">
                    <p className="text-xs text-muted-foreground">No residents found</p>
                  </div>
                )}
              </div>

              {selectedResident && (
                <div className="rounded-xl border border-success/30 bg-success/5 p-3 flex items-center gap-3">
                  <Check className="h-4 w-4 text-success shrink-0" />
                  <p className="text-xs text-foreground">
                    <span className="font-bold">{selectedResident.name}</span> — {selectedResident.room}, {selectedResident.wing}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Schedule — expected return date/time + communication */}
          {isResident && step === 2 && (
            <div className="space-y-4">
              {selectedResident && (
                <div className="rounded-xl border border-border bg-muted/30 p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Resident</p>
                    <button onClick={() => setStep(1)} className="text-[10px] text-primary hover:underline font-semibold">Change</button>
                  </div>
                  <p className="text-sm font-bold text-foreground">{selectedResident.name}</p>
                  <p className="text-[10px] text-muted-foreground">{selectedResident.room} • {selectedResident.wing}</p>
                </div>
              )}

              {/* Communication details */}
              <div className="space-y-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Communication Details</p>
                <div className="space-y-1">
                  <Label className="text-[11px]">Mobile Number <span className="text-destructive">*</span></Label>
                  <Input value={formData.mobile} onChange={(e) => updateField("mobile", e.target.value)}
                    placeholder="07700..." className="rounded-lg h-9 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px]">Email <span className="text-destructive">*</span></Label>
                  <Input type="email" value={formData.email} onChange={(e) => updateField("email", e.target.value)}
                    placeholder="email@example.com" className="rounded-lg h-9 text-sm" />
                </div>
              </div>

              {/* Expected return date */}
              <div className="space-y-2.5 pt-2 border-t border-border">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Expected Return</p>
                <div className="space-y-1">
                  <Label className="text-[11px]">Return Date & Time <span className="text-destructive">*</span></Label>
                  <div className="flex gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="flex-1 justify-start text-left h-9 rounded-lg text-sm gap-2">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {expectedReturnDate ? format(expectedReturnDate, "dd MMM yyyy") : "Select date..."}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={expectedReturnDate} onSelect={(d) => d && setExpectedReturnDate(d)} initialFocus
                          className="pointer-events-auto"
                          disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))} />
                      </PopoverContent>
                    </Popover>
                    <Input type="time" value={expectedReturnTime} onChange={(e) => setExpectedReturnTime(e.target.value)}
                      className="w-[120px] rounded-lg h-9 text-sm" />
                  </div>
                  {expectedReturnDate && (() => {
                    const [h, m] = expectedReturnTime.split(":").map(Number);
                    const combined = new Date(expectedReturnDate);
                    combined.setHours(h, m, 0, 0);
                    const diffMs = combined.getTime() - Date.now();
                    if (diffMs > 0) {
                      const diffHours = Math.round(diffMs / 3600000);
                      return (
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-1">
                          <Clock className="h-3 w-3" />
                          Approximately <span className="font-semibold text-foreground">{diffHours < 24 ? `${diffHours} hour${diffHours !== 1 ? "s" : ""}` : `${Math.floor(diffHours / 24)} day${Math.floor(diffHours / 24) !== 1 ? "s" : ""} ${diffHours % 24} hr${diffHours % 24 !== 1 ? "s" : ""}`}</span> from now
                        </p>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Reason — why the resident is moving */}
          {isResident && step === 3 && (
            <div className="space-y-4">
              <div className="space-y-1">
                <Label className="text-[11px]">Reason for Check-Out <span className="text-destructive">*</span></Label>
                <div className="grid grid-cols-2 gap-2">
                  {leaveTypesData.map((lt) => (
                    <button
                      key={lt.id}
                      type="button"
                      onClick={() => {
                        updateField("checkoutReason", lt.name);
                        updateField("leaveType", lt.name);
                      }}
                      className={`rounded-xl border-2 p-3 text-left transition-all ${
                        formData.checkoutReason === lt.name
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/30"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{lt.emoji}</span>
                        <span className="text-xs font-bold text-foreground">{lt.name}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">{lt.description}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Comments (optional)</Label>
                <Textarea value={formData.comments} onChange={(e) => updateField("comments", e.target.value)}
                  placeholder="Any additional notes..." className="min-h-[50px] resize-none rounded-lg text-sm" />
              </div>
            </div>
          )}

          {/* Step 4: Accompanied By — who is going with the resident */}
          {isResident && step === 4 && (() => {
            const escortOptions = [
              { value: "family", label: "Family Member", emoji: "👨‍👩‍👧", showName: true },
              { value: "friend", label: "Friend", emoji: "👤", showName: true },
              { value: "staff", label: "Staff Member", emoji: "🧑‍⚕️", showStaff: true },
              { value: "transport", label: "Transport / Driver Only", emoji: "🚌" },
              { value: "medical-escort", label: "Medical Escort", emoji: "🏥" },
              { value: "alone", label: "Going Alone (Independent)", emoji: "🚶", showWarning: true },
              { value: "group", label: "Group Outing (Staff-led)", emoji: "👥" },
            ];
            const selected = escortOptions.find(o => o.value === formData.accompaniedBy);
            return (
              <div className="space-y-4">
                <div className="space-y-1">
                  <Label className="text-[11px]">Who is accompanying the resident? <span className="text-destructive">*</span></Label>
                  <div className="grid grid-cols-2 gap-2">
                    {escortOptions.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          updateField("accompaniedBy", opt.value);
                          if (!opt.showName && !opt.showStaff) updateField("accompaniedByName", "");
                        }}
                        className={`rounded-xl border-2 p-3 text-left transition-all ${
                          formData.accompaniedBy === opt.value
                            ? "border-primary bg-primary/5 shadow-sm"
                            : "border-border hover:border-primary/30"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{opt.emoji}</span>
                          <span className="text-xs font-semibold text-foreground">{opt.label}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Conditional sub-fields */}
                {selected?.showName && (
                  <div className="space-y-1 rounded-xl border border-border p-3 bg-muted/30">
                    <Label className="text-[11px]">{selected.label} Name <span className="text-muted-foreground">(optional)</span></Label>
                    <Input value={formData.accompaniedByName} onChange={(e) => updateField("accompaniedByName", e.target.value)}
                      placeholder={`Enter ${selected.label.toLowerCase()} name...`} className="rounded-lg h-9 text-sm" />
                  </div>
                )}

                {selected?.showStaff && (
                  <div className="space-y-1 rounded-xl border border-border p-3 bg-muted/30">
                    <Label className="text-[11px]">Staff Member</Label>
                    <Select value={formData.accompaniedByName} onValueChange={(val) => updateField("accompaniedByName", val)}>
                      <SelectTrigger className="rounded-lg h-9 text-sm"><SelectValue placeholder="Select staff member..." /></SelectTrigger>
                      <SelectContent>
                        {staffItems.map((s) => (
                          <SelectItem key={s.id} value={s.name}>{s.name} — {s.role}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {selected?.showWarning && (
                  <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 flex items-start gap-2.5">
                    <span className="text-lg">⚠️</span>
                    <div>
                      <p className="text-xs font-bold text-amber-700 dark:text-amber-400">Independent Outing</p>
                      <p className="text-[11px] text-amber-600 dark:text-amber-500 mt-0.5">Please confirm this resident has been assessed and approved for independent outings.</p>
                    </div>
                  </div>
                )}

                {/* Additional companions */}
                <div className="pt-2 border-t border-border">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Additional Companions (optional)</p>
                  {renderCompanions()}
                  {activeCompanionFields.length === 0 && companions.length === 0 && (
                    <p className="text-[11px] text-muted-foreground text-center py-2">No additional companions</p>
                  )}
                </div>
              </div>
            );
          })()}

          {isResident && step === 5 && renderReview()}

          {/* ============ NON-RESIDENT FLOW ============ */}
          {!isResident && step === 1 && (
            <div className="space-y-4">
              {/* Type selector */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Type</p>
                <div className="flex gap-2">
                  {visitorTypes.map(({ type, label, emoji }) => (
                    <button key={type} onClick={() => { setSelectedType(type); setSelectedResident(null); setSelectedProfile(null); }}
                      className={`flex-1 flex flex-col items-center gap-1 py-3 px-2 rounded-xl border-2 text-center transition-all ${
                        selectedType === type ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/30"
                      }`}>
                      <span className="text-lg">{emoji}</span>
                      <span className={`text-[11px] font-bold ${selectedType === type ? "text-primary" : "text-foreground"}`}>{label}</span>
                    </button>
                  ))}
                </div>
              </div>
              {/* Search */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Find or create profile</p>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setSelectedProfile(null); }}
                    placeholder="Search name or phone..." className="pl-10 h-10 rounded-xl text-sm" autoFocus />
                </div>
              </div>
              {searchQuery.trim() && (
                <div className="space-y-2">
                  {searchResults.length === 0 ? (
                    <div className="text-center py-6 border border-dashed border-border rounded-xl">
                      <p className="text-xs text-muted-foreground">No matches — click Next to add new</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                      {searchResults.map((profile) => (
                        <button key={profile.id} onClick={() => handleSelectProfile(profile)}
                          className={`w-full text-left p-3 rounded-xl border transition-all ${
                            selectedProfile?.id === profile.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                          }`}>
                          <div className="flex items-center gap-3">
                            <div className={`h-9 w-9 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                              selectedProfile?.id === profile.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                            }`}>{profile.firstName[0]}{profile.surname[0]}</div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-foreground truncate">{profile.firstName} {profile.surname}</p>
                              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Phone className="h-2.5 w-2.5" />{profile.mobile}</span>
                            </div>
                            {selectedProfile?.id === profile.id && <Check className="h-4 w-4 text-primary shrink-0" />}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {selectedProfile && (
                <div className="rounded-xl border border-success/30 bg-success/5 p-3 flex items-center gap-3">
                  <Check className="h-4 w-4 text-success shrink-0" />
                  <p className="text-xs text-foreground"><span className="font-bold">{selectedProfile.firstName} {selectedProfile.surname}</span> selected — details pre-filled</p>
                </div>
              )}
            </div>
          )}

          {!isResident && step === 2 && (
            <div className="space-y-4">
              {/* Photo */}
              <div className="rounded-xl border border-border p-3.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2.5 flex items-center gap-1.5">
                  <Camera className="h-3 w-3" /> Visitor Photo <span className="font-normal text-muted-foreground">(optional)</span>
                </p>
                {photo ? (
                  <div className="flex items-center gap-4">
                    <img src={photo} alt="Visitor" className="h-24 w-24 rounded-2xl object-cover border-2 border-success/30 shadow-sm" />
                    <div className="flex flex-col gap-2">
                      <p className="text-[11px] text-success font-semibold flex items-center gap-1"><Check className="h-3 w-3" /> Photo captured</p>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="h-7 text-[11px] rounded-lg gap-1" onClick={() => { setPhoto(null); startCamera(); }}><Camera className="h-3 w-3" /> Retake</Button>
                        <Button variant="ghost" size="sm" className="h-7 text-[11px] rounded-lg text-destructive hover:text-destructive gap-1" onClick={() => setPhoto(null)}><X className="h-3 w-3" /> Remove</Button>
                      </div>
                    </div>
                  </div>
                ) : showCamera ? (
                  <div className="space-y-3">
                    <div className="relative rounded-2xl overflow-hidden bg-muted border border-border aspect-[4/3] max-h-[200px] flex items-center justify-center">
                      <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
                      <div className="absolute inset-0 pointer-events-none border-2 border-primary/20 rounded-2xl" />
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="h-20 w-20 rounded-full border-2 border-primary/40 border-dashed" />
                      </div>
                    </div>
                    <div className="flex items-center justify-center gap-3">
                      <Button variant="ghost" size="sm" className="h-8 text-xs rounded-lg" onClick={stopCamera}>Cancel</Button>
                      <button onClick={capturePhoto}
                        className="h-12 w-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg hover:scale-105 transition-transform border-4 border-primary/20">
                        <Camera className="h-5 w-5" />
                      </button>
                      <div className="w-16" />
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={startCamera}
                      className="flex-1 flex items-center justify-center gap-2 py-4 rounded-xl border-2 border-dashed border-border hover:border-primary/40 hover:bg-primary/5 transition-all group">
                      <Camera className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                      <span className="text-xs font-medium text-muted-foreground group-hover:text-primary transition-colors">Take Photo</span>
                    </button>
                  </div>
                )}
                <canvas ref={canvasRef} className="hidden" />
                <input ref={fileInputRef} type="file" accept="image/*" capture="user" className="hidden" onChange={handleFileUpload} />
              </div>

              {/* Personal Details */}
              {selectedProfile ? (
                <div className="rounded-xl border border-border bg-muted/30 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Profile</p>
                    <button onClick={() => { setSelectedProfile(null); setStep(1); }} className="text-[10px] text-primary hover:underline font-semibold">Change</button>
                  </div>
                  <p className="text-sm font-bold text-foreground">{formData.firstName} {formData.surname}</p>
                  <div className="flex flex-wrap gap-2 mt-1.5">
                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Phone className="h-2.5 w-2.5" />{formData.mobile}</span>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Mail className="h-2.5 w-2.5" />{formData.email}</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">New Profile</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[11px]">First Name <span className="text-destructive">*</span></Label>
                      <Input value={formData.firstName} onChange={(e) => updateField("firstName", e.target.value)} placeholder="First name" className="rounded-lg h-9 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px]">Surname <span className="text-destructive">*</span></Label>
                      <Input value={formData.surname} onChange={(e) => updateField("surname", e.target.value)} placeholder="Surname" className="rounded-lg h-9 text-sm" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">Email <span className="text-destructive">*</span></Label>
                    <Input type="email" value={formData.email} onChange={(e) => updateField("email", e.target.value)} placeholder="email@example.com" className="rounded-lg h-9 text-sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[11px]">Phone</Label>
                      <Input value={formData.mobile} onChange={(e) => updateField("mobile", e.target.value)} placeholder="07700..." className="rounded-lg h-9 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px]">Address</Label>
                      <Input value={formData.address} onChange={(e) => updateField("address", e.target.value)} placeholder="Street, City" className="rounded-lg h-9 text-sm" />
                    </div>
                  </div>
                </div>
              )}

              {/* Visit info */}
              <div className="space-y-2.5 pt-2 border-t border-border">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Visit Details</p>
                <div className="grid grid-cols-2 gap-2">
                  <Select value={formData.whomToVisit} onValueChange={(val) => { updateField("whomToVisit", val); updateField("selectPerson", ""); }}>
                    <SelectTrigger className="rounded-lg h-9"><SelectValue placeholder="Visiting..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Resident">Resident</SelectItem>
                      <SelectItem value="Staff">Staff Member</SelectItem>
                    </SelectContent>
                  </Select>
                  {formData.whomToVisit && (
                    <Select value={formData.selectPerson} onValueChange={(val) => updateField("selectPerson", val)}>
                      <SelectTrigger className="rounded-lg h-9"><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>
                        {formData.whomToVisit === "Resident"
                          ? residentItems.map((r) => <SelectItem key={r.id} value={r.name}>{r.name} • {r.room}</SelectItem>)
                          : staffItems.map((s) => <SelectItem key={s.id} value={s.name}>{s.name} • {s.role}</SelectItem>)
                        }
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px]">Comments (optional)</Label>
                  <Textarea value={formData.comments} onChange={(e) => updateField("comments", e.target.value)}
                    placeholder="Any notes..." className="min-h-[50px] resize-none rounded-lg text-sm" />
                </div>
              </div>

              {/* Companions */}
              {renderCompanions()}
            </div>
          )}

          {!isResident && step === 3 && (
            <div className="space-y-4">
              {isContractor ? (
                <ContractorScreening
                  jurisdiction={jurisdiction}
                  answers={contractorScreeningAnswers}
                  onAnswersChange={setContractorScreeningAnswers}
                  selectedSupplier={selectedSupplier}
                  onSupplierChange={setSelectedSupplier}
                  onBlockedChange={(blocked, reason) => setContractorGate({ blocked, reason })}
                />
              ) : (
                <>
                  {renderHealthQuestions()}
                  {renderTemperature()}
                  {renderVaccination()}
                </>
              )}
            </div>
          )}

          {!isResident && step === 4 && renderReview()}

          {!screeningFlagged && overdueKeys.length > 0 && keyPolicy.enforcement === "block" && step === totalSteps && (
            <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-2">
              <p className="text-sm font-semibold text-destructive">Outstanding key or fob</p>
              <p className="text-xs text-muted-foreground">
                Take the item back in the Keys Register, or record why entry is being allowed. The reason is kept in the audit trail.
              </p>
              <Textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Reason for allowing this check-in (required)"
                className="min-h-[64px] text-sm rounded-lg"
              />
            </div>
          )}

          {screeningFlagged && step === totalSteps && (
            <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-2">
              <div className="flex items-start gap-2">
                <Shield className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-destructive">Health screening failed</p>
                  <p className="text-xs text-muted-foreground">
                    {hasHighTemperature ? `Temperature ${formData.bodyTemperature}°C is above 37.8°C. ` : ""}
                    {hasSymptomFlag ? "A symptom was reported. " : ""}
                    A staff override is required to continue, and it will be recorded in the audit trail.
                  </p>
                </div>
              </div>
              <Textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Reason for allowing this check-in (required)"
                className="min-h-[64px] text-sm rounded-lg"
              />
            </div>
          )}
        </div>


        {/* Footer */}
        <div className="shrink-0 flex items-center justify-between px-6 py-3 border-t border-border bg-card/80 backdrop-blur-sm">
          <Button variant="ghost" size="sm" onClick={handleClose} className="text-muted-foreground">Cancel</Button>
          <div className="flex gap-2">
            {step > 1 && (
              <Button variant="outline" size="sm" onClick={() => setStep(step - 1)} className="gap-1 rounded-xl">
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </Button>
            )}
            {step < totalSteps ? (
              <Button size="sm" onClick={() => setStep(step + 1)} className="gap-1 rounded-xl"
                disabled={!canProceedCurrentStep()}>
                Next <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button size="sm" onClick={handleSubmit} className="gap-1 rounded-xl" disabled={!canSubmit}>
                <Check className="h-3.5 w-3.5" />
                {isResident ? "Confirm Check-Out" : "Check In"}
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
