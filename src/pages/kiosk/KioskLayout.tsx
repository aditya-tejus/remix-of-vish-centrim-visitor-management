import { useCallback, useMemo, useRef } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { RotateCcw, HelpCircle, ShieldCheck } from "lucide-react";
import centrimLogo from "@/assets/centrim-life-logo.png";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useIdleTimerWithWarning } from "@/hooks/useIdleTimer";
import { KioskIdleWarning } from "@/components/kiosk/KioskIdleWarning";
import { KioskPinPad } from "@/components/kiosk/KioskPinPad";
import { useState } from "react";
import { useKioskDevice } from "@/contexts/KioskDeviceContext";
import { KioskActivation, KioskDeviceBlocked } from "@/pages/kiosk/KioskActivation";
import { Loader2, Building2 } from "lucide-react";

const ROUTE_LABELS: Record<string, string> = {
  "/kiosk/checkin": "Check In",
  "/kiosk/checkout": "Check Out",
  "/kiosk/resident-leave": "Resident Leave",
  "/kiosk/qr-scan": "Scan QR Code",
  "/kiosk/evacuation": "Emergency Roll Call",
};

export default function KioskLayout() {
  const { state, blockedReason, siteName, deviceName } = useKioskDevice();

  if (state === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-label="Starting kiosk" />
      </div>
    );
  }
  if (state === "unbound") return <KioskActivation />;
  if (state === "blocked") {
    return <KioskDeviceBlocked reason={blockedReason ?? "Please ask a staff member."} />;
  }

  return <KioskShell siteName={siteName} deviceName={deviceName} />;
}

function KioskShell({ siteName, deviceName }: { siteName: string | null; deviceName: string | null }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [helpOpen, setHelpOpen] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const holdTimer = useRef<number | null>(null);

  const isAttract = location.pathname === "/kiosk" || location.pathname === "/kiosk/";
  const isHome = location.pathname === "/kiosk/home";
  const isEvacuation = location.pathname === "/kiosk/evacuation";

  const pageLabel = useMemo(() => ROUTE_LABELS[location.pathname] || "", [location.pathname]);

  const handleIdle = useCallback(() => {
    // Never time out in the middle of a roll call.
    if (location.pathname === "/kiosk" || location.pathname === "/kiosk/") return;
    if (location.pathname === "/kiosk/evacuation") return;
    navigate("/kiosk");
  }, [navigate, location.pathname]);

  const { showWarning, dismissWarning } = useIdleTimerWithWarning(handleIdle, 60000, 90000);

  // Press and hold the small shield in the footer for staff access.
  const startHold = useCallback(() => {
    holdTimer.current = window.setTimeout(() => setPinOpen(true), 1200);
  }, []);
  const cancelHold = useCallback(() => {
    if (holdTimer.current) { window.clearTimeout(holdTimer.current); holdTimer.current = null; }
  }, []);


  if (isAttract) {
    return <Outlet />;
  }

  return (
    <div className="kiosk-surface min-h-dvh flex flex-col relative bg-background">
      {/* Header — fully opaque */}
      <header className="relative z-20 flex items-center justify-between flex-wrap gap-3 px-4 sm:px-8 py-3 border-b border-border bg-card shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <img src={centrimLogo} alt="Centrim Life" className="h-9 max-w-[180px] object-contain" />
          {pageLabel && (
            <>
              <div className="h-6 w-px bg-border" />
              <span className="text-base font-semibold text-foreground">{pageLabel}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost"
            onClick={() => setHelpOpen(true)}
            className="flex items-center gap-2 px-4 py-3 rounded-xl bg-secondary text-secondary-foreground transition-colors text-lg font-medium min-h-kiosk border border-border active:bg-accent"
            aria-label="Need help"
          >
            <HelpCircle className="h-5 w-5" aria-hidden /> Help
          </Button>
          <Button variant="ghost"
            onClick={() => navigate("/kiosk/home")}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground transition-colors text-lg font-medium min-h-kiosk active:bg-primary/80"
          >
            <RotateCcw className="h-5 w-5" /> Start Over
          </Button>
        </div>
      </header>

      {/* Content — frosted glass panel */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className={`w-full ${isEvacuation || isHome ? "max-w-3xl" : "max-w-2xl"} ${isHome ? "" : "bg-card rounded-card border border-border p-4 sm:p-8"}`}>
          <Outlet />
        </div>
      </main>

      <footer className="relative z-10 flex items-center justify-center gap-2 py-2 flex-wrap px-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5" aria-label="This kiosk belongs to">
          <Building2 className="h-3.5 w-3.5" aria-hidden />
          {siteName ?? "Site not known"}{deviceName ? ` — ${deviceName}` : ""}
        </span>
        <span aria-hidden>·</span>
        <span className="flex items-center gap-1.5">
          Powered by
          <img src={centrimLogo} alt="Centrim Life" className="h-3.5 object-contain " />
        </span>
        {/* Discreet staff access — press and hold */}
        <Button variant="ghost"
          onMouseDown={startHold}
          onMouseUp={cancelHold}
          onMouseLeave={cancelHold}
          onTouchStart={startHold}
          onTouchEnd={cancelHold}
          onContextMenu={(e) => e.preventDefault()}
          className="p-2 min-h-kiosk min-w-kiosk text-muted-foreground"
          aria-label="Staff access"
        >
          <ShieldCheck className="h-3.5 w-3.5" />
        </Button>
      </footer>

      <KioskPinPad
        open={pinOpen}
        onOpenChange={setPinOpen}
        onSuccess={(pin) => { setPinOpen(false); navigate("/kiosk/evacuation", { state: { pin } }); }}
      />


      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="rounded-xl">
          <DialogHeader><DialogTitle className="text-2xl">Need Help?</DialogTitle><DialogDescription className="text-xl">Please ask a member of staff for assistance. They will be happy to help you.</DialogDescription></DialogHeader>
          <Button onClick={() => setHelpOpen(false)} className="min-h-kiosk text-xl">OK, Thank You</Button>
        </DialogContent>
      </Dialog>

      <KioskIdleWarning
        open={showWarning}
        countdownSeconds={30}
        onContinue={dismissWarning}
        onTimeout={handleIdle}
      />
    </div>
  );
}
