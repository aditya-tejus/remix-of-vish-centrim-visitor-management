import { useState, useMemo, useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useVisitors } from "@/hooks/useVisitors";
import { useResidents } from "@/hooks/useResidents";
import { useAuth } from "@/hooks/useAuth";
import { useSiteStructure } from "@/hooks/useSiteStructure";
import { useJurisdiction } from "@/hooks/useJurisdiction";
import {
  useEvacuationDrills,
  useEvacuationAttendance,
  useEvacuationPoints,
  useEvacuationMutations,
  EvacuationDrill,
  RollCallSeed,
  AttendanceStatus,
  ATTENDANCE_LABELS,
  ACCOUNTED_STATUSES,
} from "@/hooks/useEvacuation";
import { usePermissions } from "@/hooks/usePermissions";
import { useSite } from "@/contexts/SiteContext";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertTriangle, CheckCircle2, Search, Shield, Clock, Users, Download, Printer,
  Home, MapPin, Phone, Accessibility, ArrowDown, PlaneTakeoff, Ambulance,
  WifiOff, RefreshCw, ChevronDown, ChevronRight, Lock, Siren, ClipboardCheck,
} from "lucide-react";
import { format, differenceInMinutes } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { enqueueOutcome, flushQueue, readQueue, clearQueueFor } from "@/lib/emergencyQueue";
import {
  buildRollCall, sortPeople, attendanceKey, RollCallPerson,
  ASSISTANCE_ORDER, assistanceLabel, UNASSIGNED_AREA,
} from "@/lib/evacuation";

