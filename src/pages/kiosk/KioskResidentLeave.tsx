import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useResidents } from "@/hooks/useResidents";
import { useVisitors } from "@/hooks/useVisitors";
import { useToast } from "@/hooks/use-toast";
import { DoorOpen, ArrowLeftRight, Search, CheckCircle2, Home } from "lucide-react";

type Mode = "select" | "leaving" | "returning";

export default function KioskResidentLeave() {
  const navigate = useNavigate();
  const { residents } = useResidents();
  const { visitors, checkOutVisitor, checkInReturn } = useVisitors();
  const { toast } = useToast();
  const [mode, setMode] = useState<Mode>("select");
  const [room, setRoom] = useState("");
  const [done, setDone] = useState<string | null>(null);

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

  const handleLeave = async (visitorId: string, name: string) => {
    await checkOutVisitor(visitorId, "Kiosk self-service departure");
    setDone(`${name} — have a safe trip!`);
    toast({ title: "Departure Recorded", description: `${name} has been marked as away.` });
    setTimeout(() => navigate("/kiosk"), 3000);
  };

  const handleReturn = async (visitorId: string, name: string) => {
    await checkInReturn(visitorId, "Kiosk self-service return");
    setDone(`Welcome back, ${name}!`);
    toast({ title: "Return Recorded", description: `${name} has been marked as returned.` });
    setTimeout(() => navigate("/kiosk"), 3000);
  };

  if (done) {
    return (
      <div className="text-center space-y-4 max-w-md">
        <div className="h-20 w-20 rounded-full bg-success/10 flex items-center justify-center mx-auto">
          <CheckCircle2 className="h-10 w-10 text-success" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">{done}</h2>
      </div>
    );
  }

  if (mode === "select") {
    return (
      <div className="w-full max-w-md space-y-6">
        <h2 className="text-2xl font-bold text-foreground text-center">Resident Leave</h2>
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => setMode("leaving")}
            className="flex flex-col items-center gap-3 p-8 rounded-2xl border-2 border-border bg-card hover:border-warning transition-all min-h-[160px]"
          >
            <DoorOpen className="h-10 w-10 text-warning" />
            <span className="text-lg font-semibold">Leaving</span>
          </button>
          <button
            onClick={() => setMode("returning")}
            className="flex flex-col items-center gap-3 p-8 rounded-2xl border-2 border-border bg-card hover:border-success transition-all min-h-[160px]"
          >
            <Home className="h-10 w-10 text-success" />
            <span className="text-lg font-semibold">Returning</span>
          </button>
        </div>
      </div>
    );
  }

  if (mode === "returning") {
    return (
      <div className="w-full max-w-lg space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => setMode("select")}>← Back</Button>
          <h2 className="text-2xl font-bold text-foreground">Welcome Back</h2>
        </div>
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {awayResidents.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No residents currently away</div>
          ) : (
            awayResidents.map((v) => (
              <button
                key={v.id}
                onClick={() => handleReturn(v.id, `${v.firstName} ${v.surname}`)}
                className="w-full flex items-center justify-between p-4 rounded-xl border-2 border-border bg-card hover:border-success transition-all text-left"
              >
                <div>
                  <p className="text-base font-semibold">{v.firstName} {v.surname}</p>
                  <p className="text-sm text-muted-foreground">{v.address || "—"}</p>
                </div>
                <CheckCircle2 className="h-5 w-5 text-success" />
              </button>
            ))
          )}
        </div>
      </div>
    );
  }

  // Leaving mode
  return (
    <div className="w-full max-w-lg space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={() => setMode("select")}>← Back</Button>
        <h2 className="text-2xl font-bold text-foreground">Enter Room / Search</h2>
      </div>
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input value={room} onChange={(e) => setRoom(e.target.value)} placeholder="Room number or name..." className="pl-12 h-12 text-base" autoFocus />
      </div>
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {filteredResidents.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">No residents found</div>
        ) : (
          filteredResidents.map((r) => (
              <button
                key={r.id}
                onClick={() => handleLeave(r.visitorId, `${r.firstName} ${r.surname}`)}
                className="w-full flex items-center justify-between p-4 rounded-xl border-2 border-border bg-card hover:border-warning transition-all text-left"
              >
                <div>
                  <p className="text-base font-semibold">{r.firstName} {r.surname}</p>
                  <p className="text-sm text-muted-foreground">{r.room || "—"} {r.wing ? `• ${r.wing}` : ""}</p>
              </div>
              <DoorOpen className="h-5 w-5 text-warning" />
            </button>
          ))
        )}
      </div>
    </div>
  );
}
