import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { KeyRound, Loader2, LogOut, ArrowLeft } from "lucide-react";
import { validDepartureSelection, type CheckoutLookup } from "@/lib/kioskCheckoutPolicy";
import { useKioskCheckout } from "@/hooks/useKioskCheckout";
import { KioskFeedbackScreen } from "./KioskFeedbackScreen";
import { KioskSuccessScreen } from "./KioskSuccessScreen";

export function KioskDepartureConfirmation({ code, match, onBack, onComplete }: {
  code: string; match: CheckoutLookup; onBack: () => void; onComplete: () => void;
}) {
  const parties = match.parties || [];
  const [ids, setIds] = useState<string[]>(parties.filter(p => p.primary).map(p => p.id));
  const [error, setError] = useState(false);
  const [phase, setPhase] = useState<"confirm" | "feedback" | "done">("confirm");
  const { depart, saving } = useKioskCheckout();
  async function submit() {
    if (!match.visit_id || !validDepartureSelection(ids, parties)) return;
    setError(false);
    try { if (await depart(code, match.visit_id, ids)) setPhase("feedback"); }
    catch { setError(true); }
  }
  if (phase === "done") return <section><h1 className="sr-only">Departure recorded</h1><KioskSuccessScreen title="You are signed out" subtitle="Your selected departures have been recorded." accentColor="success" onComplete={onComplete} /></section>;
  if (phase === "feedback") return <section><h1 className="sr-only">Departure feedback</h1><KioskFeedbackScreen visitorId={match.visitor_id} visitorName="" visitorType={match.visitor_type || "visitor"} onComplete={() => setPhase("done")} /></section>;
  return <section className="space-y-6 text-xl" aria-labelledby="departure-title">
    <div className="space-y-2 text-center"><h1 id="departure-title" className="text-3xl font-semibold text-foreground">Sign out</h1><p className="text-muted-foreground">Confirm who is leaving now.</p></div>
    {parties.length > 1 && <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Button variant="secondary" className="min-h-kiosk h-auto whitespace-normal py-4 text-xl" disabled={saving} onClick={() => setIds(parties.filter(p => p.primary).map(p => p.id))}>Only I am leaving</Button>
        <Button variant="secondary" className="min-h-kiosk h-auto whitespace-normal py-4 text-xl" disabled={saving} onClick={() => setIds(parties.map(p => p.id))}>Everyone leaving</Button>
      </div>
      <fieldset disabled={saving} className="space-y-2"><legend className="mb-2 font-semibold">People leaving</legend>{parties.map(p => <label key={p.id} className="flex min-h-kiosk items-center gap-4 rounded-control border border-border px-4 py-3"><Checkbox checked={ids.includes(p.id)} onCheckedChange={checked => setIds(prev => checked ? [...prev.filter(id => id !== p.id), p.id] : prev.filter(id => id !== p.id))} aria-label={`Sign out ${p.label}`} className="h-6 w-6" /><span>{p.label}</span></label>)}</fieldset>
      <p className="text-muted-foreground" aria-live="polite">{ids.length} leaving · {parties.length - ids.length} staying</p>
    </>}
    {(match.open_keys || 0) > 0 && <div className="flex gap-3 border-l-4 border-warning bg-warning/10 p-4"><KeyRound className="h-6 w-6 shrink-0" aria-hidden="true" /><p>Please return your key or fob to reception before leaving.</p></div>}
    {error && <p role="alert" className="text-destructive-strong">Sign-out was not confirmed. Your choices are still here. Please try again or ask reception.</p>}
    <div className="grid gap-3 sm:grid-cols-2"><Button variant="secondary" disabled={saving} onClick={onBack} className="min-h-kiosk text-xl gap-2"><ArrowLeft aria-hidden="true" className="h-5 w-5" />Back</Button><Button disabled={saving || !match.visit_id || !validDepartureSelection(ids, parties)} onClick={submit} className="min-h-kiosk text-xl gap-2">{saving ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <LogOut className="h-5 w-5" aria-hidden="true" />}{saving ? "Saving…" : error ? "Try again" : "Confirm sign out"}</Button></div>
  </section>;
}