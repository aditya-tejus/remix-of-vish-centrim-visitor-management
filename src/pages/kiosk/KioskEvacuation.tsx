import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useVisitors } from "@/hooks/useVisitors";
import { useResidents } from "@/hooks/useResidents";
import { useSiteStructure } from "@/hooks/useSiteStructure";
import { buildRollCall } from "@/lib/evacuation";
import {
  useEvacuationDrills,
  useEvacuationAttendance,
  useEvacuationMutations,
} from "@/hooks/useEvacuation";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, ArrowLeft, Check, Search, Siren, Undo2 } from "lucide-react";
import { motion } from "framer-motion";

/**
 * Staff-only kiosk roll call, reached with the footer PIN.
 * Same data and actions as the desktop evacuation screen, sized for touch.
 */
export default function KioskEvacuation({ onExit }: { onExit?: () => void }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { visitors } = useVisitors({ publicMode: true });
  const { residents } = useResidents({ publicMode: true });
  const { roomLabel, areaLabel } = useSiteStructure();

  const { data: activeDrills = [] } = useEvacuationDrills("active");
  const activeDrill = activeDrills[0];
  const { data: attendance = [] } = useEvacuationAttendance(activeDrill?.id);
  const { startDrill, markSafe, markUnsafe, endDrill } = useEvacuationMutations();

  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);

  const { onSite } = useMemo(
    () => buildRollCall({ visitors, residents, roomLabel }),
    [visitors, residents, roomLabel]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return attendance;
    return attendance.filter(
      (a) =>
        a.person_name.toLowerCase().includes(q) ||
        (a.room_label || "").toLowerCase().includes(q) ||
        (a.area_label || "").toLowerCase().includes(q)
    );
  }, [attendance, search]);

  const safeCount = attendance.filter((a) => a.status !== "unaccounted").length;
  const progress = attendance.length ? Math.round((safeCount / attendance.length) * 100) : 0;

  const exit = () => (onExit ? onExit() : navigate("/kiosk/home"));

  const handleStart = async () => {
    setBusy(true);
    try {
      await startDrill.mutateAsync({
        title: `Emergency roll call — ${new Date().toLocaleString()}`,
        people: onSite.map((p) => ({
          name: p.name,
          type: p.type,
          visitorId: p.visitorId,
          companionIndex: p.companionIndex,
          assistanceLevel: p.assistance.label,
          contactPhone: p.phone,
          emergencyContactName: p.emergencyContactName,
          emergencyContactPhone: p.emergencyContactPhone,
          area: p.area,
          room: p.room,
          responsibleStaff: p.responsibleStaff,
          associatedWith: p.associatedWith.join("; "),
        })),
        eventType: "emergency",
      });

      toast({ title: "Roll call started", description: `${onSite.length} people to account for.` });
    } catch (e: any) {
      toast({ title: "Could not start roll call", description: e.message, variant: "destructive" });
    }
    setBusy(false);
  };

  const handleEnd = async () => {
    if (!activeDrill) return;
    setBusy(true);
    try {
      await endDrill.mutateAsync({ drillId: activeDrill.id, accounted: safeCount });
      toast({ title: "Roll call closed" });
    } catch (e: any) {
      toast({ title: "Could not close roll call", description: e.message, variant: "destructive" });
    }
    setBusy(false);
  };

  if (!activeDrill) {
    return (
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-xl mx-auto space-y-6 py-6">
        <div className="text-center space-y-2">
          <div className="h-16 w-16 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
            <Siren className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">Emergency roll call</h2>
          <p className="text-base text-muted-foreground">
            {onSite.length} people are currently on site, including residents, staff, contractors, visitors and
            anyone with them.
          </p>
        </div>
        <Button onClick={handleStart} disabled={busy} className="w-full h-16 text-lg rounded-2xl bg-destructive hover:bg-destructive/90 text-destructive-foreground">
          {busy ? "Starting…" : "Start roll call"}
        </Button>
        <Button variant="secondary" onClick={exit} className="w-full h-14 text-base rounded-2xl border border-border gap-2">
          <ArrowLeft className="h-5 w-5" /> Back to kiosk
        </Button>
      </motion.div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4 py-2">
      {/* Progress header */}
      <div className="rounded-2xl border-2 border-destructive/40 bg-destructive/5 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-destructive font-bold text-lg">
            <AlertTriangle className="h-5 w-5" /> Roll call in progress
          </div>
          <span className="text-lg font-bold text-foreground tabular-nums">
            {safeCount}/{attendance.length}
          </span>
        </div>
        <div className="h-2.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-success transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search name, ${roomLabel.toLowerCase()} or ${areaLabel.toLowerCase()}…`}
          className="pl-12 h-14 text-lg"
        />
      </div>

      <div className="space-y-2 max-h-[calc(100vh-360px)] overflow-y-auto kiosk-scroll-fade">
        {filtered.map((a) => {
          const accounted = a.status !== "unaccounted";
          return (
            <div
              key={a.id}
              className={`flex items-center gap-3 rounded-xl border-2 p-3 ${
                accounted ? "border-success/40 bg-success/5" : "border-border bg-card"
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="text-base font-semibold text-foreground truncate">{a.person_name}</p>
                <p className="text-[13px] text-muted-foreground truncate">
                  {[a.person_type, a.area_label, a.room_label].filter(Boolean).join(" · ")}
                  {a.contact_phone ? ` · ${a.contact_phone}` : ""}
                </p>
                {(a.assistance_level || a.associated_with || a.responsible_staff) && (
                  <p className="text-[12px] text-muted-foreground truncate">
                    {[a.assistance_level && `Assistance: ${a.assistance_level}`, a.associated_with && `With: ${a.associated_with}`, a.responsible_staff && `Staff: ${a.responsible_staff}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
              </div>
              {accounted ? (
                <Button
                  variant="secondary"
                  className="h-12 min-w-[96px] rounded-xl border border-border gap-1.5"
                  onClick={() => markUnsafe.mutate(a.id)}
                >
                  <Undo2 className="h-4 w-4" /> Undo
                </Button>
              ) : (
                <Button
                  className="h-12 min-w-[112px] rounded-xl bg-success hover:bg-success/90 text-success-foreground gap-1.5"
                  onClick={() => markSafe.mutate({ id: a.id, markedBy: "Kiosk staff" })}
                >
                  <Check className="h-5 w-5" /> Safe
                </Button>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-center text-muted-foreground py-10">No one matches that search.</p>
        )}
      </div>

      <div className="flex gap-3 pt-1">
        <Button variant="secondary" onClick={exit} className="flex-1 h-14 text-base rounded-2xl border border-border gap-2">
          <ArrowLeft className="h-5 w-5" /> Back to kiosk
        </Button>
        <Button onClick={handleEnd} disabled={busy} className="flex-1 h-14 text-base rounded-2xl">
          Close roll call
        </Button>
      </div>
    </div>
  );
}
