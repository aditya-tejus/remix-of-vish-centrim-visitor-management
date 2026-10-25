import { ConfiguredDetails } from "./ConfiguredDetails";
import { Destination } from "./Destination";
import { AdditionalPeople } from "./AdditionalPeople";
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
import type { CheckInFieldSpec } from "@/lib/checkInFields";

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
  /** Exactly the fields this site asks for this person type. */
  activeFields: CheckInFieldSpec[];
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
  activeFields,
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


  return (
    <div className="space-y-6">
      {/* Returning visitor quick summary */}
      {isReturning && selectedProfile ? (
        <div className="border-l-2 border-primary bg-accent/40 px-3 py-2">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center">
                <Check className="h-3.5 w-3.5 text-primary" />
              </div>
              <p className="text-sm font-bold uppercase tracking-wider text-primary">Returning Visitor</p>
            </div>
            <Button variant="ghost" onClick={onChangeProfile} className="text-sm text-primary hover:underline font-semibold px-2 py-1 rounded-lg hover:bg-primary/10 transition-colors">Change</Button>
          </div>
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-[15px] font-bold text-primary">
              {formData.firstName?.[0]}{formData.surname?.[0]}
            </div>
            <div>
              <p className="text-[16px] font-bold text-foreground">{formData.firstName} {formData.surname}</p>
              <div className="flex flex-wrap gap-3 mt-1">
                {formData.mobile && <span className="text-sm text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />{formData.mobile}</span>}
                {formData.email && <span className="text-sm text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" />{formData.email}</span>}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Personal details — exactly what this site asks for this person type */}
      <div className="flex flex-col-reverse gap-4">
        {/* Photo capture — compact left column */}
        <div className="w-full">
          <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
            <Camera className="h-3 w-3" aria-hidden /> Photo
          </p>
          {photo ? (
            <div className="space-y-2">
              <img src={photo} alt="" className="h-[120px] w-[120px] rounded-control object-cover border-2 border-success/30 shadow-sm" />
              <div className="flex gap-1.5">
                <Button variant="outline" size="sm" className="h-7 text-sm rounded-lg gap-1 flex-1" onClick={() => { setPhoto(null); startCamera(); }}>
                  <Camera className="h-3 w-3" aria-hidden /> Retake
                </Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => setPhoto(null)} aria-label="Remove photo">
                  <X className="h-3 w-3" aria-hidden />
                </Button>
              </div>
            </div>
          ) : showCamera ? (
            <div className="space-y-2">
              <div className="relative rounded-control overflow-hidden bg-muted border border-border h-[120px] w-[120px]">
                <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
              </div>
              <div className="flex gap-1.5">
                <Button variant="ghost" size="sm" className="h-7 text-sm flex-1" onClick={stopCamera}>Cancel</Button>
                <Button size="sm" onClick={capturePhoto} className="h-8 w-8 p-0 rounded-full" aria-label="Take photo">
                  <Camera className="h-3.5 w-3.5" aria-hidden />
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" onClick={startCamera} className="w-full min-h-touch flex items-center justify-center gap-2 rounded-control border-2 border-dashed border-border hover:border-primary/40 hover:bg-primary/5 transition-all group">
              <Camera className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" aria-hidden />
              <span className="text-sm font-medium text-muted-foreground group-hover:text-primary transition-colors">Take Photo</span>
            </Button>
          )}
          <canvas ref={canvasRef} className="hidden" />
          <input ref={fileInputRef} type="file" accept="image/*" capture="user" className="hidden" onChange={handleFileUpload} />
        </div>

        <ConfiguredDetails fields={activeFields} values={formData as unknown as Record<string, unknown>} onChange={updateField} />
      </div>


      <Destination formData={formData} updateField={updateField} residentItems={residentItems} staffItems={staffItems} activeFields={activeFields} />
      <AdditionalPeople companions={companions} setCompanions={setCompanions} activeCompanionFields={activeCompanionFields} />

    </div>
  );
}


