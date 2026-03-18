import { useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { ArrowLeft, Home } from "lucide-react";
import centrimLogo from "@/assets/centrim-life-logo.png";

export default function KioskLayout() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Kiosk header */}
      <header className="flex items-center justify-between px-8 py-4 border-b border-border bg-card">
        <img src={centrimLogo} alt="Centrim Life" className="h-10 object-contain" />
        <button
          onClick={() => navigate("/kiosk")}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-muted text-muted-foreground hover:text-foreground transition-colors text-sm font-medium"
        >
          <Home className="h-5 w-5" /> Home
        </button>
      </header>
      {/* Content */}
      <main className="flex-1 flex items-center justify-center p-8">
        <Outlet />
      </main>
      {/* Footer */}
      <footer className="text-center py-3 text-xs text-muted-foreground border-t border-border">
        Powered by Centrim Life
      </footer>
    </div>
  );
}
