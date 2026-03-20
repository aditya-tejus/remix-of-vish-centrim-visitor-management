import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import QRCode from "react-qr-code";
import centrimLogo from "@/assets/centrim-life-logo.png";
import kioskBg from "@/assets/kiosk-bg.jpg";

export default function KioskAttract() {
  const navigate = useNavigate();
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const publicCheckinUrl = `${window.location.origin}/kiosk/checkin`;

  const handleStart = () => navigate("/kiosk/home");

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center cursor-pointer select-none"
      onClick={handleStart}
      onTouchStart={handleStart}
    >
      {/* Background image */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${kioskBg})` }}
      />
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" />

      <div className="relative z-10 flex flex-col items-center gap-8 px-6 max-w-md w-full">
        {/* Logo — stable, no flickering */}
        <img
          src={centrimLogo}
          alt="Centrim Life"
          className="h-12 object-contain"
        />

        {/* Clock */}
        <div className="text-center">
          <p className="text-6xl font-light text-foreground tracking-tight tabular-nums">
            {time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
          <p className="text-lg text-muted-foreground mt-1">
            {time.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>

        {/* Bold CTA */}
        <motion.div
          animate={{ scale: [1, 1.03, 1] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          className="mt-4"
        >
          <div className="px-12 py-5 rounded-full bg-primary text-primary-foreground text-xl font-semibold shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-shadow">
            Touch to Begin
          </div>
        </motion.div>

        {/* Divider */}
        <div className="w-full flex items-center gap-4 mt-6">
          <div className="flex-1 h-px bg-border/60" />
          <span className="text-xs text-muted-foreground uppercase tracking-widest">or</span>
          <div className="flex-1 h-px bg-border/60" />
        </div>

        {/* QR Code section */}
        <div
          className="flex items-center gap-5"
          onClick={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
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
            <p className="text-sm font-medium text-foreground">Prefer your phone?</p>
            <p className="text-sm text-muted-foreground">Scan to check in<br />from your device</p>
          </div>
        </div>
      </div>
    </div>
  );
}
