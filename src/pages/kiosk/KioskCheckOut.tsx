import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Search, QrCode, Loader2, HelpCircle } from "lucide-react";
import { useKioskFastLane } from "@/hooks/useKioskFastLane";
import { useKioskCheckout, useKioskCheckoutName } from "@/hooks/useKioskCheckout";
import { validCheckoutCode, type CheckoutLookup } from "@/lib/kioskCheckoutPolicy";
import { KioskDepartureConfirmation } from "@/components/kiosk/KioskDepartureConfirmation";

export default function KioskCheckOut() {
  const navigate = useNavigate();
  const location = useLocation();
  const { fastLaneEnabled } = useKioskFastLane();
  const { lookup } = useKioskCheckout();
  const [search, setSearch] = useState("");
  const name = useKioskCheckoutName(search);
  const [code, setCode] = useState<string>(location.state?.checkoutCode || "");
  const [match, setMatch] = useState<CheckoutLookup | null>(location.state?.checkoutMatch || null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function findCard() {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const result = await lookup(code);
      if (result.state === "ready") setMatch(result);
      else setError("We could not confirm this card. Please check the code or ask reception.");
    } catch { setError("We could not connect. Your code is still here; please try again."); }
    finally { setBusy(false); }
  }
  if (match) return <KioskDepartureConfirmation code={code} match={match} onBack={() => setMatch(null)} onComplete={() => navigate("/kiosk/home")} />;
  return <section className="w-full space-y-6 text-xl" aria-labelledby="checkout-title">
    <div className="space-y-2 text-center"><h1 id="checkout-title" className="text-3xl font-semibold text-foreground">Sign out</h1><p className="text-muted-foreground">Use your visitor card, or ask reception for help.</p></div>
    {fastLaneEnabled && <div className="space-y-4 border-b border-border pb-6">
      <Button variant="secondary" onClick={() => navigate("/kiosk/qr-scan?mode=checkout")} className="w-full min-h-kiosk h-auto whitespace-normal py-4 text-xl gap-3"><QrCode className="h-6 w-6 shrink-0" aria-hidden="true" />Scan visitor card</Button>
      <div className="space-y-2"><Label htmlFor="checkout-code" className="text-xl">Visitor card code</Label><Input id="checkout-code" value={code} onChange={e => setCode(e.target.value)} onKeyDown={e => { if (e.key === "Enter") void findCard(); }} maxLength={12} autoComplete="off" className="min-h-kiosk text-xl" /></div>
      <Button disabled={busy || !validCheckoutCode(code)} onClick={findCard} className="w-full min-h-kiosk text-xl gap-2">{busy ? <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" /> : <QrCode className="h-6 w-6" aria-hidden="true" />} {busy ? "Checking card…" : "Continue with card"}</Button>
      {error && <p role="alert" className="text-destructive-strong">{error}</p>}
    </div>}
    <div className="space-y-3"><Label htmlFor="checkout-name" className="text-xl">No card? Your name</Label><div className="relative"><Search className="absolute left-4 top-1/2 h-6 w-6 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /><Input id="checkout-name" value={search} onChange={e => setSearch(e.target.value)} maxLength={60} autoComplete="off" className="min-h-kiosk pl-12 text-xl" /></div><p role="status" aria-live="polite" className="min-h-14 text-muted-foreground">{name.busy ? "Checking…" : name.message || "Enter at least three letters. Reception can confirm your departure privately."}</p></div>
    <Button variant="secondary" className="w-full min-h-kiosk text-xl gap-3" onClick={() => setError("Please speak to reception. You have not been signed out.")}><HelpCircle aria-hidden="true" className="h-6 w-6" />Ask reception for help</Button>
    {!fastLaneEnabled && error && <p role="alert" className="text-muted-foreground">{error}</p>}
  </section>;
}
