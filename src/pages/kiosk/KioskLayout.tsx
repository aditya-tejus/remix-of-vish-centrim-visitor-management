import { useCallback, useMemo } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { RotateCcw, HelpCircle } from "lucide-react";
import centrimLogo from "@/assets/centrim-life-logo.png";
import kioskBg from "@/assets/kiosk-bg.jpg";
import { useIdleTimerWithWarning } from "@/hooks/useIdleTimer";
import { KioskIdleWarning } from "@/components/kiosk/KioskIdleWarning";
import { useState } from "react";

const ROUTE_LABELS: Record<string, string> = {
  "/kiosk/checkin": "Check In",
  "/kiosk/checkout": "Check Out",
  "/kiosk/resident-leave": "Resident Leave",
  "/kiosk/qr-scan": "Scan QR Code",
};

export default function KioskLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [helpOpen, setHelpOpen] = useState(false);

  const isAttract = location.pathname === "/kiosk" || location.pathname === "/kiosk/";
  const isHome = location.pathname === "/kiosk/home";

  const pageLabel = useMemo(() => ROUTE_LABELS[location.pathname] || "", [location.pathname]);

  const handleIdle = useCallback(() => {
    if (location.pathname === "/kiosk" || location.pathname === "/kiosk/") return;
    navigate("/kiosk");
  }, [navigate, location.pathname]);

  const { showWarning, dismissWarning } = useIdleTimerWithWarning(handleIdle, 60000, 90000);

  if (isAttract) {
    return <Outlet />;
  }

  // Home screen manages its own background
  if (isHome) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <main className="flex-1">
          <Outlet />
        </main>
        <KioskIdleWarning
          open={showWarning}
          countdownSeconds={30}
          onContinue={dismissWarning}
          onTimeout={handleIdle}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col relative">
      {/* Background image for inner pages */}
      <div
        className="fixed inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${kioskBg})` }}
      />
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" />

      {/* Header — fully opaque */}
      <header className="relative z-20 flex items-center justify-between px-6 sm:px-8 py-3 border-b border-border bg-card shadow-sm">
        <div className="flex items-center gap-4">
          <img src={centrimLogo} alt="Centrim Life" className="h-9 object-contain" />
          {pageLabel && (
            <>
              <div className="h-6 w-px bg-border" />
              <span className="text-base font-semibold text-foreground">{pageLabel}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setHelpOpen(true)}
            className="flex items-center gap-2 px-4 py-3 rounded-xl bg-muted text-muted-foreground hover:bg-accent hover:text-foreground transition-colors text-sm font-medium min-h-[48px]"
            aria-label="Need help"
          >
            <HelpCircle className="h-5 w-5" />
          </button>
          <button
            onClick={() => navigate("/kiosk/home")}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground transition-colors text-base font-medium min-h-[48px] border border-border"
          >
            <RotateCcw className="h-5 w-5" /> Start Over
          </button>
        </div>
      </header>

      {/* Content — frosted glass panel */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-2xl bg-card/95 backdrop-blur-xl rounded-3xl border border-border shadow-2xl p-6 sm:p-8 max-h-[calc(100vh-140px)] overflow-y-auto kiosk-scroll-fade">
          <Outlet />
        </div>
      </main>

      <footer className="relative z-10 text-center py-2 text-xs text-muted-foreground/60">
        Powered by Centrim Life
      </footer>

      {/* Help Dialog */}
      {helpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm" onClick={() => setHelpOpen(false)}>
          <div className="bg-card rounded-3xl border border-border shadow-2xl p-8 max-w-sm w-full mx-4 text-center space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="h-16 w-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
              <HelpCircle className="h-9 w-9" />
            </div>
            <h3 className="text-2xl font-bold text-foreground">Need Help?</h3>
            <p className="text-base text-muted-foreground">Please ask a member of staff for assistance. They will be happy to help you.</p>
            <button
              onClick={() => setHelpOpen(false)}
              className="w-full h-14 rounded-xl bg-primary text-primary-foreground text-base font-semibold hover:bg-primary/90 transition-colors"
            >
              OK, Thank You
            </button>
          </div>
        </div>
      )}

      <KioskIdleWarning
        open={showWarning}
        countdownSeconds={30}
        onContinue={dismissWarning}
        onTimeout={handleIdle}
      />
    </div>
  );
}