function formatDuration(start: Date): string {
  const mins = differenceInMinutes(new Date(), start);
  if (mins < 1) return "< 1m";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

type GroupBy = "area" | "assistance" | "type" | "status";

const ASSIST_STYLE: Record<string, string> = {
  "full-assist": "bg-destructive/10 text-destructive border-destructive/30",
  wheelchair: "bg-warning/10 text-warning border-warning/30",
  "walking-aid": "bg-primary/10 text-primary border-primary/30",
  independent: "bg-muted text-muted-foreground border-border",
  unknown: "bg-destructive/10 text-destructive border-destructive/30",
};

/** Who needs attention first: still missing, then needing help, then found. */
const STATUS_PRIORITY: Record<string, number> = {
  unaccounted: 0,
  assistance_required: 1,
  not_located: 2,
  safe_elsewhere: 3,
  evacuated_offsite: 4,
  safe: 5,
};

export default function Evacuation() {
  const { visitors } = useVisitors();
  const { residents } = useResidents();
  const { user } = useAuth();
  const { areaLabel, roomLabel, structure } = useSiteStructure();
  const isVillageView = structure === "rv" || structure === "mixed";
  const { currentSiteId, currentSite } = useSite();

  const { isUK } = useJurisdiction();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterArea, setFilterArea] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [groupBy, setGroupBy] = useState<GroupBy>("area");
  const [assemblyPoint, setAssemblyPoint] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [closing, setClosing] = useState(false);
  const [closeReason, setCloseReason] = useState("");
  const [confirmClose, setConfirmClose] = useState(false);
  const [eventClass, setEventClass] = useState<"drill" | "real">("real");
  const [startPrompt, setStartPrompt] = useState(false);
  const [reviewNotes, setReviewNotes] = useState("");
  const [correcting, setCorrecting] = useState<RollCallPerson | null>(null);
  const [correctionReason, setCorrectionReason] = useState("");
  const [offline, setOffline] = useState(!navigator.onLine);
  const [pending, setPending] = useState(readQueue().length);
  const [retrying, setRetrying] = useState(false);
  const [showOffSite, setShowOffSite] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const { data: activeDrills = [] } = useEvacuationDrills("active", currentSiteId);
  const activeDrill = activeDrills[0];
  const { data: attendance = [] } = useEvacuationAttendance(activeDrill?.id);
  const { data: points = [] } = useEvacuationPoints();
  const { startDrill, markSafe, markUnsafe, endDrill, addAttendee, setEmergencyState } = useEvacuationMutations();
  const { can } = usePermissions();

  const canActivate = can("emergency.activate");
  const canMark = can("emergency.mark_safe");
  const canExport = can("emergency.export");
  const isDrillEvent = activeDrill ? activeDrill.event_class === "drill" : eventClass === "drill";

  const markedBy = user?.email || "Staff";

  const { onSite, offSite } = useMemo(
    () => buildRollCall({ visitors, residents, roomLabel }),
    [visitors, residents, roomLabel]
  );




  const statusByKey = useMemo(() => {
    const map = new Map<string, { id: string; status: AttendanceStatus; at: string | null; point: string | null; seededAt: string | null }>();
    attendance.forEach((a) => {
      const key = attendanceKey(a as any);
      if (key) map.set(key, {
        id: a.id,
        status: (a.status as AttendanceStatus) || "unaccounted",
        at: a.marked_safe_at,
        point: a.evacuation_point_id,
        seededAt: (a as any).created_at || null,
      });
    });
    return map;
  }, [attendance]);

  // Any change to the shared roll call refreshes this, so staff can see the list is live.
  useEffect(() => { setLastUpdated(new Date()); }, [attendance]);

  useEffect(() => {
    const on = () => { setOffline(false); void retryPending(); };
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statusOf = (p: RollCallPerson): AttendanceStatus =>
    statusByKey.get(p.key)?.status || "unaccounted";

  /** Only "safe", "safe elsewhere" and "evacuated off-site" close a person off. */
  const accountedFor = (p: RollCallPerson) => ACCOUNTED_STATUSES.includes(statusOf(p));

  /** Someone who arrived after the snapshot was taken is shown separately. */
  const isLateArrival = (p: RollCallPerson) => {
    if (!activeDrill?.snapshot_at) return false;
    const snap = new Date(activeDrill.snapshot_at).getTime();
    const seeded = statusByKey.get(p.key)?.seededAt;
    if (seeded) return new Date(seeded).getTime() > snap + 60_000;
    return !!p.checkInTime && p.checkInTime.getTime() > snap;
  };

  const seedOf = (p: RollCallPerson): RollCallSeed => ({
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

  });

  const ensureDrill = async (): Promise<EvacuationDrill> => {
    if (activeDrill) return activeDrill;
    if (!canActivate) {
      throw new Error("You do not have permission to activate an emergency.");
    }
    return await startDrill.mutateAsync({
      title: `${eventClass === "drill" ? "Drill" : "Emergency"} ${format(new Date(), "dd MMM yyyy HH:mm")}`,
      people: onSite.map(seedOf),
      eventClass,
      eventType: eventClass === "drill" ? "drill" : "emergency",
      branchId: currentSiteId,
    });
  };

  /** Re-sends outcomes recorded while the connection was down. IDs and status only. */
  const retryPending = async () => {
    if (readQueue().length === 0) { setPending(0); return; }
    setRetrying(true);
    try {
      const { pending: left } = await flushQueue(activeDrill?.id);
      setPending(left);
      if (left === 0) toast({ title: "Roll call synced", description: "Outcomes recorded while offline have been saved." });
    } catch {
      setPending(readQueue().length);
    } finally {
      setRetrying(false);
    }
  };

  /** Records an outcome for a group of people, creating the event if needed. */
  const setStatusFor = async (people: RollCallPerson[], status: AttendanceStatus, reason?: string) => {
    if (people.length === 0) return;
    if (!canMark) {
      toast({ title: "Not allowed", description: "You do not have permission to record roll call outcomes.", variant: "destructive" });
      return;
    }
    if (!activeDrill) {
      // Never let a tap silently declare a live emergency — it must be chosen.
      setStartPrompt(true);
      return;
    }
    setBusy(true);
    try {
      const drill = await ensureDrill();
      const { data: rows } = await supabase
        .from("evacuation_attendance" as any)
        .select("id, visitor_id, parent_visitor_id, companion_index")
        .eq("drill_id", drill.id);
      const found = new Map(((rows || []) as any[]).map((r) => [attendanceKey(r), r.id as string]));

      for (const p of people) {
        const attId = found.get(p.key);
        try {
          if (attId) {
            if (status === "unaccounted") await markUnsafe.mutateAsync({ id: attId, reason });
            else await markSafe.mutateAsync({ id: attId, status, pointId: assemblyPoint || undefined, markedBy });
          } else {
            await addAttendee.mutateAsync({
              drillId: drill.id,
              person: seedOf(p),
              status,
              pointId: assemblyPoint || undefined,
              markedBy,
              branchId: currentSiteId,
            });
          }
        } catch (err: any) {
          // Only an existing line can be queued safely: identifiers and status, nothing personal.
          if (attId && !/closed/i.test(err?.message || "")) {
            enqueueOutcome({ attendanceId: attId, drillId: drill.id, status, markedAt: new Date().toISOString() });
            setPending(readQueue().length);
          } else {
            throw err;
          }
        }
      }
    } catch (e: any) {
      toast({ title: "Could not update roll call", description: e?.message || "Please try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };


  /** Undoing an outcome is a correction and always needs a reason. */
  const togglePerson = (p: RollCallPerson) => {
    if (accountedFor(p) || statusOf(p) !== "unaccounted") {
      setCorrecting(p);
      setCorrectionReason("");
      return;
    }
    void setStatusFor([p], "safe");
  };

  const confirmCorrection = async () => {
    if (!correcting) return;
    if (correctionReason.trim().length < 3) {
      toast({ title: "Reason required", description: "Record why this entry is being changed.", variant: "destructive" });
      return;
    }
    await setStatusFor([correcting], "unaccounted", correctionReason.trim());
    setCorrecting(null);
    setCorrectionReason("");
  };


  const allAreas = useMemo(() => {
    const set = new Set<string>();
    onSite.forEach((p) => { if (p.area) set.add(p.area); });
    return [...set].sort();
  }, [onSite]);

  const allTypes = useMemo(() => [...new Set(onSite.map((p) => p.type))].sort(), [onSite]);

  const filtered = useMemo(() => {
    let list = onSite;
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((p) =>
        p.name.toLowerCase().includes(q) ||
        p.room.toLowerCase().includes(q) ||
        p.area.toLowerCase().includes(q) ||
        p.host.toLowerCase().includes(q) ||
        p.phone.includes(q)
      );
    }
    if (filterType !== "all") list = list.filter((p) => p.type === filterType);
    if (filterArea !== "all") list = list.filter((p) => p.area === filterArea);
    if (filterStatus === "safe") list = list.filter((p) => accountedFor(p));
    else if (filterStatus === "unaccounted") list = list.filter((p) => !accountedFor(p));
    return list;
  }, [onSite, searchQuery, filterType, filterArea, filterStatus, statusByKey]);

  interface Group { label: string; sublabel?: string; people: RollCallPerson[] }

  /** Outstanding people rise to the top of every list; found people settle below. */
  const byPriority = (people: RollCallPerson[]) =>
    sortPeople(people)
      .slice()
      .sort((a, b) => (STATUS_PRIORITY[statusOf(a)] ?? 9) - (STATUS_PRIORITY[statusOf(b)] ?? 9));

  const groups = useMemo((): Group[] => {
    const map = new Map<string, RollCallPerson[]>();
    const push = (k: string, p: RollCallPerson) => {
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(p);
    };

    filtered.forEach((p) => {
      if (groupBy === "area") push(p.area || (p.type === "resident" ? UNASSIGNED_AREA : `${p.typeLabel}s`), p);
      else if (groupBy === "assistance") push(p.assistance.level, p);
      else if (groupBy === "type") push(`${p.typeLabel}s`, p);
      else push(!accountedFor(p) ? "Not accounted for" : "Accounted for", p);
    });

    let entries = [...map.entries()];
    if (groupBy === "assistance") {
      entries.sort(([a], [b]) => ASSISTANCE_ORDER.indexOf(a as any) - ASSISTANCE_ORDER.indexOf(b as any));
      return entries.map(([k, people]) => ({ label: assistanceLabel(k as any), people: byPriority(people) }));
    }
    if (groupBy === "status") {
      entries.sort(([a]) => (a === "Not accounted for" ? -1 : 1));
    } else {
      // Areas with people still to find come first.
      entries.sort(([a, pa], [b, pb]) => {
        const oa = pa.filter((p) => !accountedFor(p)).length;
        const ob = pb.filter((p) => !accountedFor(p)).length;
        if (!!oa !== !!ob) return oa ? -1 : 1;
        return a.localeCompare(b);
      });
    }
    return entries.map(([k, people]) => ({ label: k, people: byPriority(people) }));
  }, [filtered, groupBy, statusByKey]);

  const safeCount = onSite.filter((p) => accountedFor(p)).length;
  const unaccountedCount = onSite.length - safeCount;
  const offSiteCount = offSite.length;
  const assistanceCount = onSite.filter((p) => statusOf(p) === "assistance_required").length;
  const lateCount = onSite.filter(isLateArrival).length;


  const markGroupSafe = async (g: Group) => {
    const pending = g.people.filter((p) => !accountedFor(p));
    if (pending.length === 0) return;
    await setStatusFor(pending, "safe");
    toast({ title: `${g.label} accounted for`, description: `${pending.length} people marked safe.` });
  };

  const markAllSafe = async () => {
    const pending = onSite.filter((p) => !accountedFor(p));
    await setStatusFor(pending, "safe");
    toast({ title: "All marked safe", description: `${pending.length} people marked as safe.` });
  };

  const resetAll = async () => {
    await setStatusFor(onSite.filter((p) => accountedFor(p)), "unaccounted");
  };

  const jumpToNext = () => {
    const next = filtered.find((p) => !accountedFor(p));
    if (!next) return;
    document.getElementById(`person-${next.key}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const finishRollCall = async () => {
    if (!activeDrill) return;
    const isLive = activeDrill.event_class !== "drill";
    if (unaccountedCount > 0 && !closeReason.trim()) {
      toast({ title: "Reason required", description: "Record why people are still unaccounted for before closing.", variant: "destructive" });
      return;
    }
    if (isLive && !closeReason.trim()) {
      toast({ title: "Reason required", description: "Closing a live emergency needs a short account of the outcome.", variant: "destructive" });
      return;
    }
    if (isLive && !confirmClose) {
      toast({ title: "Confirmation required", description: "Tick the confirmation before closing a live emergency.", variant: "destructive" });
      return;
    }
    await setEmergencyState.mutateAsync({
      drillId: activeDrill.id,
      state: reviewNotes.trim() ? "reviewed" : "resolved",
      accounted: safeCount,
      reason: closeReason.trim() || undefined,
      reviewNotes: reviewNotes.trim() || undefined,
    });
    clearQueueFor(activeDrill.id);
    setPending(readQueue().length);
    setClosing(false);
    setCloseReason("");
    setConfirmClose(false);
    setReviewNotes("");
    toast({ title: isDrillEvent ? "Drill closed" : "Emergency closed", description: `${safeCount} of ${onSite.length} accounted for. This record can no longer be changed.` });
  };


  /** Pause holds the event open without losing the snapshot; resume continues it. */
  const togglePause = async () => {
    if (!activeDrill) return;
    await setEmergencyState.mutateAsync({
      drillId: activeDrill.id,
      state: activeDrill.state === "paused" ? "active" : "paused",
    });
  };


  const rows = () => filtered.map((p) => ({
    Name: p.name,
    Type: p.typeLabel,
    [areaLabel]: p.area,
    [roomLabel]: p.room,
    "Assistance needed": p.assistance.label,
    "Mobility aids": p.assistance.aids.join("; "),
    Flags: p.assistance.flags.join("; "),
    Phone: p.phone,
    "Emergency contact": p.emergencyContactName,
    "Emergency phone": p.emergencyContactPhone,
    Visiting: p.host,
    "With right now": p.associatedWith.join("; "),
    "Responsible staff": p.responsibleStaff,

    "On site since": p.checkInTime ? format(p.checkInTime, "dd/MM/yyyy HH:mm") : "",
    Status: ATTENDANCE_LABELS[statusOf(p)],
    "Marked at": statusByKey.get(p.key)?.at ? format(new Date(statusByKey.get(p.key)!.at!), "HH:mm") : "",
  }));

  const exportCSV = () => {
    if (!can("emergency.export")) {
      toast({ title: "Not allowed", description: "You do not have permission to export the emergency snapshot.", variant: "destructive" });
      return;
    }
    const data = rows();
    if (data.length === 0) return;
    const headers = Object.keys(data[0]);
    const csv = [
      headers.join(","),
      ...data.map((r) => headers.map((h) => `"${String((r as any)[h] ?? "").replace(/"/g, '""')}"`).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `roll-call-${format(new Date(), "yyyy-MM-dd-HHmm")}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "CSV exported", description: `${data.length} people exported.` });
  };

  const printList = () => {
    if (!can("emergency.export")) {
      toast({ title: "Not allowed", description: "You do not have permission to export the emergency snapshot.", variant: "destructive" });
      return;
    }
    const date = format(new Date(), "dd MMMM yyyy, HH:mm");
    const body = groups.map((g) => {
      const wardens = [...new Set(g.people.map((p) => p.responsibleStaff).filter(Boolean))];
      return `
      <tr class="grp"><td colspan="8">${g.label} — ${g.people.length} people${wardens.length ? ` · responsible: ${wardens.join(", ")}` : ""}</td></tr>
      ${g.people.map((p) => {
        const s = statusOf(p);
        return `<tr class="${s === "unaccounted" ? "danger" : "safe"}">
        <td>${s === "unaccounted" ? "☐" : "☑"}</td>
        <td><strong>${p.name}</strong>${p.room ? `<br><small>${p.room}</small>` : ""}</td>
        <td>${p.typeLabel}</td>
        <td>${p.assistance.label}${p.assistance.aids.length ? `<br><small>${p.assistance.aids.join(", ")}</small>` : ""}${p.assistance.flags.length ? `<br><small>${p.assistance.flags.join(", ")}</small>` : ""}</td>
        <td>${p.phone || "—"}</td>
        <td>${p.emergencyContactName ? `${p.emergencyContactName}<br>${p.emergencyContactPhone || ""}` : "—"}</td>
        <td>${p.associatedWith.length ? p.associatedWith.join("<br>") : "—"}</td>
        <td>${ATTENDANCE_LABELS[s]}</td>
      </tr>`;
      }).join("")}
    `;
    }).join("");


    const offSiteRows = offSite.map((p) => `<tr>
      <td>☑</td><td><strong>${p.name}</strong>${p.room ? `<br><small>${p.room}</small>` : ""}</td>
      <td>Off site</td><td>${p.assistance.label}</td><td>${p.phone || "—"}</td>
      <td>${p.emergencyContactName ? `${p.emergencyContactName}<br>${p.emergencyContactPhone || ""}` : "—"}</td>
      <td>${p.expectedReturn ? `Back ${format(p.expectedReturn, "dd MMM HH:mm")}` : "Away"}</td>
    </tr>`).join("");

    const footer = isUK
      ? "Retain as evidence for the Regulatory Reform (Fire Safety) Order 2005 and CQC Regulation 12 (safe care and treatment)."
      : "Retain as evidence for the Aged Care Quality Standards — emergency and disaster management.";

    const html = `<!DOCTYPE html><html><head><title>Roll Call</title><style>
      @page{size:A4 portrait;margin:12mm}
      body{font-family:Arial,sans-serif;margin:0;color:#111}
      h1{color:#dc2626;font-size:20px;margin:0 0 2px}
      .sub{color:#6b7280;font-size:12px;margin-bottom:14px}
      .kind{display:inline-block;border:2px solid #111;padding:2px 8px;font-weight:bold;font-size:12px;margin-bottom:8px}
      .summary{display:flex;gap:20px;margin-bottom:12px;font-size:13px}
      table{width:100%;border-collapse:collapse;font-size:11px}
      th,td{padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:left;vertical-align:top}
      th{background:#fef2f2;color:#dc2626}
      tr{page-break-inside:avoid}
      thead{display:table-header-group}
      tr.grp td{background:#f3f4f6;font-weight:bold}
      tr.safe td{background:#f0fdf4} tr.danger td{background:#fff}
      h2{font-size:14px;margin:20px 0 6px}
      .footer{margin-top:20px;font-size:10px;color:#6b7280;border-top:1px solid #e5e7eb;padding-top:10px}
    </style></head><body>
      <h1>Emergency Roll Call</h1>
      <div class="kind">${isDrillEvent ? "PRACTICE DRILL — NOT A REAL EMERGENCY" : "LIVE EMERGENCY"}</div>
      <div class="sub">${currentSite?.name ? `${currentSite.name} · ` : ""}${date}</div>
      <div class="summary">
        <span><strong>On site:</strong> ${onSite.length}</span>
        <span><strong>Accounted for:</strong> ${safeCount}</span>
        <span><strong>Not accounted for:</strong> ${unaccountedCount}</span>
        <span><strong>Off site:</strong> ${offSiteCount}</span>
      </div>

      <table><thead><tr><th></th><th>Name</th><th>Type</th><th>Assistance</th><th>Phone</th><th>Emergency contact</th><th>With / visiting</th><th>Status</th></tr></thead>
      <tbody>${body}</tbody></table>
      ${offSiteCount ? `<h2>Off site — accounted for elsewhere</h2><table><tbody>${offSiteRows}</tbody></table>` : ""}
      <div class="footer">Generated by Centrim Life • ${date} • CONFIDENTIAL<br>${footer}</div>
    </body></html>`;

    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 300); }
  };

  /** Everyone sharing one property sits together — a couple in one villa is two lines, one heading. */
  const unitBlocks = (people: RollCallPerson[]) => {
    const map = new Map<string, RollCallPerson[]>();
    people.forEach((p) => {
      const k = p.unit || "";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(p);
    });
    return [...map.entries()]
      .sort(([a], [b]) => (parseInt(a) || 0) - (parseInt(b) || 0) || a.localeCompare(b))
      .map(([unit, list]) => ({ unit, people: list }));
  };

  const renderPerson = (p: RollCallPerson) => {

    const status = statusOf(p);
    const isSafe = ACCOUNTED_STATUSES.includes(status);
    const marked = statusByKey.get(p.key);
    return (
      <div
        key={p.key}
        id={`person-${p.key}`}
        role="button"
        tabIndex={0}
        onClick={() => togglePerson(p)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); togglePerson(p); } }}
        className={`w-full text-left rounded-xl border p-3 sm:p-4 transition-colors active:scale-[0.995] cursor-pointer ${
          isSafe ? "border-success/40 bg-success/5" : "border-border bg-card hover:bg-muted/40"
        }`}
      >
        <div className="flex items-start gap-3">
          <div className={`h-9 w-9 shrink-0 rounded-full flex items-center justify-center ${isSafe ? "bg-success text-success-foreground" : "bg-destructive/10 text-destructive"}`}>
            {status === "evacuated_offsite" ? <Ambulance className="h-4 w-4" /> : isSafe ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <p className="text-[15px] font-semibold text-foreground">{p.name}</p>
              <Badge variant="outline" className="text-[10px] capitalize">{p.typeLabel}</Badge>
              {p.type === "resident" && (
                <span className={`text-[10px] rounded-md border px-1.5 py-0.5 font-medium ${ASSIST_STYLE[p.assistance.level]}`}>
                  <Accessibility className="h-3 w-3 inline mr-0.5" />{p.assistance.label}
                </span>
              )}
              {p.assistance.flags.map((f) => (
                <span key={f} className="text-[10px] rounded-md border border-warning/30 bg-warning/10 text-warning px-1.5 py-0.5 font-medium">{f}</span>
              ))}
              {isLateArrival(p) && (
                <span className="text-[10px] rounded-md border border-primary/30 bg-primary/10 text-primary px-1.5 py-0.5 font-medium">Arrived after roll call started</span>
              )}

            </div>

            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
              {p.room && <span className="flex items-center gap-1"><Home className="h-3 w-3" />{p.room}</span>}
              {p.area && <span className="flex items-center gap-1 text-primary font-medium"><MapPin className="h-3 w-3" />{p.area}</span>}
              {p.assistance.aids.length > 0 && <span>{p.assistance.aids.join(", ")}</span>}
              {p.associatedWith.length > 0 ? (
                <span>{p.associatedWith.join(" · ")}</span>
              ) : (
                p.host && <span>Visiting {p.host}</span>
              )}
              {p.responsibleStaff && <span>Warden: {p.responsibleStaff}</span>}

              {p.workLocation && <span>Working at {p.workLocation}</span>}
              {p.checkInTime && p.type !== "resident" && (
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{format(p.checkInTime, "HH:mm")} · {formatDuration(p.checkInTime)}</span>
              )}
            </div>

            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
              {p.phone && (
                <a href={`tel:${p.phone}`} onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 font-medium text-primary underline-offset-2 hover:underline">
                  <Phone className="h-3 w-3" />{p.phone}
                </a>
              )}
              {p.emergencyContactPhone && (
                <a href={`tel:${p.emergencyContactPhone}`} onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 text-muted-foreground underline-offset-2 hover:underline">
                  <Phone className="h-3 w-3" />
                  {p.emergencyContactName || "Emergency contact"}: {p.emergencyContactPhone}
                </a>
              )}
              {!p.phone && !p.emergencyContactPhone && (
                <span className="text-[12px] text-muted-foreground">No contact number recorded</span>
              )}
            </div>

            {isSafe && marked?.at && (
              <p className="mt-1 text-[11px] text-success">
                {ATTENDANCE_LABELS[status]} at {format(new Date(marked.at), "HH:mm")}
                {points.find((pt) => pt.id === marked.point) ? ` · ${points.find((pt) => pt.id === marked.point)!.name}` : ""}
              </p>
            )}
          </div>

          <div className="flex shrink-0 flex-col gap-1.5" onClick={(e) => e.stopPropagation()}>
            <Button
              size="sm"
              disabled={busy}
              variant={isSafe ? "outline" : "default"}
              className={`h-9 min-w-[110px] text-xs ${!isSafe ? "bg-emerald-600 hover:bg-emerald-700 text-emerald-50" : ""}`}
              onClick={() => togglePerson(p)}
            >
              {isSafe ? "Correct" : "Safe"}
            </Button>
            {!isSafe && (
              <>
                <Button size="sm" variant="outline" disabled={busy} className="h-8 min-w-[110px] text-[11px] gap-1"
                  onClick={() => setStatusFor([p], "safe_elsewhere")}>
                  <MapPin className="h-3 w-3" /> Safe elsewhere
                </Button>
                <Button size="sm" variant="outline" disabled={busy} className="h-8 min-w-[110px] text-[11px]"
                  onClick={() => setStatusFor([p], "not_located")}>
                  Not located
                </Button>
                <Button size="sm" variant="outline" disabled={busy} className="h-8 min-w-[110px] text-[11px]"
                  onClick={() => setStatusFor([p], "assistance_required")}>
                  Needs help
                </Button>
                <Button size="sm" variant="outline" disabled={busy} className="h-8 min-w-[110px] text-[11px] gap-1"
                  onClick={() => setStatusFor([p], "evacuated_offsite")}>
                  <Ambulance className="h-3 w-3" /> Off-site
                </Button>
              </>
            )}
          </div>

        </div>
      </div>
    );
  };

  const headerActions = (
  <div className="flex flex-wrap items-center gap-2">
                  {!activeDrill && canActivate && (
                    <Select value={eventClass} onValueChange={(v) => setEventClass(v as "drill" | "real")}>
                      <SelectTrigger className="h-9 w-[150px] text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="real">Real emergency</SelectItem>
                        <SelectItem value="drill">Practice drill</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                  {!activeDrill && canActivate && (
                    <Button size="sm" disabled={busy} onClick={() => setStartPrompt(true)} className="h-9 gap-1.5 bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      <Siren className="h-3.5 w-3.5" /> Start {eventClass === "drill" ? "drill" : "emergency"}
                    </Button>
                  )}
                  {activeDrill && canActivate && (
                    <Button variant="outline" size="sm" disabled={busy} onClick={togglePause} className="h-9 text-xs">
                      {activeDrill.state === "paused" ? "Resume" : "Pause"}
                    </Button>
                  )}
                  {points.length > 0 && (
                    <Select value={assemblyPoint || "none"} onValueChange={(v) => setAssemblyPoint(v === "none" ? "" : v)}>
                      <SelectTrigger className="h-9 w-[190px] text-xs">
                        <SelectValue placeholder="Assembly point" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No assembly point</SelectItem>
                        {points.map((pt) => <SelectItem key={pt.id} value={pt.id}>{pt.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                  {canExport && <Button variant="outline" size="sm" onClick={exportCSV} className="h-9 gap-1.5"><Download className="h-3.5 w-3.5" /> CSV</Button>}
                  {canExport && <Button variant="outline" size="sm" onClick={printList} className="h-9 gap-1.5"><Printer className="h-3.5 w-3.5" /> Print sheet</Button>}
                  {canMark && unaccountedCount > 0 && onSite.length > 0 && (
                    <Button size="sm" disabled={busy} onClick={markAllSafe} className="h-9 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-emerald-50">
                      <CheckCircle2 className="h-3.5 w-3.5" /> All safe
                    </Button>
                  )}
                  {canMark && safeCount > 0 && <Button variant="ghost" size="sm" disabled={busy} onClick={resetAll} className="h-9 text-xs">Reset</Button>}
                  {activeDrill && canActivate && (
                    <Button variant="outline" size="sm" disabled={busy} onClick={() => setClosing(true)} className="h-9 gap-1.5 text-xs"><ClipboardCheck className="h-3.5 w-3.5" /> End roll call</Button>
                  )}
                </div>
  );

  return (
    <AppShell
      title="Emergency Roll Call"
      subtitle="Every person on the property, and who needs help to get out"
      titleIcon={Shield}
      titleIconClassName="h-5 w-5 shrink-0 text-destructive"
      actions={headerActions}
      mainClassName="p-4 sm:p-6 space-y-5 pb-28 lg:pb-6"
    >

            {!canMark && (
              <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-2.5 text-sm text-foreground flex items-start gap-2">
                <Lock className="h-4 w-4 mt-0.5 shrink-0" />
                <span>You can view the roll call, but recording outcomes, corrections, closing and exporting need emergency permissions. Ask a manager to grant them.</span>
              </div>
            )}

            {(offline || pending > 0) && (
              <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-2.5 text-sm text-foreground flex flex-wrap items-center gap-2">
                <WifiOff className="h-4 w-4 shrink-0" />
                <span>
                  {offline ? "No connection. " : ""}
                  {pending > 0 ? `${pending} outcome${pending === 1 ? "" : "s"} waiting to save (person reference and status only).` : "Outcomes will be saved when the connection returns."}
                </span>
                {pending > 0 && (
                  <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" disabled={retrying} onClick={retryPending}>
                    <RefreshCw className={`h-3.5 w-3.5 ${retrying ? "animate-spin" : ""}`} /> {retrying ? "Retrying" : "Retry now"}
                  </Button>
                )}
              </div>
            )}

            <div className={`rounded-xl border px-4 py-2.5 text-sm flex flex-wrap items-center gap-2 ${activeDrill && !isDrillEvent ? "border-destructive/30 bg-destructive/5 text-destructive" : activeDrill ? "border-primary/30 bg-primary/5 text-primary" : "border-border bg-muted/40 text-muted-foreground"}`}>
              <Shield className="h-4 w-4 shrink-0" />
              {activeDrill ? (
                <span>
                  <strong>{isDrillEvent ? "Practice drill" : "Live emergency"}</strong>
                  {activeDrill.state === "paused" ? " (paused)" : ""} running since {format(new Date(activeDrill.started_at), "HH:mm")}
                  {currentSite?.name ? ` at ${currentSite.name}` : ""} — shared live with every device.
                </span>
              ) : (
                <span>No roll call running. Starting one takes a snapshot of everyone on site right now.</span>
              )}
              <span className="ml-auto text-xs opacity-80">Updated {format(lastUpdated, "HH:mm:ss")}</span>
            </div>


            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-xl border border-border bg-card p-4 text-center">
                <p className="text-2xl font-bold text-foreground">{onSite.length}</p>
                <p className="text-xs text-muted-foreground">People on site</p>
              </div>
              <button onClick={() => setFilterStatus(filterStatus === "safe" ? "all" : "safe")} className="rounded-xl border border-success/30 bg-success/5 p-4 text-center">
                <p className="text-2xl font-bold text-success">{safeCount}</p>
                <p className="text-xs text-muted-foreground">Accounted for</p>
              </button>
              <button onClick={() => setFilterStatus(filterStatus === "unaccounted" ? "all" : "unaccounted")} className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-center">
                <p className="text-2xl font-bold text-destructive">{unaccountedCount}</p>
                <p className="text-xs text-muted-foreground">Not accounted for</p>
              </button>
              <div className="rounded-xl border border-border bg-card p-4 text-center">
                <p className="text-2xl font-bold text-foreground">{offSiteCount}</p>
                <p className="text-xs text-muted-foreground">Off site (on leave)</p>
              </div>
            </div>

            {(assistanceCount > 0 || lateCount > 0) && (
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                {assistanceCount > 0 && (
                  <span className="flex items-center gap-1 rounded-lg border border-warning/30 bg-warning/10 px-2.5 py-1 text-foreground">
                    <Accessibility className="h-3.5 w-3.5" /> {assistanceCount} needing help to get out
                  </span>
                )}
                {lateCount > 0 && (
                  <span className="flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-foreground">
                    <Clock className="h-3.5 w-3.5" /> {lateCount} arrived after the roll call started
                  </span>
                )}
              </div>
            )}


            <div className="flex flex-wrap gap-2">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={`Search name, ${roomLabel.toLowerCase()}, phone…`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-10"
                />
              </div>
              <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
                <SelectTrigger className="h-10 w-[170px] text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="area">Group by {areaLabel.toLowerCase()}</SelectItem>
                  <SelectItem value="assistance">Group by assistance</SelectItem>
                  <SelectItem value="type">Group by person type</SelectItem>
                  <SelectItem value="status">Group by status</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterArea} onValueChange={setFilterArea}>
                <SelectTrigger className="h-10 w-[150px] text-sm"><SelectValue placeholder={areaLabel} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All {areaLabel.toLowerCase()}s</SelectItem>
                  {allAreas.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="h-10 w-[150px] text-sm"><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Everyone</SelectItem>
                  {allTypes.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {groups.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border py-16 text-center">
                <Users className="mx-auto h-10 w-10 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Nobody matches this view.</p>
              </div>
            ) : (
              groups.map((g) => {
                const pending = g.people.filter((p) => !accountedFor(p)).length;
                const done = g.people.length - pending;
                const wardens = [...new Set(g.people.map((p) => p.responsibleStaff).filter(Boolean))];
                return (
                  <section key={g.label} className="space-y-2">
                    <div className="sticky top-[68px] z-10 flex items-center justify-between gap-3 rounded-lg border border-border bg-card/95 px-3 py-2 backdrop-blur-sm">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-sm font-semibold text-foreground">{g.label}</h2>
                          <span className={`text-xs font-medium ${pending === 0 ? "text-success" : "text-muted-foreground"}`}>
                            {done} of {g.people.length} accounted for
                          </span>
                        </div>
                        {wardens.length > 0 && (
                          <p className="mt-0.5 text-[11px] text-muted-foreground">Responsible: {wardens.join(", ")}</p>
                        )}
                      </div>
                      {pending > 0 && (
                        <Button size="sm" disabled={busy} onClick={() => markGroupSafe(g)} className="h-8 shrink-0 text-xs bg-emerald-600 hover:bg-emerald-700 text-emerald-50">
                          All {g.label.toLowerCase()} safe
                        </Button>
                      )}
                    </div>
                    {isVillageView && groupBy === "area" ? (
                      <div className="space-y-3">
                        {unitBlocks(g.people).map((b) => (
                          <div key={b.unit || "none"} className="space-y-2">
                            {b.unit && (
                              <div className="flex flex-wrap items-center gap-2 px-1">
                                <span className="text-[12px] font-semibold text-foreground">{roomLabel} {b.unit}</span>
                                <span className="text-[11px] text-muted-foreground">
                                  {b.people.length} {b.people.length === 1 ? "person" : "people"}
                                </span>
                                {b.people.every((p) => accountedFor(p)) ? (
                                  <span className="text-[11px] font-medium text-success">all accounted for</span>
                                ) : (
                                  <span className="text-[11px] font-medium text-destructive">
                                    {b.people.filter((p) => !accountedFor(p)).length} still to find
                                  </span>
                                )}
                              </div>
                            )}
                            <div className="space-y-2">{b.people.map(renderPerson)}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-2">{g.people.map(renderPerson)}</div>
                    )}
                  </section>

                );
              })
            )}

            {offSite.length > 0 && (
              <section className="space-y-2">
                <button
                  type="button"
                  onClick={() => setShowOffSite((v) => !v)}
                  className="w-full flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-left"
                >
                  {showOffSite ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  <PlaneTakeoff className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold text-foreground">Off site — accounted for elsewhere</h2>
                  <span className="ml-auto text-xs font-semibold text-muted-foreground">{offSite.length}</span>
                </button>
                {showOffSite && (
                <div className="space-y-2">
                  {sortPeople(offSite).map((p) => (
                    <div key={p.key} className="rounded-xl border border-border bg-muted/20 p-3">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <p className="text-sm font-semibold text-foreground">{p.name}</p>
                        {p.room && <span className="text-[12px] text-muted-foreground">{p.room}</span>}
                        {p.area && <span className="text-[12px] text-primary">{p.area}</span>}
                        <span className="text-[12px] text-muted-foreground">
                          {p.accompaniedBy ? `With ${p.accompaniedBy}` : "Off site"}
                          {p.expectedReturn ? ` · back ${format(p.expectedReturn, "dd MMM HH:mm")}` : ""}
                        </span>
                        {p.emergencyContactPhone && (
                          <a href={`tel:${p.emergencyContactPhone}`} className="text-[12px] text-primary flex items-center gap-1">
                            <Phone className="h-3 w-3" />{p.emergencyContactName || "Contact"}: {p.emergencyContactPhone}
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                )}
              </section>
            )}


          {/* Mobile action bar */}
          {onSite.length > 0 && (
            <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-card/95 px-4 py-3 backdrop-blur-sm lg:hidden">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className={`text-lg font-bold ${unaccountedCount ? "text-destructive" : "text-success"}`}>
                    {unaccountedCount ? `${unaccountedCount} not accounted for` : "Everyone accounted for"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{safeCount} of {onSite.length} safe</p>
                </div>
                {unaccountedCount > 0 ? (
                  <Button onClick={jumpToNext} className="h-11 gap-1.5"><ArrowDown className="h-4 w-4" /> Next person</Button>
                ) : (
                  activeDrill && <Button onClick={() => setClosing(true)} className="h-11">End roll call</Button>
                )}
              </div>
            </div>
          )}

          <Dialog open={closing} onOpenChange={setClosing}>
            <DialogContent className="rounded-xl">
              <DialogHeader>
                <DialogTitle>End roll call</DialogTitle>
                <DialogDescription>
                  {safeCount} of {onSite.length} people accounted for
                  {unaccountedCount > 0 ? `, ${unaccountedCount} still missing.` : "."}
                </DialogDescription>
              </DialogHeader>
              {(unaccountedCount > 0 || !isDrillEvent) && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">
                    {unaccountedCount > 0 ? "Why are these people unaccounted for?" : "What was the outcome of this emergency?"}
                  </p>
                  <Textarea
                    value={closeReason}
                    onChange={(e) => setCloseReason(e.target.value)}
                    placeholder="e.g. Mr Patel was taken to hospital by ambulance; two visitors left before the alarm."
                    rows={4}
                  />
                  <p className="text-[12px] text-muted-foreground">Required — this appears on the evacuation report.</p>
                </div>
              )}
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Review notes (optional)</p>
                <Textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="What went well, what needs to change, actions agreed."
                  rows={3}
                />
                <p className="text-[12px] text-muted-foreground">Adding notes marks this event as reviewed.</p>
              </div>
              {!isDrillEvent && (
                <label className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">
                  <input type="checkbox" className="mt-0.5 h-4 w-4" checked={confirmClose} onChange={(e) => setConfirmClose(e.target.checked)} />
                  <span>I confirm this live emergency is over and the record can be closed. Once closed it cannot be changed.</span>
                </label>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setClosing(false)}>Keep going</Button>
                <Button onClick={finishRollCall} disabled={busy}>End roll call</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={startPrompt} onOpenChange={setStartPrompt}>
            <DialogContent className="rounded-xl">
              <DialogHeader>
                <DialogTitle>Start {eventClass === "drill" ? "a practice drill" : "a live emergency"}</DialogTitle>
                <DialogDescription>
                  This takes a snapshot of the {onSite.length} people on site{currentSite?.name ? ` at ${currentSite.name}` : ""} and shares the roll call with every device.
                  {eventClass === "drill" ? " It is clearly marked as a drill." : " Only do this for a real emergency."}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setStartPrompt(false)}>Cancel</Button>
                <Button
                  className={eventClass === "drill" ? "" : "bg-destructive text-destructive-foreground hover:bg-destructive/90"}
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await ensureDrill();
                      setStartPrompt(false);
                      toast({ title: eventClass === "drill" ? "Drill started" : "Emergency started", description: `${onSite.length} people in the roll call.` });
                    } catch (e: any) {
                      toast({ title: "Could not start", description: e?.message || "Please try again.", variant: "destructive" });
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Start now
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>


          <Dialog open={!!correcting} onOpenChange={(o) => !o && setCorrecting(null)}>
            <DialogContent className="rounded-xl">
              <DialogHeader>
                <DialogTitle>Correct this entry</DialogTitle>
                <DialogDescription>
                  {correcting?.name} is currently recorded as {ATTENDANCE_LABELS[correcting ? statusOf(correcting) : "unaccounted"]}.
                  Corrections are kept in the audit trail.
                </DialogDescription>
              </DialogHeader>
              <Textarea
                value={correctionReason}
                onChange={(e) => setCorrectionReason(e.target.value)}
                placeholder="e.g. Marked safe by mistake — wrong person tapped."
                rows={3}
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => setCorrecting(null)}>Cancel</Button>
                <Button onClick={confirmCorrection} disabled={busy}>Record correction</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

    </AppShell>
  );
}
