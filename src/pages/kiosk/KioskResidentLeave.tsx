import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useResidents } from "@/hooks/useResidents";
import { useVisitors } from "@/hooks/useVisitors";
import { useActiveLeaveTypes } from "@/hooks/useLeaveTypes";
import { useToast } from "@/hooks/use-toast";
import { DoorOpen, Search, Home, ArrowLeft, ArrowRight, Calendar, RotateCcw } from "lucide-react";
import { motion } from "framer-motion";
import { KioskPersonCard } from "@/components/kiosk/KioskPersonCard";
import { KioskSuccessScreen } from "@/components/kiosk/KioskSuccessScreen";

type Mode = "select" | "leaving" | "leaving-confirm" | "returning" | "returning-confirm";

export default function KioskResidentLeave() {
  const navigate = useNavigate();
  const { residents } = useResidents();
  const { visitors, checkOutVisitor, checkInReturn } = useVisitors();
  const { leaveTypes } = useLeaveTypes();
  const { toast } = useToast();

  const [mode, setMode] = useState<Mode>("select");
  const [room, setRoom] = useState("");
  const [returnSearch, setReturnSearch] = useState("");
  const [selectedResident, setSelectedResident] = useState<any>(null);
  const [selectedLeaveType, setSelectedLeaveType] = useState<string>("");
  const [expectedReturn, setExpectedReturn] = useState("");
  const [doneMessage, setDoneMessage] = useState<{ title: string; subtitle: string } | null>(null);

  const awayResidents = useMemo(
    () => visitors.filter((v) => v.type === "resident" && v.status === "checked-out"),
    [visitors]
  );

  const filteredResidents = useMemo(() => {
    if (!room.trim()) return residents;
    const q = room.toLowerCase();
    return residents.filter((r) =>
      r.room?.toLowerCase().includes(q) || `${r.firstName} ${r.surname}`.toLowerCase().includes(q)
    );
  }, [residents, room]);

  const filteredAway = useMemo(() => {
    if (!returnSearch.trim()) return awayResidents;
    const q = returnSearch.toLowerCase();
    return awayResidents.filter((v) => `${v.firstName} ${v.surname}`.toLowerCase().includes(q));
  }, [awayResidents, returnSearch]);

  const handleSelectLeaving = (r: any) => {
    setSelectedResident(r);
    setMode("leaving-confirm");
  };

  const handleConfirmLeave = async () => {
    if (!selectedResident) return;
    const name = `${selectedResident.firstName} ${selectedResident.surname}`;
    const roomNum = selectedResident.room || "—";
    await checkOutVisitor(selectedResident.visitorId, `Kiosk self-service departure${selectedLeaveType ? ` — ${selectedLeaveType}` : ""}`);
    setDoneMessage({ title: `${name} — have a safe trip!`, subtitle: `Room ${roomNum} departure recorded` });
    toast({ title: "Departure Recorded", description: `${name} has been marked as away.` });
  };

  const handleSelectReturn = (v: any) => {
    setSelectedResident(v);
    setMode("returning-confirm");
  };

  const handleConfirmReturn = async () => {
    if (!selectedResident) return;
    const name = `${selectedResident.firstName} ${selectedResident.surname}`;
    await checkInReturn(selectedResident.id, "Kiosk self-service return");
    setDoneMessage({ title: `Welcome back, ${name}!`, subtitle: "Return has been recorded" });
    toast({ title: "Return Recorded", description: `${name} has been marked as returned.` });
  };

  const handleComplete = useCallback(() => navigate("/kiosk/home"), [navigate]);

  if (doneMessage) {
    return (
      <KioskSuccessScreen
        title={doneMessage.title}
        subtitle={doneMessage.subtitle}
        accentColor="info"
        onComplete={handleComplete}
      />
    );
  }

  // Leaving confirmation
  if (mode === "leaving-confirm" && selectedResident) {
    const name = `${selectedResident.firstName} ${selectedResident.surname}`;
    return (
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-2xl space-y-6">
        <h2 className="text-3xl font-bold text-foreground text-center">Confirm Departure</h2>
        <div className="rounded-2xl border-2 border-border bg-card p-8 flex flex-col items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-warning/10 text-warning flex items-center justify-center text-xl font-bold">
            {`${selectedResident.firstName[0]}${selectedResident.surname[0]}`.toUpperCase()}
          </div>
          <p className="text-2xl font-bold text-foreground">{name}</p>
          <p className="text-base text-muted-foreground">{selectedResident.room || "—"} {selectedResident.wing ? `• ${selectedResident.wing}` : ""}</p>
        </div>

        {/* Leave type selector */}
        {leaveTypes.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-muted-foreground">Reason for leaving</p>
            <div className="grid grid-cols-2 gap-2">
              {leaveTypes.map((lt) => (
                <button
                  key={lt.id}
                  onClick={() => setSelectedLeaveType(lt.name)}
                  className={`p-4 rounded-xl border-2 text-left transition-all active:scale-[0.97] ${
                    selectedLeaveType === lt.name ? "border-warning bg-warning/5" : "border-border hover:border-warning/50"
                  }`}
                >
                  <span className="text-lg mr-2">{lt.emoji}</span>
                  <span className="text-base font-medium">{lt.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Expected return */}
        <div className="space-y-2">
          <p className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
            <Calendar className="h-4 w-4" /> Expected return (optional)
          </p>
          <Input
            type="datetime-local"
            value={expectedReturn}
            onChange={(e) => setExpectedReturn(e.target.value)}
            className="h-14 text-lg"
          />
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setMode("leaving")} className="flex-1 h-14 text-base gap-2">
            <ArrowLeft className="h-5 w-5" /> Back
          </Button>
          <Button onClick={handleConfirmLeave} className="flex-1 h-14 text-base gap-2 bg-warning hover:bg-warning/90 text-warning-foreground">
            <DoorOpen className="h-5 w-5" /> Confirm Departure
          </Button>
        </div>
      </motion.div>
    );
  }

  // Returning confirmation
  if (mode === "returning-confirm" && selectedResident) {
    const name = `${selectedResident.firstName} ${selectedResident.surname}`;
    return (
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-2xl space-y-6">
        <h2 className="text-3xl font-bold text-foreground text-center">Confirm Return</h2>
        <div className="rounded-2xl border-2 border-border bg-card p-8 flex flex-col items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-success/10 text-success flex items-center justify-center text-xl font-bold">
            {`${selectedResident.firstName[0]}${selectedResident.surname[0]}`.toUpperCase()}
          </div>
          <p className="text-2xl font-bold text-foreground">{name}</p>
          <p className="text-base text-muted-foreground">Marking as returned</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setMode("returning")} className="flex-1 h-14 text-base gap-2">
            <ArrowLeft className="h-5 w-5" /> Back
          </Button>
          <Button onClick={handleConfirmReturn} className="flex-1 h-14 text-base gap-2 bg-success hover:bg-success/90 text-success-foreground">
            <Home className="h-5 w-5" /> Confirm Return
          </Button>
        </div>
      </motion.div>
    );
  }

  // Mode select
  if (mode === "select") {
    return (
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-2xl space-y-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-foreground">Resident Leave</h2>
          <p className="text-base text-muted-foreground mt-1">Are you leaving or returning?</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => setMode("leaving")}
            className="flex flex-col items-center gap-4 p-8 rounded-2xl border-2 border-warning/20 bg-warning/10 text-warning hover:bg-warning hover:text-warning-foreground transition-all duration-200 min-h-[200px] active:scale-[0.96]"
          >
            <DoorOpen className="h-12 w-12" />
            <div className="text-center">
              <span className="text-xl font-bold block">Leaving</span>
              <span className="text-sm opacity-80 mt-1 block">Record departure</span>
            </div>
          </button>
          <button
            onClick={() => setMode("returning")}
            className="flex flex-col items-center gap-4 p-8 rounded-2xl border-2 border-success/20 bg-success/10 text-success hover:bg-success hover:text-success-foreground transition-all duration-200 min-h-[200px] active:scale-[0.96]"
          >
            <Home className="h-12 w-12" />
            <div className="text-center">
              <span className="text-xl font-bold block">Returning</span>
              <span className="text-sm opacity-80 mt-1 block">{awayResidents.length} away</span>
            </div>
          </button>
        </div>
      </motion.div>
    );
  }

  // Returning list with search
  if (mode === "returning") {
    return (
      <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} className="w-full max-w-2xl space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => setMode("select")} className="h-12 gap-2">
            <ArrowLeft className="h-5 w-5" /> Back
          </Button>
          <h2 className="text-2xl font-bold text-foreground">Welcome Back</h2>
        </div>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input value={returnSearch} onChange={(e) => setReturnSearch(e.target.value)} placeholder="Search by name..." className="pl-12 h-14 text-lg" autoFocus />
        </div>
        <div className="space-y-2 max-h-[calc(100vh-320px)] overflow-y-auto">
          {filteredAway.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-lg">No residents currently away</div>
          ) : (
            filteredAway.map((v) => (
              <KioskPersonCard
                key={v.id}
                name={`${v.firstName} ${v.surname}`}
                subtitle={v.leaveType || "Away"}
                accentColor="success"
                rightIcon={<Home className="h-5 w-5 text-success shrink-0" />}
                onClick={() => handleSelectReturn(v)}
              />
            ))
          )}
        </div>
      </motion.div>
    );
  }

  // Leaving mode — room-first display
  return (
    <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} className="w-full max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={() => setMode("select")} className="h-12 gap-2">
          <ArrowLeft className="h-5 w-5" /> Back
        </Button>
        <h2 className="text-2xl font-bold text-foreground">Find Your Room</h2>
      </div>
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input value={room} onChange={(e) => setRoom(e.target.value)} placeholder="Room number or name..." className="pl-12 h-14 text-lg" autoFocus />
      </div>
      <div className="space-y-2 max-h-[calc(100vh-320px)] overflow-y-auto">
        {filteredResidents.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-lg">No residents found</div>
        ) : (
          filteredResidents.map((r) => (
            <KioskPersonCard
              key={r.id}
              name={`${r.firstName} ${r.surname}`}
              subtitle={`${r.room || "—"} ${r.wing ? `• ${r.wing}` : ""}`}
              accentColor="warning"
              rightIcon={<DoorOpen className="h-5 w-5 text-warning shrink-0" />}
              onClick={() => handleSelectLeaving(r)}
            />
          ))
        )}
      </div>
    </motion.div>
  );
}
