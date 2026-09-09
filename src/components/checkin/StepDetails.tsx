import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Camera, Check, X, Users, Phone, Mail, UserCircle, MapPin, MessageSquare, Search, UserCheck, UserPlus } from "lucide-react";
import { usePeopleLookup } from "@/hooks/usePeopleLookup";
import { Checkbox } from "@/components/ui/checkbox";
import { CompanionDetail, VisitorType } from "@/types/visitor";
import { CheckInFormData, VisitorProfile } from "./useCheckInFlow";
import { useRef, useState, useCallback } from "react";
import type { CompanionFieldSpec } from "@/lib/companionFields";

interface StepDetailsProps {
  formData: CheckInFormData;
  updateField: (field: string, value: string | number | boolean) => void;
  selectedProfile: VisitorProfile | null;
  isReturning: boolean;
  selectedType: VisitorType;
  residentItems: { id: string; name: string; room: string; wing: string }[];
  staffItems: { id: string; name: string; role: string; department: string }[];
  companions: CompanionDetail[];
  setCompanions: React.Dispatch<React.SetStateAction<CompanionDetail[]>>;
  activeCompanionFields: CompanionFieldSpec[];
  photo: string | null;
  setPhoto: (photo: string | null) => void;
  onChangeProfile: () => void;
}

