import { escapeHtml } from "@/lib/emergencyPrint";
import { emergencyPolicy, emergencyCounts, emergencyRegulatoryNote, outcomeExport, EmergencyEvidence } from "@/lib/emergencyPolicy";
import { usePermissions } from "@/hooks/usePermissions";
import { useOperatingContext } from "@/contexts/OperatingContext";
import { useState, useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useJurisdiction } from "@/hooks/useJurisdiction";
import { useSiteStructure } from "@/hooks/useSiteStructure";
import { useSite } from "@/contexts/SiteContext";
import { format, differenceInMinutes } from "date-fns";
import { Shield, Download, Printer, CheckCircle2, AlertTriangle, ChevronDown, Clock, Phone, Ambulance } from "lucide-react";

interface DrillRecord {
  id: string;
  title: string;
  started_at: string;
  ended_at: string | null;
  total_people: number;
  accounted_for: number;
  status: string;
  started_by: string;
  notes: string | null;
  unaccounted_reason: string | null;
  event_type: string | null;
  event_class: string | null;
  state: string;
}

interface AttendanceRecord extends EmergencyEvidence {
  id: string;
  drill_id: string;
  person_name: string;
  person_type: string;
  status: string;
  marked_safe_at: string | null;
  marked_by: string | null;
  assistance_level: string | null;
  contact_phone: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  area_label: string | null;
  room_label: string | null;
  responsible_staff: string | null;
  associated_with: string | null;
}


