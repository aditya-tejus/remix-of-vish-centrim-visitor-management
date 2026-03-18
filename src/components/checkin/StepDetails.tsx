import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Camera, Check, X, Users, Phone, Mail } from "lucide-react";
import { CompanionDetail, VisitorType } from "@/types/visitor";
import { CheckInFormData, VisitorProfile } from "./useCheckInFlow";
import { useRef, useState, useCallback } from "react";

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
  activeCompanionFields: { id: string; field_key: string; label: string; required: boolean }[];
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
    activeCompanionFields.forEach((f) => { empty[f.field_key.replace("companion_", "")] = ""; });
    setCompanions((prev) => [...prev, empty]);
  };

  return (
    <div className="space-y-5">
      {/* Returning visitor quick summary */}
      {isReturning && selectedProfile ? (
        <div className="rounded-xl border border-border bg-muted/30 p-3.5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Returning Visitor</p>
            <button onClick={onChangeProfile} className="text-[11px] text-primary hover:underline font-semibold">Change</button>
          </div>
          <p className="text-[14px] font-bold text-foreground">{formData.firstName} {formData.surname}</p>
          <div className="flex flex-wrap gap-3 mt-1.5">
            {formData.mobile && <span className="text-[12px] text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />{formData.mobile}</span>}
            {formData.email && <span className="text-[12px] text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" />{formData.email}</span>}
          </div>
        </div>
      ) : (
        <>
          {/* Photo capture */}
          <div className="rounded-xl border border-border p-3.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2.5 flex items-center gap-1.5">
              <Camera className="h-3 w-3" /> Visitor Photo <span className="font-normal">(optional)</span>
            </p>
            {photo ? (
              <div className="flex items-center gap-4">
                <img src={photo} alt="" className="h-20 w-20 rounded-2xl object-cover border-2 border-success/30 shadow-sm" />
                <div className="flex flex-col gap-2">
                  <p className="text-[12px] text-success font-semibold flex items-center gap-1"><Check className="h-3 w-3" /> Photo captured</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="h-7 text-[11px] rounded-lg gap-1" onClick={() => { setPhoto(null); startCamera(); }}><Camera className="h-3 w-3" /> Retake</Button>
                    <Button variant="ghost" size="sm" className="h-7 text-[11px] text-destructive gap-1" onClick={() => setPhoto(null)}><X className="h-3 w-3" /> Remove</Button>
                  </div>
                </div>
              </div>
            ) : showCamera ? (
              <div className="space-y-3">
                <div className="relative rounded-2xl overflow-hidden bg-muted border border-border aspect-[4/3] max-h-[200px] flex items-center justify-center">
                  <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
                </div>
                <div className="flex items-center justify-center gap-3">
                  <Button variant="ghost" size="sm" onClick={stopCamera}>Cancel</Button>
                  <button onClick={capturePhoto} className="h-12 w-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg hover:scale-105 transition-transform border-4 border-primary/20">
                    <Camera className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={startCamera} className="w-full flex items-center justify-center gap-2 py-4 rounded-xl border-2 border-dashed border-border hover:border-primary/40 hover:bg-primary/5 transition-all group">
                <Camera className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
                <span className="text-[13px] font-medium text-muted-foreground group-hover:text-primary">Take Photo</span>
              </button>
            )}
            <canvas ref={canvasRef} className="hidden" />
            <input ref={fileInputRef} type="file" accept="image/*" capture="user" className="hidden" onChange={handleFileUpload} />
          </div>

          {/* Personal details */}
          <div className="space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Personal Details</p>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <Label className="text-[12px]">First Name <span className="text-destructive">*</span></Label>
                <Input value={formData.firstName} onChange={(e) => updateField("firstName", e.target.value)} placeholder="First name" className="rounded-xl h-10 text-[14px]" />
              </div>
              <div className="space-y-1">
                <Label className="text-[12px]">Surname <span className="text-destructive">*</span></Label>
                <Input value={formData.surname} onChange={(e) => updateField("surname", e.target.value)} placeholder="Surname" className="rounded-xl h-10 text-[14px]" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[12px]">Email</Label>
              <Input type="email" value={formData.email} onChange={(e) => updateField("email", e.target.value)} placeholder="email@example.com (optional)" className="rounded-xl h-10 text-[14px]" />
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <Label className="text-[12px]">Phone</Label>
                <Input value={formData.mobile} onChange={(e) => updateField("mobile", e.target.value)} placeholder="07700..." className="rounded-xl h-10 text-[14px]" />
              </div>
              <div className="space-y-1">
                <Label className="text-[12px]">Address</Label>
                <Input value={formData.address} onChange={(e) => updateField("address", e.target.value)} placeholder="Street, City" className="rounded-xl h-10 text-[14px]" />
              </div>
            </div>
          </div>
        </>
      )}

      {/* Visit details */}
      <div className="space-y-3 pt-3 border-t border-border">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Who Are You Visiting?</p>
        <Select value={formData.whomToVisit} onValueChange={(val) => { updateField("whomToVisit", val); updateField("selectPerson", ""); }}>
          <SelectTrigger className="rounded-xl h-10 text-[14px]"><SelectValue placeholder="Visiting a..." /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Resident">Resident</SelectItem>
            <SelectItem value="Staff">Staff Member</SelectItem>
          </SelectContent>
        </Select>

        {formData.whomToVisit === "Resident" && (
          <div className="space-y-1.5">
            <Label className="text-[12px]">Select Resident</Label>
            <Select value={formData.selectPerson} onValueChange={(val) => updateField("selectPerson", val)}>
              <SelectTrigger className="rounded-xl h-10 text-[14px]"><SelectValue placeholder="Search or select resident..." /></SelectTrigger>
              <SelectContent>
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
            <Label className="text-[12px]">Select Staff Member</Label>
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
          <Label className="text-[12px]">Comments (optional)</Label>
          <Textarea value={formData.comments} onChange={(e) => updateField("comments", e.target.value)}
            placeholder="Any notes..." className="min-h-[50px] resize-none rounded-xl text-[14px]" />
        </div>
      </div>

      {/* Companions — collapsible */}
      {activeCompanionFields.length > 0 && (
        <div className="space-y-3 pt-3 border-t border-border">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Users className="h-3 w-3" /> Companions ({companions.length})
            </p>
            <Button variant="outline" size="sm" className="h-8 text-[12px] gap-1 rounded-lg" onClick={addCompanion}>
              <Plus className="h-3 w-3" /> Add
            </Button>
          </div>
          {companions.map((companion, cIdx) => (
            <div key={cIdx} className="rounded-xl border border-border p-3 space-y-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-semibold text-muted-foreground">Person {cIdx + 1}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive"
                  onClick={() => setCompanions((prev) => prev.filter((_, i) => i !== cIdx))}><Trash2 className="h-3 w-3" /></Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {activeCompanionFields.map((f) => {
                  const key = f.field_key.replace("companion_", "");
                  return (
                    <div key={f.id} className="space-y-1">
                      <Label className="text-[11px]">{f.label}{f.required && <span className="text-destructive ml-0.5">*</span>}</Label>
                      <Input value={companion[key] || ""} onChange={(e) => setCompanions((prev) => prev.map((c, i) => i === cIdx ? { ...c, [key]: e.target.value } : c))}
                        placeholder={f.label} className="rounded-lg h-9 text-[13px]" />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {companions.length === 0 && (
            <p className="text-[12px] text-muted-foreground text-center py-2">No companions added</p>
          )}
        </div>
      )}
    </div>
  );
}
