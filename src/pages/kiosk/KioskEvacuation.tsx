import { OutcomeDialog } from "@/components/emergency/OutcomeDialog";
import { emergencyPolicy, emergencyCounts, EmergencyOutcome, ConfirmationMethod } from "@/lib/emergencyPolicy";
import { KioskRollCallRow } from "@/hooks/useKioskEmergency";
import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KioskPinPad } from "@/components/kiosk/KioskPinPad";
import { useKioskEmergency } from "@/hooks/useKioskEmergency";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, ArrowLeft, Check, MapPin, Search, Siren, Undo2 } from "lucide-react";
import { motion } from "framer-motion";

const ACCOUNTED = ["safe", "safe_elsewhere", "evacuated_offsite"];

/**
 * Staff-only kiosk roll call, reached with the footer PIN.
 * All reads and writes go through purpose-built server functions, so the kiosk
 * only ever sees name, type, location, phone, status and assistance flag.
 */
export default function KioskEvacuation({ onExit }: { onExit?: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const [pin, setPin] = useState<string | null>((location.state as any)?.pin || null);
  const [pinOpen, setPinOpen] = useState(!((location.state as any)?.pin));
  const [search, setSearch] = useState("");
  const [recording, setRecording] = useState<KioskRollCallRow | null>(null);
  const [busy, setBusy] = useState(false);

  const { rows, loading, error, mark, refresh } = useKioskEmergency(pin);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.person_name.toLowerCase().includes(q) ||
        (r.location_label || "").toLowerCase().includes(q)
    );
  }, [rows, search]);

  const counts = emergencyCounts(rows);
  const safeCount = counts.accounted;
  const progress = rows.length ? Math.round((safeCount / rows.length) * 100) : 0;

  const exit = () => (onExit ? onExit() : navigate("/kiosk/home"));

  const setStatus = async (id: string, outcome: EmergencyOutcome, method?: ConfirmationMethod, reason?: string) => {
    setBusy(true);
    const ok = await mark(id, outcome, method, reason);
    setBusy(false);
    if (ok) setRecording(null);
    if (!ok) toast({ title: "Could not record that", description: error || "Please try again.", variant: "destructive" });
  };

  if (!pin) {
    return (
      <>
        <div className="w-full max-w-xl mx-auto space-y-6 py-10 text-center">
          <div className="h-16 w-16 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
            <Siren className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">Staff PIN required</h2>
          <p className="text-base text-muted-foreground">Enter the staff PIN to open the emergency roll call.</p>
          <Button onClick={() => setPinOpen(true)} className="w-full h-14 text-base rounded-2xl">Enter PIN</Button>
          <Button variant="secondary" onClick={exit} className="w-full h-14 text-base rounded-2xl border border-border gap-2">
            <ArrowLeft className="h-5 w-5" /> Back to kiosk
          </Button>
        </div>
        <KioskPinPad open={pinOpen} onOpenChange={setPinOpen} onSuccess={(entered) => { setPin(entered); setPinOpen(false); }} />
      </>
    );
  }

  if (loading && rows.length === 0) return <p role="status">Loading roll call…</p>;
  if (error && rows.length === 0) return <div role="alert" className="space-y-4"><p>Roll call unavailable. Use the site emergency plan and printed fallback.</p><Button className="h-14" onClick={() => void refresh()}>Try again</Button><Button className="h-14" onClick={exit}>Back to kiosk</Button></div>;
  if (rows.length === 0) {
    return (
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-xl mx-auto space-y-6 py-6 text-center">
        <div className="h-16 w-16 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
          <Siren className="h-8 w-8" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">No emergency is running</h2>
        <p className="text-base text-muted-foreground">
          An emergency must be activated by staff on a computer before the kiosk can take a roll call.
          Use the printed roll call sheet if the system is unavailable.
        </p>
        <Button variant="secondary" onClick={() => void refresh()} className="w-full h-14 text-base rounded-2xl border border-border">Check again</Button>
        <Button variant="secondary" onClick={exit} className="w-full h-14 text-base rounded-2xl border border-border gap-2">
          <ArrowLeft className="h-5 w-5" /> Back to kiosk
        </Button>
      </motion.div>
    );
  }

  const header = rows[0];

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4 py-2">
      <div className="rounded-2xl border-2 border-destructive/40 bg-destructive/5 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-destructive font-bold text-lg">
            <AlertTriangle className="h-5 w-5" />
            {header.event_class === "drill" ? "Drill roll call" : "Emergency roll call"}
          </div>
          <span className="text-lg font-bold text-foreground tabular-nums">{safeCount}/{rows.length}</span>
        </div>
        <div className="h-2.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-success transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <p className="text-sm text-foreground">{counts.physical} physically verified · {counts.reported} reported / legacy · {counts.notPresent} confirmed not present · {counts.outstanding} outstanding</p>
      {error && <p role="alert" className="text-destructive">Could not save the outcome. Try again.</p>}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or location…"
          className="pl-12 h-14 text-lg"
        />
      </div>

      <div className="space-y-2 max-h-[calc(100vh-380px)] overflow-y-auto kiosk-scroll-fade">
        {filtered.map((r) => {
          const accounted = emergencyPolicy(r).accounted;
          return (
            <div
              key={r.attendance_id}
              className={`rounded-xl border-2 p-3 ${accounted ? "border-success/40 bg-success/5" : "border-border bg-card"}`}
            >
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold text-foreground truncate">{r.person_name}</p>
                  <p className="text-[13px] text-muted-foreground truncate">
                    {[r.person_type, r.location_label, r.contact_phone].filter(Boolean).join(" · ")}
                  </p>
                  {r.assistance_level && (
                    <p className="text-[12px] text-warning">Assistance: {r.assistance_level}</p>
                  )}
                </div>
                <Button variant="outline" disabled={busy} className="h-14" aria-label={`Record outcome for ${r.person_name}`} onClick={() => setRecording(r)}>Record outcome</Button>
              </div>
              <p className="text-sm text-foreground mt-2">{emergencyPolicy(r).label} · {emergencyPolicy(r).methodLabel}</p>
            </div>
          );
        })}
        {filtered.length === 0 && <p className="text-center text-muted-foreground py-10">No one matches that search.</p>}
      </div>

      {recording && <OutcomeDialog name={recording.person_name} busy={busy} correction={emergencyPolicy(recording).accounted} onClose={() => setRecording(null)} onSave={async (outcome, method, reason) => { await setStatus(recording.attendance_id, outcome, method, reason); }} />}
      <p className="text-center text-[12px] text-muted-foreground">
        Staff close the emergency and record review notes on a computer.
      </p>

      <Button variant="secondary" onClick={exit} className="w-full h-14 text-base rounded-2xl border border-border gap-2">
        <ArrowLeft className="h-5 w-5" /> Back to kiosk
      </Button>
    </div>
  );
}
