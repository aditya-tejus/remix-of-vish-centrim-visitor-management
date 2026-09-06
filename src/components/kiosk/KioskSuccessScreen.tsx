import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import QRCode from "react-qr-code";

interface KioskSuccessScreenProps {
  title: string;
  subtitle?: string;
  countdownSeconds?: number;
  onComplete: () => void;
  accentColor?: "success" | "warning" | "info" | "primary";
  qrCode?: string;
  companionCount?: number;
  /** Optional extra action rendered above the return button (e.g. Print Badge) */
  extraAction?: React.ReactNode;
}

export function KioskSuccessScreen({
  title,
  subtitle,
  countdownSeconds = 8,
  onComplete,
  accentColor = "success",
  qrCode,
  companionCount,
  extraAction,
}: KioskSuccessScreenProps) {
  const [remaining, setRemaining] = useState(countdownSeconds);

  useEffect(() => {
    if (remaining <= 0) {
      onComplete();
      return;
    }
    const t = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining, onComplete]);

  const colorMap = {
    success: "text-success bg-success/5",
    warning: "text-warning bg-warning/5",
    info: "text-info bg-info/5",
    primary: "text-primary bg-primary/5",
  };
  const iconColorMap = {
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    info: "bg-info/10 text-info",
    primary: "bg-primary/10 text-primary",
  };

  return (
    <div className={`flex flex-col items-center justify-center text-center gap-5 w-full min-h-[50vh] px-6 rounded-3xl ${colorMap[accentColor]}`}>
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 12 }}
        className={`h-16 w-16 rounded-full flex items-center justify-center ${iconColorMap[accentColor]}`}
      >
        <CheckCircle2 className="h-10 w-10" />
      </motion.div>

      <motion.h2
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="text-2xl font-bold text-foreground"
      >
        {title}
      </motion.h2>

      {subtitle && (
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.4 }}
          className="text-base text-muted-foreground max-w-sm"
        >
          {subtitle}
        </motion.p>
      )}

      {companionCount != null && companionCount > 0 && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-sm text-muted-foreground"
        >
          + {companionCount} companion{companionCount > 1 ? "s" : ""} also checked in
        </motion.p>
      )}

      {/* QR Code for checkout */}
      {qrCode && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.45, duration: 0.4 }}
          className="flex flex-col items-center gap-2"
        >
          <div className="p-3 rounded-xl bg-white border border-border shadow-sm">
            <QRCode value={qrCode} size={120} level="H" style={{ height: "auto", maxWidth: "100%", width: "100%" }} />
          </div>
          <p className="text-xs text-muted-foreground">Show this QR code for quick check-out</p>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="flex flex-col items-center gap-2 mt-2"
      >
        {extraAction}
        <Button variant="secondary" size="sm" onClick={onComplete} className="gap-2 border border-border text-sm">
          Return to Start · {remaining}s
        </Button>
      </motion.div>
    </div>
  );
}
