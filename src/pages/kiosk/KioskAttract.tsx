import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { format } from "date-fns";
import QRCode from "react-qr-code";
import centrimLogo from "@/assets/centrim-life-logo.png";

import { createKioskQrToken } from "@/lib/kioskQrToken";
import { useOperatingContext } from "@/contexts/OperatingContext";


export default function KioskAttract() {
  const navigate = useNavigate();
  const { siteName } = useOperatingContext();
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return (
    <main className="kiosk-surface min-h-dvh flex flex-col items-center justify-center bg-background px-6 py-10" onClick={handleStart}>
      <div className="w-full max-w-xl text-center space-y-6">
        <img src={centrimLogo} alt="Centrim Life" className="h-14 max-w-full object-contain mx-auto" />
        <h1 className="text-3xl font-semibold break-words">{siteName ? `Welcome to ${siteName}` : "Welcome"}</h1>
        <div className="space-y-2">
          <p className="text-5xl font-semibold tabular-nums">{format(time, "h:mm a")}</p>
          <p className="text-xl text-muted-foreground">{format(time, "EEEE, d MMMM yyyy")}</p>
        </div>
        <Button onClick={handleStart} className="min-h-16 h-auto w-full py-5 text-2xl font-semibold">Touch to Begin<ArrowRight aria-hidden /></Button>
        <div className="flex flex-wrap items-center justify-center gap-5 border-t border-border pt-6" onClick={(e) => e.stopPropagation()}>
          <div className="bg-card rounded-card p-3 border border-border">
            <QRCode value={publicCheckinUrl} size={112} level="M" bgColor="transparent" fgColor="currentColor" className="text-foreground" />
          </div>
          <div className="text-left"><p className="text-xl font-semibold">Prefer your phone?</p><p className="text-lg text-muted-foreground">Scan to check in</p></div>
        </div>
      </div>
    </main>
  );
}
