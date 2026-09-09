import { useState, useMemo, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useVisitors } from "@/hooks/useVisitors";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Search, LogOut, ArrowLeft, Clock, QrCode, KeyRound } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { KioskPersonCard } from "@/components/kiosk/KioskPersonCard";
import { KioskSuccessScreen } from "@/components/kiosk/KioskSuccessScreen";
import { KioskFeedbackScreen } from "@/components/kiosk/KioskFeedbackScreen";
import { KioskSkeletonList } from "@/components/kiosk/KioskSkeleton";
import { KioskErrorState } from "@/components/kiosk/KioskErrorState";
import { useOperatingContext } from "@/contexts/OperatingContext";
import { useKioskFastLane } from "@/hooks/useKioskFastLane";

type Phase = "search" | "companions" | "confirm" | "feedback" | "done";

const OVERSTAY_MS = 8 * 3600000;

export default function KioskCheckOut() {
  const navigate = useNavigate();
  const { siteId: kioskSiteId } = useOperatingContext();
  const { fastLaneEnabled } = useKioskFastLane();
  const { visitors, checkOutVisitor, loading } = useVisitors({ publicMode: true, siteId: kioskSiteId });
  const { toast } = useToast();
  const [phase, setPhase] = useState<Phase>("search");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [doneName, setDoneName] = useState("");
  const [stayingBehind, setStayingBehind] = useState(0);
  // The kiosk cannot read the keys register. It asks a narrow server check that
  // returns counts only — never key labels, properties or holders.
  const [heldCount, setHeldCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const qr = selected?.qrCode || selected?.qr_code || selected?.personQr || null;
    if (!qr) { setHeldCount(0); return; }
    (supabase.rpc as any)("kiosk_open_key_holds", { p_person_qr: qr }).then(({ data }: any) => {
      if (!cancelled) setHeldCount(Number(data?.[0]?.open_items ?? 0));
    });
    return () => { cancelled = true; };
  }, [selected]);

  const checkedIn = useMemo(
    () => visitors.filter((v) => v.status === "checked-in" && v.type !== "resident"),
    [visitors]
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return checkedIn;
    const q = search.toLowerCase();
    return checkedIn.filter((v) => `${v.firstName} ${v.surname}`.toLowerCase().includes(q));
  }, [checkedIn, search]);

  const handleSelect = (v: any) => {
    setSelected(v);
    setStayingBehind(0);
    setPhase((v.additionalVisitors || 0) > 0 ? "companions" : "confirm");
  };

  const handleConfirm = async () => {
    if (!selected) return;
    const name = `${selected.firstName} ${selected.surname}`;
    const companionCount = selected.additionalVisitors || 0;
    await checkOutVisitor(
      selected.id,
      stayingBehind > 0 ? `Kiosk check-out — ${stayingBehind} still on site` : undefined,
      undefined,
      companionCount > 0
        ? {
            remainingCompanions: stayingBehind,
            everyoneLeft: stayingBehind === 0,
          }
        : undefined
    );
    setDoneName(name);
    setPhase("feedback");
    toast({ title: "Checked Out", description: `${name} has been checked out.` });
  };

  const handleFeedbackComplete = useCallback(() => setPhase("done"), []);
  const handleComplete = useCallback(() => navigate("/kiosk/home"), [navigate]);

  if (phase === "done") {
    return (
      <KioskSuccessScreen
        title={`Goodbye, ${doneName}!`}
        subtitle="You have been checked out successfully."
        accentColor="warning"
        onComplete={handleComplete}
      />
    );
  }

  if (phase === "feedback" && selected) {
    return (
      <KioskFeedbackScreen
        visitorId={selected.id}
        visitorName={`${selected.firstName} ${selected.surname}`}
        visitorType={selected.type}
        onComplete={handleFeedbackComplete}
      />
    );
  }

  if (phase === "companions" && selected) {
    const companionCount = selected.additionalVisitors || 0;
    const name = selected.firstName;
    return (
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full space-y-6" role="region" aria-label="Who is leaving">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground">Who is leaving?</h2>
          <p className="text-sm text-muted-foreground mt-1">
            You checked in with {companionCount} other {companionCount === 1 ? "person" : "people"}.
          </p>
        </div>

        <button
          type="button"
          onClick={() => { setStayingBehind(0); setPhase("confirm"); }}
          className="w-full rounded-2xl border-2 border-warning/30 bg-card p-6 text-left active:scale-[0.99] transition"
        >
          <p className="text-xl font-bold text-foreground">All of us are leaving</p>
          <p className="text-base text-muted-foreground mt-1">
            {name} and {companionCount} {companionCount === 1 ? "other" : "others"}
          </p>
        </button>

        <div className="rounded-2xl border-2 border-border bg-card p-6 space-y-4">
          <p className="text-xl font-bold text-foreground">Some of us are staying</p>
          <p className="text-base text-muted-foreground">How many people are staying on?</p>
          <div className="flex items-center justify-center gap-6">
            <Button
              variant="secondary"
              className="h-16 w-16 text-2xl border border-border"
              onClick={() => setStayingBehind((n) => Math.max(0, n - 1))}
              aria-label="Fewer staying"
            >
              −
            </Button>
            <span className="text-4xl font-bold text-foreground w-14 text-center">{stayingBehind}</span>
            <Button
              variant="secondary"
              className="h-16 w-16 text-2xl border border-border"
              onClick={() => setStayingBehind((n) => Math.min(companionCount, n + 1))}
              aria-label="More staying"
            >
              +
            </Button>
          </div>
          <Button
            disabled={stayingBehind === 0}
            onClick={() => setPhase("confirm")}
            className="w-full h-14 text-base bg-warning hover:bg-warning/90 text-warning-foreground"
          >
            Continue
          </Button>
        </div>

        <Button variant="secondary" onClick={() => setPhase("search")} className="w-full h-14 text-base gap-2 border border-border">
          <ArrowLeft className="h-5 w-5" /> Back
        </Button>
      </motion.div>
    );
  }

  if (phase === "confirm" && selected) {
    const name = `${selected.firstName} ${selected.surname}`;
    const initials = `${selected.firstName[0]}${selected.surname[0]}`.toUpperCase();
    const checkedInAt = format(new Date(selected.checkInTime), "h:mm a");
    const ms = Date.now() - new Date(selected.checkInTime).getTime();
    const hrs = Math.floor(ms / 3600000);
    const mins = Math.floor((ms % 3600000) / 60000);
    const duration = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
    const isOverstay = ms > OVERSTAY_MS;

    return (
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full space-y-6" role="region" aria-label="Confirm check out">
        <h2 className="text-2xl font-bold text-foreground text-center">Confirm Check Out</h2>
        <div className="rounded-2xl border-2 border-warning/20 bg-card p-8 flex flex-col items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-warning/10 text-warning flex items-center justify-center text-xl font-bold" aria-hidden="true">
            {initials}
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground">{name}</p>
            <p className="text-base text-muted-foreground capitalize">{selected.type}</p>
          </div>
          <div className="w-full border-t border-border pt-4 space-y-2 text-base">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Checked in</span>
              <span className="font-medium text-foreground">{checkedInAt}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Duration</span>
              <span className={`font-medium flex items-center gap-1.5 ${isOverstay ? "text-warning" : "text-foreground"}`}>
                {isOverstay && <Clock className="h-4 w-4 text-warning animate-pulse" aria-hidden="true" />}
                {duration}
                {isOverstay && <span className="text-xs text-warning font-bold ml-1">OVERSTAY</span>}
              </span>
            </div>
            {(selected.additionalVisitors || 0) > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Leaving now</span>
                <span className="font-medium text-foreground">
                  {stayingBehind > 0
                    ? `${(selected.additionalVisitors || 0) - stayingBehind + 1} of ${(selected.additionalVisitors || 0) + 1} — ${stayingBehind} staying on`
                    : "Everyone in your group"}
                </span>
              </div>
            )}
            {selected.whomToVisit && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Visiting</span>
                <span className="font-medium text-foreground">{selected.whomToVisit}</span>
              </div>
            )}
          </div>
        </div>

        {heldCount > 0 && (
          <div className="rounded-2xl border-2 border-warning/40 bg-warning/5 p-4 flex items-start gap-3 mb-4">
            <KeyRound className="h-6 w-6 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="text-base font-semibold text-foreground">
                Please hand back {heldCount === 1 ? "the key or fob" : `the ${heldCount} keys or fobs`} before you leave
              </p>
              <p className="text-sm text-muted-foreground">
                Reception will check them back in for you.
              </p>
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => setPhase((selected.additionalVisitors || 0) > 0 ? "companions" : "search")} className="flex-1 h-14 text-base gap-2 border border-border" aria-label="Cancel and go back">
            <ArrowLeft className="h-5 w-5" /> Cancel
          </Button>
          <Button onClick={handleConfirm} className="flex-1 h-14 text-base gap-2 bg-warning hover:bg-warning/90 text-warning-foreground" aria-label={`Check out ${name}`}>
            <LogOut className="h-5 w-5" /> Yes, Check Out
          </Button>
        </div>
      </motion.div>
    );
  }

  // Search phase
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full space-y-6" role="region" aria-label="Check out search">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-foreground">Check Out</h2>
        <p className="text-sm text-muted-foreground mt-1">Find your name below</p>
      </div>
      {fastLaneEnabled && (
        <Button variant="secondary" onClick={() => navigate("/kiosk/qr-scan?mode=checkout")} className="w-full h-12 text-base gap-2 border border-border">
          <QrCode className="h-5 w-5" /> Scan Your Card Instead
        </Button>
      )}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" aria-hidden="true" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search your name..." className="pl-12 h-14 text-lg" autoFocus aria-label="Search visitors" />
      </div>
      <div className="space-y-2 max-h-[calc(100vh-320px)] overflow-y-auto kiosk-scroll-fade" role="list" aria-label="Checked in visitors">
        {loading ? (
          <KioskSkeletonList count={4} />
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <LogOut className="h-12 w-12 text-muted-foreground/40 mx-auto" />
            <p className="text-muted-foreground text-lg">No visitors currently checked in</p>
          </div>
        ) : (
          filtered.map((v) => {
            const ms = Date.now() - new Date(v.checkInTime).getTime();
            const isOverstay = ms > OVERSTAY_MS;
            return (
              <KioskPersonCard
                key={v.id}
                name={`${v.firstName} ${v.surname}`}
                subtitle={`${v.type} • In since ${format(new Date(v.checkInTime), "h:mm a")}${isOverstay ? " • ⚠ Overstay" : ""}`}
                accentColor="warning"
                rightIcon={<LogOut className="h-5 w-5 text-warning shrink-0" aria-hidden="true" />}
                onClick={() => handleSelect(v)}
              />
            );
          })
        )}
      </div>
    </motion.div>
  );
}
