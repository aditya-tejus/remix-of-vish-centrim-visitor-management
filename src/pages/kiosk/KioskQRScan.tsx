import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useKioskCheckout } from "@/hooks/useKioskCheckout";
import { returningVisitorDetails } from "@/lib/kioskPrivacy";
import { KioskDepartureConfirmation } from "@/components/kiosk/KioskDepartureConfirmation";
import type { CheckoutLookup } from "@/lib/kioskCheckoutPolicy";
import { useOperatingContext } from "@/contexts/OperatingContext";
import { QrCode, Camera, CameraOff, Keyboard, ArrowLeft, LogOut, AlertTriangle, UserRoundPlus, UserRoundCheck, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { Html5Qrcode } from "html5-qrcode";
import { kioskRpc } from "@/lib/kioskRpc";

/**
 * Fast Lane: a personal card or visit code only *recognises* someone. It never
 * checks anyone in on its own — screening questions, terms and acknowledgements
 * always stay explicit steps in the normal check-in flow.
 */
/** Stopping a scanner that never started throws synchronously — never let that crash the screen. */
function safeStop(scanner: Html5Qrcode | null) {
  if (!scanner) return;
  try {
    const result = scanner.stop();
    if (result && typeof (result as any).catch === "function") (result as any).catch(() => {});
  } catch {
    /* scanner was not running */
  }
}

type Prefill = {
  firstName: string;
  surname: string;
  email: string;
  mobile: string;
  address: string;
  personQr: string | null;
};

type ScanResult =
  | { type: "recognised"; prefill: Prefill }
  | { type: "notfound" }
  | { type: "error" };

export default function KioskQRScan() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get("mode");
  const { siteId: kioskSiteId } = useOperatingContext();
  const { lookup } = useKioskCheckout();
  const [checkout, setCheckout] = useState<{ code: string; match: CheckoutLookup } | null>(null);
  const lookupLock = useRef(false);

  const [manualCode, setManualCode] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [inputMode, setInputMode] = useState<"camera" | "manual">("camera");
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const lookupCode = useCallback(
    async (code: string) => {
      const trimmed = code.trim().toUpperCase();
      if (!trimmed || lookupLock.current) return;
      lookupLock.current = true;
      setBusy(true);

      try {
        const active = await lookup(trimmed);
        if (active.state === "ready") {
          setCheckout({ code: trimmed, match: active });
          setBusy(false); lookupLock.current = false;
          return;
        }
        if (mode === "checkout" || active.state === "staff_required") {
          setResult({ type: "notfound" }); setBusy(false); lookupLock.current = false; return;
        }
      } catch { setResult({ type: "error" }); setBusy(false); lookupLock.current = false; return; }

      // Otherwise ask the restricted lookup to recognise the code. It returns at
      // most one person's own saved details, scoped to this kiosk's site.
      const { data, error } = await kioskRpc<any[]>("kioskd_returning_lookup_v2", {
        p_first: null,
        p_last: null,
        p_mobile: null,
        p_qr: trimmed,
      });
      setBusy(false); lookupLock.current = false;
      if (error) {
        setResult({ type: "error" });
        return;
      }
      const prev = Array.isArray(data) ? (data[0] as any) : null;
      if (!prev) {
        setResult({ type: "notfound" });
        return;
      }
      const verified = returningVisitorDetails(prev);
      setResult({
        type: "recognised",
        prefill: {
          firstName: prev.first_name || "",
          surname: prev.surname || "",
          email: verified.email,
          mobile: verified.mobile,
          address: verified.address,
          personQr: verified.personQr,
        },
      });
    },
    [mode, kioskSiteId]
  );

  useEffect(() => {
    if (inputMode !== "camera" || result || checkout) return;

    let scanner: Html5Qrcode | null = null;
    const startScanner = async () => {
      try {
        scanner = new Html5Qrcode("kiosk-qr-reader");
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            void lookupCode(decodedText);
            safeStop(scanner);
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
      safeStop(scanner);
      scannerRef.current = null;
      setCameraActive(false);
    };
  }, [inputMode, result, checkout, lookupCode]);

  const handleManualSubmit = () => {
    void lookupCode(manualCode);
  };

  const handleReset = () => {
    setResult(null);
    setManualCode("");
  };

  const continueToCheckIn = (prefill?: Prefill) => {
    navigate("/kiosk/checkin", { state: prefill ? { fastLane: prefill } : undefined });
  };

  if (checkout) return <KioskDepartureConfirmation code={checkout.code} match={checkout.match} onBack={() => setCheckout(null)} onComplete={() => navigate("/kiosk/home")} />;

  // Result screen
  if (result) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full space-y-6 text-center">
        {result.type === "recognised" && (
          <>
            <div className="h-20 w-20 rounded-full bg-success/10 text-success flex items-center justify-center mx-auto">
              <UserRoundCheck className="h-12 w-12" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">Welcome back, {result.prefill.firstName}</h2>
            <p className="text-lg text-muted-foreground">
              We have your details ready. There are still a few questions to confirm before you are checked in.
            </p>
            <Button onClick={() => continueToCheckIn(result.prefill)} className="w-full h-14 text-xl gap-2">
              <UserRoundPlus className="h-5 w-5" /> Continue Check In
            </Button>
          </>
        )}

        {result.type === "notfound" && (
          <>
            <div className="h-20 w-20 rounded-full bg-warning/10 text-warning flex items-center justify-center mx-auto">
              <AlertTriangle className="h-12 w-12" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">We could not read that code</h2>
            <p className="text-lg text-muted-foreground">
              Please check the code or ask reception for help.
            </p>
            {mode !== "checkout" && <Button onClick={() => continueToCheckIn()} className="w-full h-14 text-xl gap-2">
              <UserRoundPlus className="h-5 w-5" /> Check In Manually
            </Button>}
          </>
        )}

        {result.type === "error" && (
          <>
            <div className="h-20 w-20 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
              <AlertTriangle className="h-12 w-12" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">Something went wrong</h2>
            <p className="text-xl text-muted-foreground">Your departure has not been confirmed. Please try again or ask reception.</p>
          </>
        )}

        <div className="flex gap-3 pt-2">
          <Button variant="secondary" onClick={handleReset} className="flex-1 h-14 text-xl gap-2 border border-border">
            <QrCode className="h-5 w-5" /> Try Another Code
          </Button>
          <Button variant="secondary" onClick={() => navigate("/kiosk/home")} className="flex-1 h-14 text-xl gap-2 border border-border">
            Done
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-semibold text-foreground">Scan visitor card</h1>
        <p className="text-lg text-muted-foreground mt-1">
          {mode === "checkout"
            ? "Scan your visitor card to check out"
            : "Scan your visitor card to fill in your details faster"}
        </p>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-3 justify-center">
        <Button variant={inputMode === "camera" ? "default" : "secondary"}
          onClick={() => setInputMode("camera")}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl text-base font-semibold transition-all min-h-kiosk ${
            inputMode === "camera" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground border border-border active:bg-accent"
          }`}
        >
          <Camera className="h-5 w-5" /> Camera
        </Button>
        <Button variant={inputMode === "manual" ? "default" : "secondary"}
          onClick={() => { setInputMode("manual"); safeStop(scannerRef.current); }}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl text-base font-semibold transition-all min-h-kiosk ${
            inputMode === "manual" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground border border-border active:bg-accent"
          }`}
        >
          <Keyboard className="h-5 w-5" /> Type Code
        </Button>
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
              <p className="text-sm text-muted-foreground">Please type your code instead.</p>
            </div>
          )}
          {cameraActive && (
            <p className="text-center text-sm text-muted-foreground animate-pulse">Point the camera at your code...</p>
          )}
        </div>
      )}

      {inputMode === "manual" && (
        <div className="space-y-4">
          <div className="rounded-2xl border-2 border-border bg-card p-6 space-y-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
              <QrCode className="h-8 w-8" />
            </div>
            <p className="text-center text-sm text-muted-foreground">Enter the code printed on your visitor card</p>
            <Input
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleManualSubmit()}
              placeholder="Your visitor code"
              aria-label="Visitor card code"
              maxLength={12}
              className="min-h-kiosk text-xl text-center"
              autoFocus
            />
            <Button onClick={handleManualSubmit} disabled={!manualCode.trim() || busy} className="w-full h-14 text-xl gap-2">
              {busy && <Loader2 className="h-5 w-5 animate-spin" />} Look Up
            </Button>
          </div>
        </div>
      )}

      {mode !== "checkout" && <Button variant="secondary" onClick={() => continueToCheckIn()} className="w-full h-14 text-xl gap-2 border border-border">
        <UserRoundPlus className="h-5 w-5" /> No code? Check in here
      </Button>}
      <Button variant="secondary" onClick={() => navigate("/kiosk/home")} className="w-full h-14 text-xl gap-2 border border-border">
        <ArrowLeft className="h-5 w-5" /> Back to Home
      </Button>
    </div>
  );
}
