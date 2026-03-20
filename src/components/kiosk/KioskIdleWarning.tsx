import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Hand } from "lucide-react";

interface KioskIdleWarningProps {
  open: boolean;
  countdownSeconds?: number;
  onContinue: () => void;
  onTimeout: () => void;
}

export function KioskIdleWarning({
  open,
  countdownSeconds = 30,
  onContinue,
  onTimeout,
}: KioskIdleWarningProps) {
  const [remaining, setRemaining] = useState(countdownSeconds);

  useEffect(() => {
    if (!open) {
      setRemaining(countdownSeconds);
      return;
    }
    if (remaining <= 0) {
      onTimeout();
      return;
    }
    const t = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [open, remaining, countdownSeconds, onTimeout]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md"
          onClick={onContinue}
          onTouchStart={onContinue}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="bg-card rounded-3xl border-2 border-border p-10 max-w-sm w-full text-center space-y-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Hand className="h-10 w-10 text-primary" />
            </div>

            <div>
              <h2 className="text-2xl font-bold text-foreground">Still there?</h2>
              <p className="text-base text-muted-foreground mt-2">
                This session will reset in <span className="font-bold text-foreground">{remaining}s</span>
              </p>
            </div>

            <Button
              onClick={onContinue}
              className="w-full h-14 text-lg font-semibold"
            >
              Yes, I'm still here
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
