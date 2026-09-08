import { useState, useMemo } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
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
import { supabase } from "@/integrations/supabase/client";
import {
  AlertTriangle, CheckCircle2, Search, Shield, Clock, Users, Download, Printer,
  Home, MapPin, Phone, Accessibility, ArrowDown, PlaneTakeoff, Ambulance,
} from "lucide-react";
import { format, differenceInMinutes } from "date-fns";
import { useToast } from "@/hooks/use-toast";
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

export default function Evacuation() {
  const { visitors } = useVisitors();
  const { residents } = useResidents();
  const { user } = useAuth();
  const { areaLabel, roomLabel, structure } = useSiteStructure();
  const isVillageView = structure === "rv" || structure === "mixed";

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
  const [eventClass, setEventClass] = useState<"drill" | "real">("real");
  const [reviewNotes, setReviewNotes] = useState("");
  const [correcting, setCorrecting] = useState<RollCallPerson | null>(null);
  const [correctionReason, setCorrectionReason] = useState("");

  const { data: activeDrills = [] } = useEvacuationDrills("active");
  const activeDrill = activeDrills[0];
  const { data: attendance = [] } = useEvacuationAttendance(activeDrill?.id);
  const { data: points = [] } = useEvacuationPoints();
  const { startDrill, markSafe, markUnsafe, endDrill, addAttendee, setEmergencyState } = useEvacuationMutations();
  const { can } = usePermissions();

  const markedBy = user?.email || "Staff";

  const { onSite, offSite } = useMemo(
    () => buildRollCall({ visitors, residents, roomLabel }),
    [visitors, residents, roomLabel]
  );


  const statusByKey = useMemo(() => {
    const map = new Map<string, { id: string; status: AttendanceStatus; at: string | null; point: string | null }>();
    attendance.forEach((a) => {
      const key = attendanceKey(a as any);
      if (key) map.set(key, {
        id: a.id,
        status: (a.status as AttendanceStatus) || "unaccounted",
        at: a.marked_safe_at,
        point: a.evacuation_point_id,
      });
    });
    return map;
  }, [attendance]);

  const statusOf = (p: RollCallPerson): AttendanceStatus =>
    statusByKey.get(p.key)?.status || "unaccounted";

  /** Only "safe", "safe elsewhere" and "evacuated off-site" close a person off. */
  const accountedFor = (p: RollCallPerson) => ACCOUNTED_STATUSES.includes(statusOf(p));

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
    if (!can("emergency.activate")) {
      throw new Error("You do not have permission to activate an emergency.");
    }
    return await startDrill.mutateAsync({
      title: `${eventClass === "drill" ? "Drill" : "Emergency"} ${format(new Date(), "dd MMM yyyy HH:mm")}`,
      people: onSite.map(seedOf),
      eventClass,
      eventType: eventClass === "drill" ? "drill" : "emergency",
    });
  };

  /** Records an outcome for a group of people, creating the event if needed. */
  const setStatusFor = async (people: RollCallPerson[], status: AttendanceStatus, reason?: string) => {
    if (people.length === 0) return;
    if (!can("emergency.mark_safe")) {
      toast({ title: "Not allowed", description: "You do not have permission to record roll call outcomes.", variant: "destructive" });
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
          });
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
      return entries.map(([k, people]) => ({ label: assistanceLabel(k as any), people: sortPeople(people) }));
    }
    if (groupBy === "status") {
      entries.sort(([a]) => (a === "Not accounted for" ? -1 : 1));
    } else {
      entries.sort(([a], [b]) => a.localeCompare(b));
    }
    return entries.map(([k, people]) => ({ label: k, people: sortPeople(people) }));
  }, [filtered, groupBy, statusByKey]);

  const safeCount = onSite.filter((p) => accountedFor(p)).length;
  const unaccountedCount = onSite.length - safeCount;
  const offSiteCount = offSite.length;

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
    if (unaccountedCount > 0 && !closeReason.trim()) {
      toast({ title: "Reason required", description: "Record why people are still unaccounted for before closing.", variant: "destructive" });
      return;
    }
    await setEmergencyState.mutateAsync({
      drillId: activeDrill.id,
      state: reviewNotes.trim() ? "reviewed" : "resolved",
      accounted: safeCount,
      reason: closeReason.trim() || undefined,
      reviewNotes: reviewNotes.trim() || undefined,
    });
    setClosing(false);
    setCloseReason("");
    setReviewNotes("");
    toast({ title: "Emergency closed", description: `${safeCount} of ${onSite.length} accounted for.` });
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
      body{font-family:Arial,sans-serif;margin:24px;color:#111}
      h1{color:#dc2626;font-size:20px;margin:0 0 2px}
      .sub{color:#6b7280;font-size:12px;margin-bottom:14px}
      .summary{display:flex;gap:20px;margin-bottom:12px;font-size:13px}
      table{width:100%;border-collapse:collapse;font-size:11px}
      th,td{padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:left;vertical-align:top}
      th{background:#fef2f2;color:#dc2626}
      tr.grp td{background:#f3f4f6;font-weight:bold}
      tr.safe td{background:#f0fdf4} tr.danger td{background:#fff}
      h2{font-size:14px;margin:20px 0 6px}
      .footer{margin-top:20px;font-size:10px;color:#6b7280;border-top:1px solid #e5e7eb;padding-top:10px}
    </style></head><body>
      <h1>Emergency Roll Call</h1>
      <div class="sub">${date}</div>
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

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex-1">
          <header className="sticky top-0 z-20 border-b border-border bg-card/90 backdrop-blur-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-6">
              <div className="flex items-center gap-3">
                <SidebarTrigger />
                <div>
                  <h1 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <Shield className="h-5 w-5 text-destructive" />
                    Emergency Roll Call
                  </h1>
                  <p className="text-xs text-muted-foreground">Every person on the property, and who needs help to get out</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {!activeDrill && (
                  <Select value={eventClass} onValueChange={(v) => setEventClass(v as "drill" | "real")}>
                    <SelectTrigger className="h-9 w-[150px] text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="real">Real emergency</SelectItem>
                      <SelectItem value="drill">Practice drill</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                {activeDrill && (
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
                <Button variant="outline" size="sm" onClick={exportCSV} className="h-9 gap-1.5"><Download className="h-3.5 w-3.5" /> CSV</Button>
                <Button variant="outline" size="sm" onClick={printList} className="h-9 gap-1.5"><Printer className="h-3.5 w-3.5" /> Print sheet</Button>
                {unaccountedCount > 0 && onSite.length > 0 && (
                  <Button size="sm" disabled={busy} onClick={markAllSafe} className="h-9 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-emerald-50">
                    <CheckCircle2 className="h-3.5 w-3.5" /> All safe
                  </Button>
                )}
                {safeCount > 0 && <Button variant="ghost" size="sm" disabled={busy} onClick={resetAll} className="h-9 text-xs">Reset</Button>}
                {activeDrill && (
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => setClosing(true)} className="h-9 text-xs">End roll call</Button>
                )}
              </div>
            </div>
          </header>

          <main className="p-4 sm:p-6 space-y-5 pb-28 lg:pb-6">
            <div className={`rounded-xl border px-4 py-2.5 text-sm flex items-center gap-2 ${activeDrill ? "border-destructive/30 bg-destructive/5 text-destructive" : "border-border bg-muted/40 text-muted-foreground"}`}>
              <Shield className="h-4 w-4 shrink-0" />
              {activeDrill ? (
                <span>Roll call running since {format(new Date(activeDrill.started_at), "HH:mm")} — shared live with every device.</span>
              ) : (
                <span>No roll call running. Marking the first person starts one and shares it live with every device.</span>
              )}
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
                <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
                  <PlaneTakeoff className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold text-foreground">Off site — accounted for elsewhere</h2>
                  <span className="text-xs text-muted-foreground">{offSite.length} residents</span>
                </div>
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
              </section>
            )}
          </main>

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
              {unaccountedCount > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Why are these people unaccounted for?</p>
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
              <DialogFooter>
                <Button variant="outline" onClick={() => setClosing(false)}>Keep going</Button>
                <Button onClick={finishRollCall} disabled={busy}>End roll call</Button>
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

        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
