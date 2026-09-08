import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Delete, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";

interface KioskPinPadProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Receives the verified PIN so staff-only server functions can be called. */
  onSuccess: (pin: string) => void;
}

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 60_000;

/** Numeric PIN entry for staff-only kiosk actions. Verification happens server side. */
export function KioskPinPad({ open, onOpenChange, onSuccess }: KioskPinPadProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);

  const locked = lockedUntil != null && Date.now() < lockedUntil;

  const reset = () => { setPin(""); setError(""); };

  const press = (d: string) => {
    if (locked || busy) return;
    setError("");
    setPin((p) => (p.length >= 8 ? p : p + d));
  };

  const submit = async () => {
    if (locked || busy || pin.length < 4) return;
    setBusy(true);
    const { data, error: rpcError } = await (supabase as any).rpc("verify_kiosk_pin", { p_pin: pin });
    setBusy(false);
    if (rpcError) {
      setError("Could not check the PIN. Please try again.");
      setPin("");
      return;
    }
    if (data === true) {
      setAttempts(0);
      reset();
      onSuccess();
      return;
    }
    const next = attempts + 1;
    setAttempts(next);
    setPin("");
    if (next >= MAX_ATTEMPTS) {
      setLockedUntil(Date.now() + LOCKOUT_MS);
      setAttempts(0);
      setError("Too many attempts. Please wait a minute.");
      // Record the lockout so managers can see repeated failures.
      supabase.from("audit_log").insert({
        action: "kiosk_pin_lockout",
        performed_by: "Kiosk",
        records_affected: 0,
        change_reason: "Five incorrect kiosk PIN attempts",
      }).then(() => undefined);
    } else {
      setError(`Incorrect PIN — ${MAX_ATTEMPTS - next} attempt${MAX_ATTEMPTS - next === 1 ? "" : "s"} left`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="rounded-2xl sm:max-w-sm p-6">
        <div className="text-center space-y-1 mb-4">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold text-foreground">Staff access</h2>
          <p className="text-[13px] text-muted-foreground">Enter the staff PIN to open the emergency roll call.</p>
        </div>

        <div className="flex justify-center gap-2 mb-4" aria-label="PIN entry">
          {Array.from({ length: Math.max(4, pin.length || 4) }).map((_, i) => (
            <motion.span
              key={i}
              animate={{ scale: i < pin.length ? 1 : 0.8 }}
              className={`h-3.5 w-3.5 rounded-full ${i < pin.length ? "bg-primary" : "bg-muted"}`}
            />
          ))}
        </div>

        {error && <p className="text-center text-[13px] text-destructive mb-3">{error}</p>}

        <div className="grid grid-cols-3 gap-2.5">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <button
              key={d}
              onClick={() => press(d)}
              disabled={locked}
              className="h-14 rounded-xl border border-border bg-secondary text-xl font-semibold text-foreground transition-transform active:scale-95 disabled:opacity-50"
            >
              {d}
            </button>
          ))}
          <button
            onClick={() => setPin((p) => p.slice(0, -1))}
            disabled={locked}
            className="h-14 rounded-xl border border-border bg-secondary flex items-center justify-center transition-transform active:scale-95 disabled:opacity-50"
            aria-label="Delete last digit"
          >
            <Delete className="h-5 w-5 text-muted-foreground" />
          </button>
          <button
            onClick={() => press("0")}
            disabled={locked}
            className="h-14 rounded-xl border border-border bg-secondary text-xl font-semibold text-foreground transition-transform active:scale-95 disabled:opacity-50"
          >
            0
          </button>
          <Button
            onClick={submit}
            disabled={locked || busy || pin.length < 4}
            className="h-14 rounded-xl text-base"
          >
            {busy ? "…" : "Enter"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
