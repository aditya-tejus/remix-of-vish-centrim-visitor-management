import { useState } from "react";
import { KeyRound, ShieldAlert, Loader2, Building2 } from "lucide-react";
import centrimLogo from "@/assets/centrim-life-logo.png";
import kioskBg from "@/assets/kiosk-bg.jpg";
import { useKioskDevice } from "@/contexts/KioskDeviceContext";

/**
 * Shown until an administrator has set this tablet up for a site. Nothing a visitor
 * can do is reachable from here, and no site can be chosen on the device itself.
 */
export function KioskActivation() {
  const { activate } = useKioskDevice();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clean = code.replace(/[^A-Za-z0-9]/g, "").toUpperCase();

  const submit = async () => {
    if (busy || clean.length !== 12) return;
    setBusy(true);
    setError(null);
    const result = await activate(clean);
    setBusy(false);
    if (!result.ok) {
      setError(result.message ?? "That code cannot be used.");
      setCode("");
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-6">
      <div className="fixed inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${kioskBg})` }} />
      <div className="fixed inset-0 bg-background/85 backdrop-blur-sm" />
      <main className="relative z-10 w-full max-w-md bg-card rounded-3xl border border-border shadow-2xl p-8 space-y-5 text-center">
        <img src={centrimLogo} alt="Centrim Life" className="h-9 object-contain mx-auto" />
        <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
          <KeyRound className="h-7 w-7" aria-hidden />
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-foreground">This device is not set up yet</h1>
          <p className="text-sm text-muted-foreground">
            A member of staff can set it up in Settings, then enter the 12-character code here.
          </p>
        </div>

        <label htmlFor="kiosk-activation-code" className="sr-only">
          Activation code
        </label>
        <input
          id="kiosk-activation-code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => { if (e.key === "Enter") void submit(); }}
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          placeholder="ABCD EFGH JKLM"
          className="w-full h-16 rounded-2xl border border-border bg-secondary text-center text-2xl font-mono tracking-[0.25em] text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />

        {error && (
          <p className="flex items-center justify-center gap-2 text-sm text-destructive" role="alert">
            <ShieldAlert className="h-4 w-4" aria-hidden /> {error}
          </p>
        )}

        <button
          onClick={() => void submit()}
          disabled={busy || clean.length !== 12}
          className="w-full h-14 rounded-xl bg-primary text-primary-foreground text-base font-semibold transition-transform active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Building2 className="h-5 w-5" aria-hidden />}
          {busy ? "Setting up…" : "Set up this kiosk"}
        </button>
        <p className="text-xs text-muted-foreground">
          The code can be used once and lasts 15 minutes.
        </p>
      </main>
    </div>
  );
}

/** Shown when the device key has been paused, turned off or has run out. */
export function KioskDeviceBlocked({ reason }: { reason: string }) {
  return (
    <div className="min-h-screen relative flex items-center justify-center p-6">
      <div className="fixed inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${kioskBg})` }} />
      <div className="fixed inset-0 bg-background/85 backdrop-blur-sm" />
      <main className="relative z-10 w-full max-w-md bg-card rounded-3xl border border-border shadow-2xl p-8 space-y-4 text-center">
        <div className="h-14 w-14 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
          <ShieldAlert className="h-7 w-7" aria-hidden />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Kiosk unavailable</h1>
        <p className="text-base text-muted-foreground">{reason}</p>
      </main>
    </div>
  );
}
