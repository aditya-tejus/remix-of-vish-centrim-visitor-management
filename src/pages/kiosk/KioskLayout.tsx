import { useCallback } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { RotateCcw } from "lucide-react";
import centrimLogo from "@/assets/centrim-life-logo.png";
import kioskBg from "@/assets/kiosk-bg.jpg";
import { useIdleTimerWithWarning } from "@/hooks/useIdleTimer";
import { KioskIdleWarning } from "@/components/kiosk/KioskIdleWarning";

export default function KioskLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const isAttract = location.pathname === "/kiosk" || location.pathname === "/kiosk/";
  const isHome = location.pathname === "/kiosk/home";

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
        <img src={centrimLogo} alt="Centrim Life" className="h-9 object-contain" />
        <div className="flex items-center gap-3">
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
        <div className="w-full max-w-2xl bg-card/95 backdrop-blur-xl rounded-3xl border border-border shadow-2xl p-6 sm:p-8">
          <Outlet />
        </div>
      </main>

      <footer className="relative z-10 text-center py-2 text-xs text-muted-foreground/60">
        Powered by Centrim Life
      </footer>

      <KioskIdleWarning
        open={showWarning}
        countdownSeconds={30}
        onContinue={dismissWarning}
        onTimeout={handleIdle}
      />
    </div>
  );
}
