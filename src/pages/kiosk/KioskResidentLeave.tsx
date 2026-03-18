import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useResidents } from "@/hooks/useResidents";
import { useVisitors } from "@/hooks/useVisitors";
import { useToast } from "@/hooks/use-toast";
import { DoorOpen, Search, Home, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import { KioskPersonCard } from "@/components/kiosk/KioskPersonCard";
import { KioskSuccessScreen } from "@/components/kiosk/KioskSuccessScreen";

type Mode = "select" | "leaving" | "returning";

export default function KioskResidentLeave() {
  const navigate = useNavigate();
  const { residents } = useResidents();
  const { visitors, checkOutVisitor, checkInReturn } = useVisitors();
  const { toast } = useToast();
  const [mode, setMode] = useState<Mode>("select");
  const [room, setRoom] = useState("");
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

  const handleLeave = async (visitorId: string, name: string, roomNum: string) => {
    await checkOutVisitor(visitorId, "Kiosk self-service departure");
    setDoneMessage({ title: `${name} — have a safe trip!`, subtitle: `Room ${roomNum || "—"} departure recorded` });
    toast({ title: "Departure Recorded", description: `${name} has been marked as away.` });
  };

  const handleReturn = async (visitorId: string, name: string) => {
    await checkInReturn(visitorId, "Kiosk self-service return");
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

  if (mode === "select") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-6"
      >
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

  if (mode === "returning") {
    return (
      <motion.div
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        className="w-full max-w-lg space-y-6"
      >
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => setMode("select")} className="h-12 gap-2">
            <ArrowLeft className="h-5 w-5" /> Back
          </Button>
          <h2 className="text-2xl font-bold text-foreground">Welcome Back</h2>
        </div>
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {awayResidents.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-lg">No residents currently away</div>
          ) : (
            awayResidents.map((v) => (
              <KioskPersonCard
                key={v.id}
                name={`${v.firstName} ${v.surname}`}
                subtitle={v.address || "—"}
                accentColor="success"
                rightIcon={<Home className="h-5 w-5 text-success shrink-0" />}
                onClick={() => handleReturn(v.id, `${v.firstName} ${v.surname}`)}
              />
            ))
          )}
        </div>
      </motion.div>
    );
  }

  // Leaving mode — room-first display
  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      className="w-full max-w-lg space-y-6"
    >
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
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {filteredResidents.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-lg">No residents found</div>
        ) : (
          filteredResidents.map((r) => (
            <KioskPersonCard
              key={r.id}
              name={`${r.firstName} ${r.surname}`}
              initials={r.room || `${r.firstName[0]}${r.surname[0]}`.toUpperCase()}
              subtitle={`Room ${r.room || "—"} ${r.wing ? `• ${r.wing}` : ""}`}
              accentColor="warning"
              rightIcon={<DoorOpen className="h-5 w-5 text-warning shrink-0" />}
              onClick={() => handleLeave(r.visitorId, `${r.firstName} ${r.surname}`, r.room)}
            />
          ))
        )}
      </div>
    </motion.div>
  );
}
