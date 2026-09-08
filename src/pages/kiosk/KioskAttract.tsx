import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { format } from "date-fns";
import QRCode from "react-qr-code";
import centrimLogo from "@/assets/centrim-life-logo.png";
import kioskBg from "@/assets/kiosk-bg.jpg";
import { createKioskQrToken } from "@/lib/kioskQrToken";


export default function KioskAttract() {
  const navigate = useNavigate();
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Rotating phone check-in code — refreshes every 5 minutes.
  const [qrToken, setQrToken] = useState(() => createKioskQrToken());
  useEffect(() => {
    const id = setInterval(() => setQrToken(createKioskQrToken()), 30 * 1000);
    return () => clearInterval(id);
  }, []);
  const publicCheckinUrl = `${window.location.origin}/kiosk/checkin?k=${qrToken}`;


  const handleStart = useCallback(() => navigate("/kiosk/home"), [navigate]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center cursor-pointer select-none"
      onClick={handleStart}
      role="button"
      tabIndex={0}
      aria-label="Touch to begin"
    >
      {/* Background image */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${kioskBg})` }}
      />
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" />

      <div className="relative z-10 flex flex-col items-center gap-6 px-6 max-w-md w-full">
        {/* Logo */}
        <img
          src={centrimLogo}
          alt="Centrim Life"
          className="h-14 object-contain"
        />

        {/* Clock */}
        <div className="text-center">
          <p className="text-6xl font-light text-foreground tracking-tight tabular-nums">
            {format(time, "h:mm a")}
          </p>
          <p className="text-lg text-muted-foreground mt-1">
            {format(time, "EEEE, d MMMM yyyy")}
          </p>
        </div>

        {/* Facility name */}
        <p className="text-base text-muted-foreground font-medium">
          Welcome to Sydney Care Centre
        </p>

        {/* Bold CTA */}
        <motion.div
          animate={{ scale: [1, 1.03, 1] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          className="mt-2"
        >
          <div className="px-12 py-5 rounded-full bg-primary text-primary-foreground text-xl font-semibold shadow-lg shadow-primary/25">
            Touch to Begin
          </div>
        </motion.div>

        {/* Divider */}
        <div className="w-full flex items-center gap-4 mt-4">
          <div className="flex-1 h-px bg-border/60" />
          <span className="text-xs text-muted-foreground uppercase tracking-widest">or</span>
          <div className="flex-1 h-px bg-border/60" />
        </div>

        {/* QR Code section */}
        <div
          className="flex items-center gap-5"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-card rounded-xl p-3 shadow-sm border border-border">
            <QRCode
              value={publicCheckinUrl}
              size={100}
              level="M"
              bgColor="transparent"
              fgColor="currentColor"
              className="text-foreground"
            />
          </div>
          <div className="text-left">
            <p className="text-base font-medium text-foreground">Prefer your phone?</p>
            <p className="text-sm text-muted-foreground">Scan to check in<br />from your device</p>
            <p className="text-[11px] text-muted-foreground/70 mt-1">Code refreshes every 5 minutes</p>

          </div>
        </div>
      </div>
    </div>
  );
}
