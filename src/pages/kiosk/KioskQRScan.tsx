import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useVisitors } from "@/hooks/useVisitors";
import { useToast } from "@/hooks/use-toast";
import { QrCode, Camera, CameraOff, Keyboard, ArrowLeft, CheckCircle2, LogOut, AlertTriangle, UserRoundPlus } from "lucide-react";
import { motion } from "framer-motion";
import { Html5Qrcode } from "html5-qrcode";

type ScanResult = { type: "checkin" | "checkout" | "already-out" | "notfound"; visitor?: any };

export default function KioskQRScan() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get("mode");
  const { visitors, addVisitor, checkOutVisitor } = useVisitors();
  const { toast } = useToast();

  const [manualCode, setManualCode] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [inputMode, setInputMode] = useState<"camera" | "manual">("camera");
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const lookupAndAct = useCallback((code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;

    // Match by id, qr_code, or full name
    const match = visitors.find(
      (v) => v.id === trimmed ||
        v.qrCode === trimmed ||
        `${v.firstName} ${v.surname}`.toLowerCase() === trimmed.toLowerCase()
    );

    if (!match) {
      setResult({ type: "notfound" });
      return;
    }

    if (match.status === "checked-in") {
      if (mode === "checkin") {
        setResult({ type: "checkin", visitor: match });
        toast({ title: "Already checked in", description: `${match.firstName} is already here.` });
      } else {
        checkOutVisitor(match.id);
        setResult({ type: "checkout", visitor: match });
        toast({ title: "Checked Out", description: `${match.firstName} ${match.surname} checked out via QR.` });
      }
    } else {
      if (mode === "checkout") {
        setResult({ type: "already-out", visitor: match });
      } else {
        addVisitor({
          firstName: match.firstName,
          surname: match.surname,
          email: match.email,
          mobile: match.mobile,
          type: match.type,
          checkInTime: new Date(),
          checkOutTime: null,
          whomToVisit: match.whomToVisit,
          address: match.address,
          status: "checked-in",
          healthDeclaration: false,
          additionalVisitors: 0,
          comments: "QR scan check-in",
          retentionExpiry: new Date(Date.now() + 86400000 * 60),
          acknowledgedPrivacy: match.acknowledgedPrivacy,
        });
        setResult({ type: "checkin", visitor: match });
        toast({ title: "Checked In", description: `Welcome back, ${match.firstName}!` });
      }
    }
  }, [visitors, mode, addVisitor, checkOutVisitor, toast]);

  useEffect(() => {
    if (inputMode !== "camera" || result) return;

    let scanner: Html5Qrcode | null = null;
    const startScanner = async () => {
      try {
        scanner = new Html5Qrcode("kiosk-qr-reader");
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            lookupAndAct(decodedText);
            scanner?.stop().catch(() => {});
          },
          () => {}
        );
        setCameraActive(true);
        setCameraError(false);
      } catch {
        setCameraError(true);
        setCameraActive(false);
        setInputMode("manual");
      }
    };

    startScanner();

    return () => {
      scanner?.stop().catch(() => {});
      scannerRef.current = null;
      setCameraActive(false);
    };
  }, [inputMode, result, lookupAndAct]);

  const handleManualSubmit = () => {
    lookupAndAct(manualCode);
    setManualCode("");
  };

  const handleReset = () => {
    setResult(null);
    setManualCode("");
  };

  // Result screen
  if (result) {
    const v = result.visitor;
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full space-y-6 text-center">
        {result.type === "checkin" && (
          <>
            <div className="h-20 w-20 rounded-full bg-success/10 text-success flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-12 w-12" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">Welcome, {v?.firstName}!</h2>
            <p className="text-lg text-muted-foreground">You have been checked in successfully.</p>
          </>
        )}
        {result.type === "checkout" && (
          <>
            <div className="h-20 w-20 rounded-full bg-warning/10 text-warning flex items-center justify-center mx-auto">
              <LogOut className="h-12 w-12" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">Goodbye, {v?.firstName}!</h2>
            <p className="text-lg text-muted-foreground">You have been checked out.</p>
          </>
        )}
        {result.type === "already-out" && (
          <>
            <div className="h-20 w-20 rounded-full bg-info/10 text-info flex items-center justify-center mx-auto">
              <AlertTriangle className="h-12 w-12" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">{v ? `${v.firstName} ${v.surname}` : ""}</h2>
            <p className="text-lg text-muted-foreground">This person is not currently checked in.</p>
          </>
        )}
        {result.type === "notfound" && (
          <>
            <div className="h-20 w-20 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
              <AlertTriangle className="h-12 w-12" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">Not Found</h2>
            <p className="text-lg text-muted-foreground">No visitor found with this code.</p>
          </>
        )}
        <div className="flex gap-3 pt-4">
          <Button variant="secondary" onClick={handleReset} className="flex-1 h-14 text-base gap-2 border border-border">
            <QrCode className="h-5 w-5" /> Scan Another
          </Button>
          <Button onClick={() => navigate("/kiosk/home")} className="flex-1 h-14 text-base gap-2">
            Done
          </Button>
        </div>
        {result.type === "notfound" && (
          <Button variant="secondary" onClick={() => navigate("/kiosk/checkin")} className="w-full h-14 text-base gap-2 border border-border">
            <UserRoundPlus className="h-5 w-5" /> Check In Manually
          </Button>
        )}
      </motion.div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-foreground">Scan QR Code</h2>
        <p className="text-lg text-muted-foreground mt-1">
          {mode === "checkin" ? "Scan your visitor card to check in" : mode === "checkout" ? "Scan your visitor card to check out" : "Scan your visitor card or QR code"}
        </p>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-3 justify-center">
        <button
          onClick={() => setInputMode("camera")}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl text-base font-semibold transition-all min-h-[48px] ${
            inputMode === "camera" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground border border-border active:bg-accent"
          }`}
        >
          <Camera className="h-5 w-5" /> Camera
        </button>
        <button
          onClick={() => { setInputMode("manual"); scannerRef.current?.stop().catch(() => {}); }}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl text-base font-semibold transition-all min-h-[48px] ${
            inputMode === "manual" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground border border-border active:bg-accent"
          }`}
        >
          <Keyboard className="h-5 w-5" /> Type Code
        </button>
      </div>

      {inputMode === "camera" && (
        <div className="space-y-3">
          <div
            id="kiosk-qr-reader"
            ref={containerRef}
            className="w-full max-w-sm mx-auto aspect-square rounded-2xl overflow-hidden border-2 border-border bg-muted"
          />
          {cameraError && (
            <div className="rounded-xl border-2 border-destructive/20 bg-destructive/5 p-4 text-center space-y-2">
              <CameraOff className="h-8 w-8 text-destructive mx-auto" />
              <p className="text-sm text-destructive font-medium">Camera not available</p>
              <p className="text-sm text-muted-foreground">Please use the manual code entry instead.</p>
            </div>
          )}
          {cameraActive && (
            <p className="text-center text-sm text-muted-foreground animate-pulse">Point the camera at a QR code...</p>
          )}
        </div>
      )}

      {inputMode === "manual" && (
        <div className="space-y-4">
          <div className="rounded-2xl border-2 border-border bg-card p-6 space-y-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
              <QrCode className="h-8 w-8" />
            </div>
            <p className="text-center text-sm text-muted-foreground">Enter the code from your visitor card or QR badge</p>
            <Input
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleManualSubmit()}
              placeholder="Visitor code or full name..."
              className="h-14 text-lg text-center"
              autoFocus
            />
            <Button onClick={handleManualSubmit} disabled={!manualCode.trim()} className="w-full h-14 text-base gap-2">
              Look Up
            </Button>
          </div>
        </div>
      )}

      <Button variant="secondary" onClick={() => navigate("/kiosk/home")} className="w-full h-14 text-base gap-2 border border-border">
        <ArrowLeft className="h-5 w-5" /> Back to Home
      </Button>
    </div>
  );
}
