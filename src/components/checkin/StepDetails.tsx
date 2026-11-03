import { ConfiguredDetails } from "./ConfiguredDetails";
import { Button } from "@/components/ui/button";
import { Camera, Check, X, Phone, Mail } from "lucide-react";
import { VisitorType } from "@/types/visitor";
import { CheckInFormData, VisitorProfile } from "./useCheckInFlow";
import { useRef, useState, useCallback, useEffect } from "react";
import type { CheckInFieldSpec } from "@/lib/checkInFields";

interface StepDetailsProps {
  formData: CheckInFormData;
  updateField: (field: string, value: string | number | boolean) => void;
  selectedProfile: VisitorProfile | null;
  isReturning: boolean;
  selectedType: VisitorType;
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
  useEffect(() => () => { streamRef.current?.getTracks().forEach(track => track.stop()); }, []);
  useEffect(() => {
    if (showCamera && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      void videoRef.current.play();
    }
  }, [showCamera]);

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
        <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-accent/60 p-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-card text-sm font-extrabold text-accent-foreground">
            {formData.firstName?.[0]}{formData.surname?.[0]}
          </div>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-xs font-bold text-accent-foreground"><Check aria-hidden className="h-3.5 w-3.5" strokeWidth={3} />Returning visitor — details filled in</p>
            <p className="truncate text-base font-extrabold text-foreground">{formData.firstName} {formData.surname}</p>
            <div className="flex flex-wrap gap-x-3 text-[13px] text-muted-foreground">
              {formData.mobile && <span className="flex items-center gap-1"><Phone aria-hidden className="h-3 w-3" />{formData.mobile}</span>}
              {formData.email && <span className="flex items-center gap-1"><Mail aria-hidden className="h-3 w-3" />{formData.email}</span>}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onChangeProfile} className="shrink-0 text-primary-hover">Change</Button>
        </div>
      ) : null}

      {/* Personal details — exactly what this site asks for this person type */}
      <div className="flex flex-col-reverse gap-5">
        {/* Photo capture — compact left column */}
        <div className="w-full space-y-2">
          <p className="text-sm font-semibold text-foreground">Photo <span className="font-normal text-muted-foreground">(optional)</span></p>
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
            <Button variant="outline" onClick={startCamera} className="gap-2">
              <Camera className="h-4 w-4" aria-hidden />Take photo
            </Button>
          )}
          <canvas ref={canvasRef} className="hidden" />
          <input ref={fileInputRef} type="file" accept="image/*" capture="user" className="hidden" onChange={handleFileUpload} />
        </div>

        <ConfiguredDetails fields={activeFields} values={formData as unknown as Record<string, unknown>} onChange={updateField} />
      </div>

    </div>
  );
}


