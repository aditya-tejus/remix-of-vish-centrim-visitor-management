import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useVisitors } from "@/hooks/useVisitors";
import { useToast } from "@/hooks/use-toast";
import { Search, LogOut, ArrowLeft, Clock } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { KioskPersonCard } from "@/components/kiosk/KioskPersonCard";
import { KioskSuccessScreen } from "@/components/kiosk/KioskSuccessScreen";
import { KioskFeedbackScreen } from "@/components/kiosk/KioskFeedbackScreen";
import { KioskSkeletonList } from "@/components/kiosk/KioskSkeleton";
import { KioskErrorState } from "@/components/kiosk/KioskErrorState";

type Phase = "search" | "confirm" | "feedback" | "done";

const OVERSTAY_MS = 8 * 3600000;

export default function KioskCheckOut() {
  const navigate = useNavigate();
  const { visitors, checkOutVisitor, isLoading, error } = useVisitors();
  const { toast } = useToast();
  const [phase, setPhase] = useState<Phase>("search");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [doneName, setDoneName] = useState("");

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
    setPhase("confirm");
  };

  const handleConfirm = async () => {
    if (!selected) return;
    const name = `${selected.firstName} ${selected.surname}`;
    await checkOutVisitor(selected.id);
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
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-2xl space-y-6" role="region" aria-label="Confirm check out">
        <h2 className="text-3xl font-bold text-foreground text-center">Confirm Check Out</h2>
        <div className="rounded-2xl border-2 border-border bg-card p-8 flex flex-col items-center gap-4">
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
            {selected.whomToVisit && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Visiting</span>
                <span className="font-medium text-foreground">{selected.whomToVisit}</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setPhase("search")} className="flex-1 h-14 text-base gap-2" aria-label="Cancel and go back">
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
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-2xl space-y-6" role="region" aria-label="Check out search">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-foreground">Check Out</h2>
        <p className="text-base text-muted-foreground mt-1">Find your name below</p>
      </div>
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" aria-hidden="true" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search your name..." className="pl-12 h-14 text-lg" autoFocus aria-label="Search visitors" />
      </div>
      <div className="space-y-2 max-h-[calc(100vh-320px)] overflow-y-auto" role="list" aria-label="Checked in visitors">
        {isLoading ? (
          <KioskSkeletonList count={4} />
        ) : error ? (
          <KioskErrorState message="Could not load visitors. Please try again." onRetry={() => window.location.reload()} />
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-lg">No visitors currently checked in</div>
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