export default function EvacuationReport() {
  const { can } = usePermissions();
  const { ukNation } = useOperatingContext();
  const [drills, setDrills] = useState<DrillRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [attendance, setAttendance] = useState<Record<string, AttendanceRecord[]>>({});
  const { isUK } = useJurisdiction();
  const { areaLabel, roomLabel, structure } = useSiteStructure();
  const { currentSiteId } = useSite();
  const isVillageView = structure === "rv" || structure === "mixed";

  /** Stage, then property — a couple sharing one villa sits under one heading. */
  const groupRows = (rows: AttendanceRecord[]) => {
    const areas = new Map<string, AttendanceRecord[]>();
    rows.forEach((r) => {
      const a = r.area_label || "No area recorded";
      if (!areas.has(a)) areas.set(a, []);
      areas.get(a)?.push(r);
    });
    return [...areas.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([area, list]) => {
        const units = new Map<string, AttendanceRecord[]>();
        list.forEach((r) => {
          const u = r.room_label || "";
          if (!units.has(u)) units.set(u, []);
          units.get(u)?.push(r);
        });
        return {
          area,
          wardens: [...new Set(list.map((r) => r.responsible_staff).filter(Boolean))] as string[],
          accounted: emergencyCounts(list).accounted,
          total: list.length,
          units: [...units.entries()]
            .sort(([a], [b]) => (parseInt(a.replace(/\D/g, "")) || 0) - (parseInt(b.replace(/\D/g, "")) || 0) || a.localeCompare(b))
            .map(([unit, people]) => ({ unit, people })),
        };
      });
  };


  const complianceNote = emergencyRegulatoryNote(isVillageView ? "rv" : isUK ? (ukNation && ukNation !== "England" ? "other_uk" : "england") : "rac");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    let query = supabase
      .from("evacuation_drills")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(50);
    // History belongs to the site you are working in.
    if (!currentSiteId) { setDrills([]); setLoading(false); return; }
    query = query.eq("branch_id", currentSiteId);
    query.then(({ data }) => {
      if (cancelled) return;
      setDrills((data || []) as any);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [currentSiteId]);


  const loadAttendance = async (drillId: string) => {
    if (attendance[drillId]) return attendance[drillId];
    const { data, error } = await supabase
      .from("evacuation_attendance")
      .select("*")
      .eq("drill_id", drillId)
      .order("person_name");
    if (error) throw error;
    const rows = (data || []) as unknown as AttendanceRecord[];
    setAttendance((prev) => ({ ...prev, [drillId]: rows }));
    return rows;
  };

  const toggle = async (id: string) => {
    if (openId === id) { setOpenId(null); return; }
    await loadAttendance(id);
    setOpenId(id);
  };

  const minutesToAccount = (d: DrillRecord) =>
    d.ended_at ? differenceInMinutes(new Date(d.ended_at), new Date(d.started_at)) : null;

  const statusText = (row: AttendanceRecord) => emergencyPolicy(row).label;

  const exportDrillCSV = async (d: DrillRecord) => {
    if (!can("emergency.export")) return;
    const rows = await loadAttendance(d.id) || [];
    const headers = ["Name", "Type", areaLabel, roomLabel, "Assistance", "Phone", "Emergency contact", "Emergency phone", "With / visiting", "Responsible staff", "Outcome", "Method", "Confirmed at", "Presence basis", "Marked at", "Marked by"];
    const body = rows.map((r: AttendanceRecord) => [
      r.person_name, r.person_type, r.area_label || "", r.room_label || "", can("assistance.view") ? r.assistance_level || "" : "Restricted",
      r.contact_phone || "", r.emergency_contact_name || "", r.emergency_contact_phone || "",
      r.associated_with || "", r.responsible_staff || "",
      statusText(r), outcomeExport(r)["Verification method"], r.confirmed_at || "", r.presence_basis || "legacy_unknown", r.marked_safe_at ? format(new Date(r.marked_safe_at), "dd/MM/yyyy HH:mm") : "", r.marked_by || "",
    ]);

    const csv = [
      [`"${escapeHtml(d.title)}"`].join(","),
      [`"Started ${format(new Date(d.started_at), "dd/MM/yyyy HH:mm")}"`].join(","),
      [`"Accounted for (verified or reported): ${emergencyCounts(rows).accounted} of ${rows.length}"`].join(","),
      d.unaccounted_reason ? [`"Reason: ${d.unaccounted_reason.replace(/"/g, '""')}"`].join(",") : "",
      "",
      headers.join(","),
      ...body.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")),
    ].filter(Boolean).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `evacuation-${format(new Date(d.started_at), "yyyy-MM-dd-HHmm")}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const printDrill = async (d: DrillRecord) => {
    if (!can("emergency.export")) return;
    const rows = await loadAttendance(d.id) || [];
    const counts = emergencyCounts(rows);
    const html = `<!DOCTYPE html><html><head><title>${escapeHtml(d.title)}</title><style>
      body{font-family:Arial,sans-serif;margin:24px;color:#111}
      h1{font-size:19px;margin:0 0 2px;color:#dc2626}
      .sub{font-size:12px;color:#6b7280;margin-bottom:12px}
      .meta{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;font-size:12px;margin-bottom:12px}
      .meta div{border:1px solid #e5e7eb;padding:6px 8px;border-radius:6px}
      table{width:100%;border-collapse:collapse;font-size:11px}
      th,td{padding:5px 7px;border-bottom:1px solid #e5e7eb;text-align:left}
      th{background:#fef2f2;color:#dc2626}
      tr.grp td{background:#f3f4f6}

      .reason{margin:12px 0;padding:8px;border:1px solid #fca5a5;background:#fef2f2;font-size:12px;border-radius:6px}
      .footer{margin-top:18px;font-size:10px;color:#6b7280;border-top:1px solid #e5e7eb;padding-top:8px}
    </style></head><body>
    <h1>${escapeHtml(d.title)}</h1>
    <div class="sub">${d.event_class === "real" ? "Real emergency" : d.event_class === "drill" ? "Practice drill" : "Legacy event — classification unverified"} • started ${format(new Date(d.started_at), "dd MMMM yyyy, HH:mm")} by ${escapeHtml(d.started_by)}</div>
    <div class="meta">
      <div><strong>Roll call records</strong><br>${counts.total}</div>
      <div><strong>Accounted for</strong><br>${counts.accounted} (${counts.physical} physically verified)</div>
      <div><strong>Outstanding action</strong><br>${counts.outstanding}</div>
      <div><strong>Event duration</strong><br>${minutesToAccount(d) != null ? `${minutesToAccount(d)} min` : "In progress"}</div>
    </div>
    ${d.unaccounted_reason ? `<div class="reason"><strong>Exceptions recorded:</strong> ${escapeHtml(d.unaccounted_reason)}</div>` : ""}
    <table><thead><tr><th>Name</th><th>Type</th><th>${roomLabel}</th><th>Assistance</th><th>Phone</th><th>Emergency contact</th><th>With / visiting</th><th>Responsible</th><th>Outcome</th><th>Marked</th></tr></thead>
    <tbody>${groupRows(rows).map((g) => `
      <tr class="grp"><td colspan="10"><strong>${escapeHtml(g.area)}</strong> — ${g.accounted} of ${g.total} accounted for${g.wardens.length ? ` · responsible: ${escapeHtml(g.wardens.join(", "))}` : ""}</td></tr>
      ${g.units.map((u) => u.people.map((r, i) => `<tr>
        <td>${escapeHtml(r.person_name)}</td><td>${escapeHtml(r.person_type)}</td>
        <td>${i === 0 ? (u.unit || "—") : ""}</td>
        <td>${can("assistance.view") ? r.assistance_level || "—" : "Restricted"}</td><td>${r.contact_phone || "—"}</td>
        <td>${r.emergency_contact_name ? `${r.emergency_contact_name} ${r.emergency_contact_phone || ""}` : "—"}</td>
        <td>${escapeHtml(r.associated_with || "—")}</td>
        <td>${escapeHtml(r.responsible_staff || "—")}</td>
        <td>${statusText(r)}<br>${outcomeExport(r)["Verification method"]}<br>${r.presence_basis || "legacy_unknown"}</td>
        <td>${r.marked_safe_at ? format(new Date(r.marked_safe_at), "HH:mm") : "—"}${r.marked_by ? `<br><small>${r.marked_by}</small>` : ""}</td>
      </tr>`).join("")).join("")}
    `).join("")}</tbody></table>

    <div class="footer">${complianceNote}<br>Generated by Centrim Life • ${format(new Date(), "dd MMM yyyy HH:mm")} • CONFIDENTIAL</div>
    </body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 300); }
  };

  return (
    <AppShell
      title="Evacuation Report"
      subtitle="Drills and real evacuations, with who was accounted for and when"
      titleIcon={Shield}
      titleIconClassName="h-5 w-5 shrink-0 text-destructive"
      mainClassName="p-6 space-y-4"
    >
            <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-[13px] text-muted-foreground">
              {complianceNote}
            </div>

            {loading ? (
              <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
            ) : drills.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-border rounded-xl">
                <Shield className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium text-muted-foreground">No evacuations or drills recorded yet</p>
              </div>
            ) : (
              drills.map((d) => {
                const actualCounts = attendance[d.id] ? emergencyCounts(attendance[d.id]) : null;
                const missing = actualCounts?.outstanding;
                const open = openId === d.id;
                const rows = attendance[d.id] || [];
                return (
                  <div key={d.id} className="rounded-xl border border-border bg-card overflow-hidden">
                    <button onClick={() => toggle(d.id)} className="w-full text-left px-4 py-3 hover:bg-muted/40 transition-colors">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-foreground">{d.title}</p>
                            <Badge variant="outline" className="text-[10px] capitalize">{d.event_class === "real" ? "Real emergency" : d.event_class === "drill" ? "Practice drill" : "Legacy classification"}</Badge>
                            <Badge variant={d.status === "completed" ? "secondary" : "destructive"} className="text-[10px]">{d.status}</Badge>
                          </div>
                          <p className="text-[12px] text-muted-foreground mt-0.5">
                            {format(new Date(d.started_at), "dd MMM yyyy HH:mm")} · started by {d.started_by}
                            {minutesToAccount(d) != null && <> · <Clock className="inline h-3 w-3" /> {minutesToAccount(d)} min event duration</>}
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-sm font-semibold text-foreground">{actualCounts ? `${actualCounts.accounted} / ${actualCounts.total}` : "Open to verify outcomes"}</p>
                            <p className="text-[11px] text-muted-foreground">accounted for</p>
                          </div>
                          {missing === 0
                            ? <CheckCircle2 className="h-5 w-5 text-success" />
                            : <span className="flex items-center gap-1 text-destructive text-xs font-medium"><AlertTriangle className="h-4 w-4" />{missing ?? "Unverified"} outstanding</span>}
                          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
                        </div>
                      </div>
                    </button>

                    {open && (
                      <div className="border-t border-border p-4 space-y-3">
                        {d.unaccounted_reason && (
                          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-[13px] text-destructive">
                            <strong>Exceptions recorded:</strong> {d.unaccounted_reason}
                          </div>
                        )}
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" disabled={!can("emergency.export")} onClick={() => exportDrillCSV(d)} className="h-8 gap-1.5 text-xs"><Download className="h-3.5 w-3.5" /> Export CSV</Button>
                          <Button variant="outline" size="sm" disabled={!can("emergency.export")} onClick={() => printDrill(d)} className="h-8 gap-1.5 text-xs"><Printer className="h-3.5 w-3.5" /> Print</Button>
                        </div>
                        {rows.length === 0 ? (
                          <p className="text-[13px] text-muted-foreground">No attendance records for this roll call.</p>
                        ) : (
                          <div className="space-y-4">
                            {groupRows(rows).map((g) => (
                              <div key={g.area} className="space-y-1.5">
                                <div className="flex flex-wrap items-baseline gap-2">
                                  <span className="text-[13px] font-semibold text-foreground">{g.area}</span>
                                  <span className="text-[11px] text-muted-foreground">{g.accounted} of {g.total} accounted for</span>
                                  {g.wardens.length > 0 && (
                                    <span className="text-[11px] text-muted-foreground">· Responsible: {g.wardens.join(", ")}</span>
                                  )}
                                </div>
                                {g.units.map((u) => (
                                  <div key={u.unit || "none"} className="space-y-1.5">
                                    {isVillageView && u.unit && (
                                      <div className="px-1 text-[11px] font-medium text-muted-foreground">
                                        {u.unit} — {u.people.length} {u.people.length === 1 ? "person" : "people"}
                                      </div>
                                    )}
                                    {u.people.map((r) => (
                                      <div key={r.id} className={`rounded-lg border px-3 py-2 ${emergencyPolicy(r).unresolved ? "border-destructive/30 bg-destructive/5" : "border-border"}`}>
                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                          <span className="text-[13px] font-medium text-foreground">{r.person_name}</span>
                                          <Badge variant="outline" className="text-[10px] capitalize">{r.person_type}</Badge>
                                          {r.room_label && <span className="text-[12px] text-muted-foreground">{r.room_label}</span>}
                                          {can("assistance.view") && r.assistance_level && <span className="text-[12px] text-muted-foreground">{r.assistance_level}</span>}
                                          {r.contact_phone && <span className="text-[12px] text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />{r.contact_phone}</span>}
                                          {r.emergency_contact_phone && (
                                            <span className="text-[12px] text-muted-foreground">{r.emergency_contact_name || "Emergency"}: {r.emergency_contact_phone}</span>
                                          )}
                                          {r.associated_with && <span className="text-[12px] text-muted-foreground">{r.associated_with}</span>}
                                          {r.responsible_staff && <span className="text-[12px] text-muted-foreground">Warden: {r.responsible_staff}</span>}
                                          <span className={`ml-auto text-[12px] font-medium ${emergencyPolicy(r).unresolved ? "text-destructive" : "text-success"}`}>
                                            {r.status === "evacuated_offsite" && <Ambulance className="inline h-3 w-3 mr-1" />}
                                            {statusText(r)} · {emergencyPolicy(r).methodLabel}
                                            {r.marked_safe_at ? ` · ${format(new Date(r.marked_safe_at), "HH:mm")}` : ""}
                                            {r.marked_by ? ` · ${r.marked_by}` : ""}
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ))}
                              </div>
                            ))}
                          </div>

                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
    </AppShell>
  );
}
