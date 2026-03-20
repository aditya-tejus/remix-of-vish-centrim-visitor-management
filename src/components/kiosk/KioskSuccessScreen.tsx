import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

interface KioskSuccessScreenProps {
  title: string;
  subtitle?: string;
  countdownSeconds?: number;
  onComplete: () => void;
  accentColor?: "success" | "warning" | "info" | "primary";
}

export function KioskSuccessScreen({
  title,
  subtitle,
  countdownSeconds = 5,
  onComplete,
  accentColor = "success",
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

  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const progress = remaining / countdownSeconds;

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
  const strokeColorMap = {
    success: "stroke-success",
    warning: "stroke-warning",
    info: "stroke-info",
    primary: "stroke-primary",
  };

  return (
    <div className={`flex flex-col items-center justify-center text-center gap-6 w-full min-h-[60vh] px-6 rounded-3xl ${colorMap[accentColor]}`}>
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 12 }}
        className={`h-24 w-24 rounded-full flex items-center justify-center ${iconColorMap[accentColor]}`}
      >
        <CheckCircle2 className="h-14 w-14" />
      </motion.div>

      <motion.h2
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="text-3xl font-bold text-foreground"
      >
        {title}
      </motion.h2>

      {subtitle && (
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.4 }}
          className="text-lg text-muted-foreground max-w-sm"
        >
          {subtitle}
        </motion.p>
      )}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="flex flex-col items-center gap-3 mt-4"
      >
        <svg width="72" height="72" viewBox="0 0 72 72" className="-rotate-90">
          <circle cx="36" cy="36" r={radius} fill="none" stroke="hsl(var(--border))" strokeWidth="4" />
          <circle
            cx="36" cy="36" r={radius} fill="none"
            className={strokeColorMap[accentColor]}
            strokeWidth="4" strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress)}
            style={{ transition: "stroke-dashoffset 1s linear" }}
          />
        </svg>
        <span className="text-sm text-muted-foreground">Returning home in {remaining}s</span>
        <Button variant="ghost" size="sm" onClick={onComplete} className="text-muted-foreground mt-1">
          Return to Home
        </Button>
      </motion.div>
    </div>
  );
}