export function StepDetails({
  formData,
  updateField,
  selectedProfile,
  isReturning,
  selectedType,
  residentItems,
  staffItems,
  companions,
  setCompanions,
  activeCompanionFields,
  photo,
  setPhoto,
  onChangeProfile,
}: StepDetailsProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showCamera, setShowCamera] = useState(false);

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
  }, [stopCamera, setPhoto]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhoto(reader.result as string);
    reader.readAsDataURL(file); e.target.value = "";
  };

  const addCompanion = () => {
    const empty: CompanionDetail = {};
    activeCompanionFields.forEach((f) => { empty[f.key] = ""; });
    setCompanions((prev) => [...prev, empty]);
  };

  return (
    <div className="space-y-6">
      {/* Returning visitor quick summary */}
      {isReturning && selectedProfile ? (
        <div className="rounded-2xl border-2 border-primary/20 bg-primary/5 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center">
                <Check className="h-3.5 w-3.5 text-primary" />
              </div>
              <p className="text-[12px] font-bold uppercase tracking-wider text-primary">Returning Visitor</p>
            </div>
            <button onClick={onChangeProfile} className="text-[12px] text-primary hover:underline font-semibold px-2 py-1 rounded-lg hover:bg-primary/10 transition-colors">Change</button>
          </div>
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-[15px] font-bold text-primary">
              {formData.firstName?.[0]}{formData.surname?.[0]}
            </div>
            <div>
              <p className="text-[16px] font-bold text-foreground">{formData.firstName} {formData.surname}</p>
              <div className="flex flex-wrap gap-3 mt-1">
                {formData.mobile && <span className="text-[12px] text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />{formData.mobile}</span>}
                {formData.email && <span className="text-[12px] text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" />{formData.email}</span>}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Two-column layout: Photo + Personal Details side by side */}
          <div className="grid grid-cols-[auto_1fr] gap-5">
            {/* Photo capture — compact left column */}
            <div className="w-[140px]">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <Camera className="h-3 w-3" /> Photo
              </p>
              {photo ? (
                <div className="space-y-2">
                  <img src={photo} alt="" className="h-[120px] w-[120px] rounded-2xl object-cover border-2 border-success/30 shadow-sm" />
                  <div className="flex gap-1.5">
                    <Button variant="outline" size="sm" className="h-7 text-[10px] rounded-lg gap-1 flex-1" onClick={() => { setPhoto(null); startCamera(); }}>
                      <Camera className="h-3 w-3" /> Retake
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => setPhoto(null)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ) : showCamera ? (
                <div className="space-y-2">
                  <div className="relative rounded-2xl overflow-hidden bg-muted border border-border h-[120px] w-[120px]">
                    <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
                  </div>
                  <div className="flex gap-1.5">
                    <Button variant="ghost" size="sm" className="h-7 text-[10px] flex-1" onClick={stopCamera}>Cancel</Button>
                    <button onClick={capturePhoto} className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md hover:scale-105 transition-transform">
                      <Camera className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={startCamera} className="w-[120px] h-[120px] flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border hover:border-primary/40 hover:bg-primary/5 transition-all group">
                  <Camera className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
                  <span className="text-[11px] font-medium text-muted-foreground group-hover:text-primary transition-colors">Take Photo</span>
                </button>
              )}
              <canvas ref={canvasRef} className="hidden" />
              <input ref={fileInputRef} type="file" accept="image/*" capture="user" className="hidden" onChange={handleFileUpload} />
            </div>

            {/* Personal details — right column */}
            <div className="space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <UserCircle className="h-3 w-3" /> Personal Details
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label className="text-[12px] font-medium">First Name <span className="text-destructive">*</span></Label>
                  <Input value={formData.firstName} onChange={(e) => updateField("firstName", e.target.value)} placeholder="First name" className="rounded-xl h-10 text-[14px]" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[12px] font-medium">Surname <span className="text-destructive">*</span></Label>
                  <Input value={formData.surname} onChange={(e) => updateField("surname", e.target.value)} placeholder="Surname" className="rounded-xl h-10 text-[14px]" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label className="text-[12px] font-medium">Email</Label>
                  <Input type="email" value={formData.email} onChange={(e) => updateField("email", e.target.value)} placeholder="email@example.com" className="rounded-xl h-10 text-[14px]" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[12px] font-medium">Phone</Label>
                  <Input value={formData.mobile} onChange={(e) => updateField("mobile", e.target.value)} placeholder="07700..." className="rounded-xl h-10 text-[14px]" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-[12px] font-medium">Address</Label>
                <Input value={formData.address} onChange={(e) => updateField("address", e.target.value)} placeholder="Street, City (optional)" className="rounded-xl h-10 text-[14px]" />
              </div>
            </div>
          </div>
        </>
      )}

      {/* Visit details */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <MapPin className="h-3 w-3" /> Who Are You Visiting?
        </p>
        <Select value={formData.whomToVisit} onValueChange={(val) => { updateField("whomToVisit", val); updateField("selectPerson", ""); }}>
          <SelectTrigger className="rounded-xl h-10 text-[14px]"><SelectValue placeholder="Visiting a..." /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Resident">Resident</SelectItem>
            <SelectItem value="Staff">Staff Member</SelectItem>
          </SelectContent>
        </Select>

        {formData.whomToVisit === "Resident" && (
          <div className="space-y-1.5">
            <Label className="text-[12px] font-medium">Select Resident</Label>
            <Select value={formData.selectPerson} onValueChange={(val) => updateField("selectPerson", val)}>
              <SelectTrigger className="rounded-xl h-10 text-[14px]"><SelectValue placeholder="Search or select resident..." /></SelectTrigger>
              <SelectContent>
                {residentItems.length === 0 && (
                  <div className="px-3 py-4 text-[12px] text-muted-foreground text-center">
                    No residents recorded for this site yet
                  </div>
                )}
                {residentItems.map((r) => (
                  <SelectItem key={r.id} value={r.name}>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{r.name}</span>
                      <span className="text-muted-foreground text-[12px]">•</span>
                      <span className="text-muted-foreground text-[12px]">{r.room || "No room"}</span>
                      {r.wing && (
                        <>
                          <span className="text-muted-foreground text-[12px]">•</span>
                          <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-primary/10 text-primary font-medium">{r.wing}</span>
                        </>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {formData.whomToVisit === "Staff" && (
          <div className="space-y-1.5">
            <Label className="text-[12px] font-medium">Select Staff Member</Label>
            <Select value={formData.selectPerson} onValueChange={(val) => updateField("selectPerson", val)}>
              <SelectTrigger className="rounded-xl h-10 text-[14px]"><SelectValue placeholder="Select staff member..." /></SelectTrigger>
              <SelectContent>
                {staffItems.map((s) => (
                  <SelectItem key={s.id} value={s.name}>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{s.name}</span>
                      <span className="text-muted-foreground text-[12px]">• {s.role}</span>
                      {s.department && <span className="text-muted-foreground text-[12px]">• {s.department}</span>}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-1">
          <Label className="text-[12px] font-medium flex items-center gap-1.5">
            <MessageSquare className="h-3 w-3" /> Comments <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Textarea value={formData.comments} onChange={(e) => updateField("comments", e.target.value)}
            placeholder="Any notes about this visit..." className="min-h-[50px] resize-none rounded-xl text-[14px]" />
        </div>
      </div>

      {/* Companions */}
      {activeCompanionFields.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Users className="h-3 w-3" /> Companions ({companions.length})
            </p>
            <Button variant="outline" size="sm" className="h-8 text-[12px] gap-1.5 rounded-lg" onClick={addCompanion}>
              <Plus className="h-3 w-3" /> Add Companion
            </Button>
          </div>
          {companions.map((companion, cIdx) => (
            <div key={cIdx} className="rounded-xl border border-border bg-muted/30 p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                    {cIdx + 1}
                  </div>
                  <span className="text-[12px] font-semibold text-foreground">Companion {cIdx + 1}</span>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10"
                  onClick={() => setCompanions((prev) => prev.filter((_, i) => i !== cIdx))}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {activeCompanionFields.map((f) => {
                  const key = f.key;
                  const value = companion[key] || "";
                  const missing = f.required && !String(value).trim();
                  const setValue = (v: string) =>
                    setCompanions((prev) => prev.map((c, i) => (i === cIdx ? { ...c, [key]: v } : c)));
                  const inputType = f.type === "date" ? "date" : f.type === "email" ? "email" : f.type === "tel" ? "tel" : "text";
                  return (
                    <div key={`${f.source}-${f.id}`} className="space-y-1">
                      <Label className="text-[11px] font-medium">{f.label}{f.required && <span className="text-destructive ml-0.5">*</span>}</Label>
                      {f.type === "select" || f.type === "yesno" ? (
                        <Select value={String(value)} onValueChange={setValue} disabled={!f.editable}>
                          <SelectTrigger className="rounded-lg h-9 text-[13px]" aria-label={f.label}>
                            <SelectValue placeholder={f.label} />
                          </SelectTrigger>
                          <SelectContent>
                            {(f.type === "yesno" ? ["Yes", "No"] : f.choices || []).map((opt) => (
                              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : f.type === "textarea" ? (
                        <Textarea value={String(value)} onChange={(e) => setValue(e.target.value)} readOnly={!f.editable}
                          placeholder={f.label} className="rounded-lg text-[13px] min-h-[60px] resize-none" />
                      ) : (
                        <Input type={inputType} value={String(value)} onChange={(e) => setValue(e.target.value)} readOnly={!f.editable}
                          placeholder={f.label} className="rounded-lg h-9 text-[13px]" />
                      )}
                      {f.help && <p className="text-[11px] text-muted-foreground">{f.help}</p>}
                      {missing && <p className="text-[11px] text-destructive">{f.label} is needed before signing in</p>}
                    </div>
                  );
                })}
              </div>
              <CompanionIdentity
                companion={companion}
                onChange={(patch) => setCompanions((prev) => prev.map((c, i) => (i === cIdx ? { ...c, ...patch } : c)))}
              />
            </div>
          ))}
          {companions.length === 0 && (
            <div className="text-center py-4 text-[12px] text-muted-foreground">
              No companions added — this visitor is checking in alone
            </div>
          )}
        </div>
      )}
    </div>
  );
}


/**
 * Lets reception recognise a companion who is already known at this site, or
 * deliberately record them as a new person. A name on its own never links
 * anyone automatically.
 */
function CompanionIdentity({
  companion,
  onChange,
}: {
  companion: CompanionDetail;
  onChange: (patch: CompanionDetail) => void;
}) {
  const [query, setQuery] = useState("");
  const { matches, searching } = usePeopleLookup(query);

  if (companion.person_id) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2">
        <span className="flex items-center gap-1.5 text-[12px] text-foreground">
          <UserCheck className="h-3.5 w-3.5" aria-hidden /> Linked to someone already known here
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-[12px]"
          onClick={() => onChange({ person_id: undefined })}
        >
          Unlink
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search people already known here (optional)"
          aria-label="Search people already known at this site"
          className="rounded-lg h-9 pl-8 text-[13px]"
        />
      </div>
      {query.trim().length >= 2 && (
        <div className="rounded-lg border border-border divide-y divide-border">
          {searching && <p className="px-3 py-2 text-[12px] text-muted-foreground">Searching…</p>}
          {!searching && matches.length === 0 && (
            <p className="px-3 py-2 text-[12px] text-muted-foreground">No one here matches that. Enter their details above.</p>
          )}
          {matches.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                onChange({
                  person_id: m.id,
                  name: `${m.firstName} ${m.surname}`.trim(),
                  phone: m.mobile || companion.phone,
                  email: m.email || companion.email,
                  create_person: undefined,
                });
                setQuery("");
              }}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-[12px] hover:bg-muted"
            >
              <span>
                {m.firstName} {m.surname}
                {m.mobile ? ` · ${m.mobile}` : ""}
              </span>
              <span className="text-muted-foreground">{m.strongMatch ? "Contact matches" : "Name matches"}</span>
            </button>
          ))}
        </div>
      )}
      <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
        <Checkbox
          checked={companion.create_person === "true"}
          onCheckedChange={(checked) => onChange({ create_person: checked ? "true" : undefined })}
        />
        <span className="flex items-center gap-1.5">
          <UserPlus className="h-3.5 w-3.5" aria-hidden /> Remember this companion for future visits
        </span>
      </label>
    </div>
  );
}
