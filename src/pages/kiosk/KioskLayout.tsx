import { useState, useCallback } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { Home, RotateCcw } from "lucide-react";
import centrimLogo from "@/assets/centrim-life-logo.png";
import { useIdleTimer } from "@/hooks/useIdleTimer";

export default function KioskLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const isAttract = location.pathname === "/kiosk" || location.pathname === "/kiosk/";
  const isHome = location.pathname === "/kiosk/home";

  const handleIdle = useCallback(() => {
    if (location.pathname === "/kiosk" || location.pathname === "/kiosk/") return;
    navigate("/kiosk");
  }, [navigate, location.pathname]);

  useIdleTimer(handleIdle, 90000);

  if (isAttract) {
    return <Outlet />;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center justify-between px-6 sm:px-8 py-3 border-b border-border bg-card">
        <img src={centrimLogo} alt="Centrim Life" className="h-9 object-contain" />
        <div className="flex items-center gap-2">
          {!isHome && (
            <>
              <button
                onClick={() => navigate("/kiosk/home")}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-muted text-muted-foreground hover:text-foreground transition-colors text-sm font-medium"
              >
                <RotateCcw className="h-4 w-4" /> Start Over
              </button>
              <button
                onClick={() => navigate("/kiosk/home")}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-colors text-sm font-medium"
              >
                <Home className="h-4 w-4" /> Home
              </button>
            </>
          )}
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center p-6 sm:p-8">
        <Outlet />
      </main>
      <footer className="text-center py-2 text-[10px] text-muted-foreground/50">
        Powered by Centrim Life
      </footer>
    </div>
  );
}
