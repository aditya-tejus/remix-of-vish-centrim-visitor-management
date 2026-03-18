import { useState, useMemo } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useVisitors } from "@/hooks/useVisitors";
import { AlertTriangle, CheckCircle2, Search, Shield, Clock, Users, LogIn, Download, Printer, CheckSquare, Layers, Home, MapPin } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { format, differenceInMinutes } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Visitor } from "@/types/visitor";

function formatDuration(start: Date): string {
  const mins = differenceInMinutes(new Date(), start);
  if (mins < 1) return "< 1m";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// Extract wing from address (e.g. "Room 12, East Wing" → "East Wing")
function extractWing(address: string): string {
  if (!address) return "Unknown";
  const parts = address.split(",").map((s) => s.trim());
  const wingPart = parts.find((p) => p.toLowerCase().includes("wing"));
  return wingPart || "Unknown";
}

// Extract room from address (e.g. "Room 12, East Wing" → "Room 12")
function extractRoom(address: string): string {
  if (!address) return "";
  const parts = address.split(",").map((s) => s.trim());
  const roomPart = parts.find((p) => p.toLowerCase().includes("room"));
  return roomPart || parts[0] || "";
}

type GroupBy = "none" | "wing" | "type" | "status" | "residents";

export default function Evacuation() {
  const { visitors } = useVisitors();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterWing, setFilterWing] = useState<string>("all");
  const [safeIds, setSafeIds] = useState<Set<string>>(new Set());
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [groupBy, setGroupBy] = useState<GroupBy>("residents");

  const checkedIn = useMemo(() =>
    visitors.filter((v) => v.status === "checked-in"),
    [visitors]
  );

  // All unique wings
  const allWings = useMemo(() => {
    const wings = new Set<string>();
    checkedIn.forEach((v) => {
      if (v.type === "resident") wings.add(extractWing(v.address));
    });
    return [...wings].filter((w) => w !== "Unknown").sort();
  }, [checkedIn]);

  const filtered = useMemo(() => {
    let list = checkedIn;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((v) =>
        `${v.firstName} ${v.surname}`.toLowerCase().includes(q) ||
        v.whomToVisit?.toLowerCase().includes(q) ||
        v.address?.toLowerCase().includes(q)
      );
    }
    if (filterType !== "all") {
      list = list.filter((v) => v.type === filterType);
    }
    if (filterWing !== "all") {
      list = list.filter((v) => extractWing(v.address) === filterWing);
    }
    if (filterStatus === "safe") {
      list = list.filter((v) => safeIds.has(v.id));
    } else if (filterStatus === "unaccounted") {
      list = list.filter((v) => !safeIds.has(v.id));
    }
    return list;
  }, [checkedIn, searchQuery, filterType, filterWing, filterStatus, safeIds]);

  // Group the filtered list — when grouped by type, residents are sub-grouped by wing
  // Two-level structure: sections → groups
  interface EvacGroup { label: string; items: Visitor[]; isSubGroup?: boolean }
  interface EvacSection { label: string; groups: EvacGroup[] }

  const sections = useMemo((): EvacSection[] => {
    if (groupBy === "none") return [{ label: "", groups: [{ label: "", items: filtered }] }];

    const sortByRoom = (items: Visitor[]) =>
      items.sort((a, b) => {
        if (a.type === "resident" && b.type === "resident") {
          const roomA = extractRoom(a.address).replace(/\D/g, "");
          const roomB = extractRoom(b.address).replace(/\D/g, "");
          return (parseInt(roomA) || 0) - (parseInt(roomB) || 0);
        }
        return 0;
      });

    if (groupBy === "residents") {
      // Parent "Residents" section with wing sub-groups, then "Others"
      const wingMap = new Map<string, Visitor[]>();
      const others: Visitor[] = [];
      filtered.forEach((v) => {
        if (v.type === "resident") {
          const wing = extractWing(v.address);
          if (!wingMap.has(wing)) wingMap.set(wing, []);
          wingMap.get(wing)!.push(v);
        } else {
          others.push(v);
        }
      });
      const wingGroups = [...wingMap.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([wing, items]) => ({ label: wing, items: sortByRoom(items), isSubGroup: true }));

      const result: EvacSection[] = [];
      if (wingGroups.length > 0) result.push({ label: "Residents", groups: wingGroups });
      if (others.length > 0) result.push({ label: "Other (Visitors, Staff & Contractors)", groups: [{ label: "", items: others }] });
      return result;
    }

    // Flat grouping for type/wing/status
    const map = new Map<string, Visitor[]>();
    filtered.forEach((v) => {
      let key = "";
      if (groupBy === "type") {
        if (v.type === "resident") {
          key = `Residents — ${extractWing(v.address)}`;
        } else {
          key = v.type.charAt(0).toUpperCase() + v.type.slice(1) + "s";
        }
      } else if (groupBy === "wing") {
        key = v.type === "resident" ? extractWing(v.address) : "Visitors / Staff";
      } else if (groupBy === "status") {
        key = safeIds.has(v.id) ? "✅ Safe" : "⚠️ Unaccounted";
      }
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(v);
    });

    return [...map.entries()]
      .sort(([a], [b]) => {
        const aIsResident = a.startsWith("Residents");
        const bIsResident = b.startsWith("Residents");
        if (aIsResident && !bIsResident) return -1;
        if (!aIsResident && bIsResident) return 1;
        return a.localeCompare(b);
      })
      .map(([label, items]) => ({ label, groups: [{ label: "", items: sortByRoom(items) }] }));
  }, [filtered, groupBy, safeIds]);

  const totalPeople = checkedIn.reduce((sum, v) => sum + 1 + (v.additionalVisitors || 0), 0);
  const types = [...new Set(checkedIn.map((v) => v.type))];
  const safeCount = checkedIn.filter((v) => safeIds.has(v.id)).length;
  const unaccountedCount = checkedIn.length - safeCount;

  const toggleSafe = (id: string) => {
    setSafeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const markAllSafe = () => {
    setSafeIds(new Set(checkedIn.map((v) => v.id)));
    toast({ title: "All marked safe", description: `${checkedIn.length} people marked as safe.` });
  };

  const resetAll = () => setSafeIds(new Set());

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const unaccountedFiltered = filtered.filter((v) => !safeIds.has(v.id));
    if (unaccountedFiltered.every((v) => selectedIds.has(v.id)) && unaccountedFiltered.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(unaccountedFiltered.map((v) => v.id)));
    }
  };

  const markSelectedSafe = () => {
    if (selectedIds.size === 0) return;
    setSafeIds((prev) => {
      const next = new Set(prev);
      selectedIds.forEach((id) => next.add(id));
      return next;
    });
    toast({ title: "Marked safe", description: `${selectedIds.size} people marked as safe.` });
    setSelectedIds(new Set());
  };

  const selectedCount = selectedIds.size;
  const allUnaccountedSelected = filtered.filter((v) => !safeIds.has(v.id)).length > 0 &&
    filtered.filter((v) => !safeIds.has(v.id)).every((v) => selectedIds.has(v.id));

  const exportCSV = () => {
    const rows = filtered.map((v) => ({
      Name: `${v.firstName} ${v.surname}`,
      Type: v.type,
      Wing: v.type === "resident" ? extractWing(v.address) : "",
      Room: v.type === "resident" ? extractRoom(v.address) : "",
      Mobile: v.mobile,
      Email: v.email,
      Visiting: v.whomToVisit || "",
      "Checked In": format(new Date(v.checkInTime), "dd/MM/yyyy HH:mm"),
      Duration: formatDuration(new Date(v.checkInTime)),
      Companions: String(v.additionalVisitors || 0),
      Status: safeIds.has(v.id) ? "Safe" : "Unaccounted",
    }));
    if (rows.length === 0) return;
    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(","),
      ...rows.map((r) => headers.map((h) => `"${String((r as any)[h]).replace(/"/g, '""')}"`).join(","))
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `evacuation-list-${format(new Date(), "yyyy-MM-dd-HHmm")}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "CSV exported", description: `${rows.length} records exported.` });
  };

  const printList = () => {
    const date = format(new Date(), "dd MMMM yyyy, HH:mm");
    const rows = filtered.map((v) => `
      <tr class="${safeIds.has(v.id) ? "safe" : "danger"}">
        <td>${safeIds.has(v.id) ? "✅" : "⚠️"}</td>
        <td><strong>${v.firstName} ${v.surname}</strong>${v.type === "resident" ? `<br><small style="color:#6b7280">${extractRoom(v.address)} • ${extractWing(v.address)}</small>` : ""}</td>
        <td>${v.type}</td>
        <td>${v.whomToVisit || "—"}</td>
        <td>${format(new Date(v.checkInTime), "HH:mm")}</td>
        <td>${formatDuration(new Date(v.checkInTime))}</td>
        <td>${v.additionalVisitors || 0}</td>
        <td>${safeIds.has(v.id) ? "Safe" : "Unaccounted"}</td>
      </tr>`).join("");

    const html = `<!DOCTYPE html><html><head><title>Evacuation List</title><style>
      body{font-family:Arial,sans-serif;margin:30px;color:#1a1a2e}
      h1{color:#dc2626;font-size:22px;margin-bottom:4px}
      .sub{color:#6b7280;font-size:13px;margin-bottom:20px}
      .summary{display:flex;gap:24px;margin-bottom:16px;font-size:14px}
      .summary strong{color:#111}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th,td{padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:left}
      th{background:#fef2f2;color:#dc2626;font-weight:600}
      tr.safe td{background:#f0fdf4} tr.danger td{background:#fef2f2}
      .footer{margin-top:24px;font-size:11px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:12px}
    </style></head><body>
      <h1>🚨 Emergency Evacuation List</h1>
      <div class="sub">${date} • ${filtered.length} people listed</div>
      <div class="summary">
        <span><strong>Total:</strong> ${checkedIn.length}</span>
        <span style="color:#16a34a"><strong>Safe:</strong> ${safeCount}</span>
        <span style="color:#dc2626"><strong>Unaccounted:</strong> ${unaccountedCount}</span>
      </div>
      <table><thead><tr><th></th><th>Name</th><th>Type</th><th>Visiting</th><th>In</th><th>Duration</th><th>+People</th><th>Status</th></tr></thead>
      <tbody>${rows}</tbody></table>
      <div class="footer">Generated by Centrim Life • ${date} • CONFIDENTIAL</div>
    </body></html>`;

    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 300); }
  };

  const renderRow = (v: Visitor) => {
    const isSafe = safeIds.has(v.id);
    const wing = v.type === "resident" ? extractWing(v.address) : "";
    const room = v.type === "resident" ? extractRoom(v.address) : "";

    return (
      <TableRow key={v.id} className={isSafe ? "bg-success/5" : selectedIds.has(v.id) ? "bg-muted/50" : ""}>
        <TableCell>
          {!isSafe ? (
            <Checkbox
              checked={selectedIds.has(v.id)}
              onCheckedChange={() => toggleSelect(v.id)}
              aria-label={`Select ${v.firstName}`}
            />
          ) : (
            <span className="text-[10px] text-muted-foreground">—</span>
          )}
        </TableCell>
        <TableCell>
          <div className={`h-7 w-7 rounded-full flex items-center justify-center ${isSafe ? "bg-success text-success-foreground" : "bg-destructive/10 text-destructive"}`}>
            {isSafe ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          </div>
        </TableCell>
        <TableCell>
          <div>
            <p className="text-sm font-semibold text-foreground">{v.firstName} {v.surname}</p>
            <div className="flex items-center gap-2 mt-0.5">
              {v.type === "resident" && room && (
                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                  <Home className="h-2.5 w-2.5" /> {room}
                </span>
              )}
              {v.type === "resident" && wing && wing !== "Unknown" && (
                <span className="text-[10px] text-primary font-medium flex items-center gap-0.5">
                  <MapPin className="h-2.5 w-2.5" /> {wing}
                </span>
              )}
              {v.mobile && !(v.type === "resident") && (
                <span className="text-[10px] text-muted-foreground">{v.mobile}</span>
              )}
            </div>
          </div>
        </TableCell>
        <TableCell>
          <Badge variant="outline" className="text-[10px] capitalize">{v.type}</Badge>
        </TableCell>
        <TableCell className="text-sm text-foreground">{v.whomToVisit || "—"}</TableCell>
        <TableCell>
          {v.type !== "resident" ? (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <LogIn className="h-3 w-3" />
              {format(new Date(v.checkInTime), "HH:mm")}
            </span>
          ) : <span className="text-xs text-muted-foreground">—</span>}
        </TableCell>
        <TableCell>
          {v.type !== "resident" ? (
            <span className="text-xs font-medium text-foreground flex items-center gap-1">
              <Clock className="h-3 w-3 text-muted-foreground" />
              {formatDuration(new Date(v.checkInTime))}
            </span>
          ) : <span className="text-xs text-muted-foreground">—</span>}
        </TableCell>
        <TableCell>
          {(v.additionalVisitors || 0) > 0 ? (
            <div className="flex items-center gap-1.5">
              <Badge variant="secondary" className="text-[10px] gap-1 font-semibold">
                <Users className="h-3 w-3" />
                +{v.additionalVisitors}
              </Badge>
              {v.companionDetails && v.companionDetails.length > 0 && (
                <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                  {v.companionDetails.map((c) => c.name).filter(Boolean).join(", ")}
                </span>
              )}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </TableCell>
        <TableCell>
          <Button
            size="sm"
            variant={isSafe ? "ghost" : "default"}
            className={`h-7 text-xs gap-1 ${!isSafe ? "bg-emerald-600 hover:bg-emerald-700 text-emerald-50" : "text-muted-foreground"}`}
            onClick={() => toggleSafe(v.id)}
          >
            {isSafe ? <>Undo</> : <><CheckCircle2 className="h-3 w-3" /> Safe</>}
          </Button>
        </TableCell>
      </TableRow>
    );
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex-1">
          <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur-sm">
            <div className="flex items-center justify-between px-6 py-4">
              <div className="flex items-center gap-4">
                <SidebarTrigger />
                <div>
                  <h1 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <Shield className="h-5 w-5 text-destructive" />
                    Emergency Evacuation
                  </h1>
                  <p className="text-xs text-muted-foreground">Everyone currently on-site</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5 h-8">
                  <Download className="h-3.5 w-3.5" /> CSV
                </Button>
                <Button variant="outline" size="sm" onClick={printList} className="gap-1.5 h-8">
                  <Printer className="h-3.5 w-3.5" /> Print
                </Button>
                {selectedCount > 0 && (
                  <Button size="sm" onClick={markSelectedSafe} className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-emerald-50">
                    <CheckSquare className="h-3.5 w-3.5" /> Mark {selectedCount} Safe
                  </Button>
                )}
                {safeCount > 0 && safeCount < checkedIn.length && (
                  <Button variant="ghost" size="sm" onClick={resetAll} className="h-8 text-xs">Reset</Button>
                )}
                {checkedIn.length > 0 && safeCount < checkedIn.length && selectedCount === 0 && (
                  <Button size="sm" onClick={markAllSafe} className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-emerald-50">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Mark All Safe
                  </Button>
                )}
              </div>
            </div>
          </header>

          <main className="p-6 space-y-5">
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="rounded-xl border border-border bg-card p-4 text-center">
                <p className="text-2xl font-bold text-foreground">{checkedIn.length}</p>
                <p className="text-xs text-muted-foreground">On-Site</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4 text-center">
                <p className="text-2xl font-bold text-foreground">{totalPeople}</p>
                <p className="text-xs text-muted-foreground">Total (incl. companions)</p>
              </div>
              <div className="rounded-xl border border-success/30 bg-success/5 p-4 text-center cursor-pointer" onClick={() => setFilterStatus(filterStatus === "safe" ? "all" : "safe")}>
                <p className="text-2xl font-bold text-success">{safeCount}</p>
                <p className="text-xs text-muted-foreground">Safe</p>
              </div>
              <div className={`rounded-xl border p-4 text-center cursor-pointer ${unaccountedCount > 0 ? "border-destructive/30 bg-destructive/5" : "border-border bg-card"}`}
                onClick={() => setFilterStatus(filterStatus === "unaccounted" ? "all" : "unaccounted")}>
                <p className={`text-2xl font-bold ${unaccountedCount > 0 ? "text-destructive" : "text-foreground"}`}>{unaccountedCount}</p>
                <p className="text-xs text-muted-foreground">Unaccounted</p>
              </div>
            </div>

            {/* Filters */}
            <div className="rounded-xl border border-border bg-card p-3 shadow-soft">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search name, room, wing..."
                    className="pl-10 h-9"
                  />
                </div>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-[130px] h-9 text-xs">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {types.map((t) => (
                      <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterWing} onValueChange={setFilterWing}>
                  <SelectTrigger className="w-[140px] h-9 text-xs">
                    <SelectValue placeholder="All Wings" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Wings</SelectItem>
                    {allWings.map((w) => (
                      <SelectItem key={w} value={w}>{w}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[140px] h-9 text-xs">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="safe">Safe</SelectItem>
                    <SelectItem value="unaccounted">Unaccounted</SelectItem>
                  </SelectContent>
                </Select>


                <div className="h-6 w-px bg-border" />

                {/* Group By */}
                <div className="flex items-center gap-1.5 bg-muted/50 rounded-lg p-1">
                  <span className="text-[10px] font-semibold text-muted-foreground px-1.5 flex items-center gap-1">
                    <Layers className="h-3 w-3" /> Group:
                  </span>
                  {([
                    { value: "residents", label: "Residents" },
                    { value: "type", label: "Type" },
                    { value: "wing", label: "Wing" },
                    { value: "status", label: "Status" },
                    { value: "none", label: "None" },
                  ] as { value: GroupBy; label: string }[]).map((g) => (
                    <Button
                      key={g.value}
                      variant={groupBy === g.value ? "default" : "ghost"}
                      size="sm"
                      className="h-6 text-[11px] px-2.5"
                      onClick={() => setGroupBy(g.value)}
                    >
                      {g.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            {/* Evacuation list */}
            {sections.map((section, sIdx) => (
              <div key={section.label || "all"} className="space-y-3">
                {/* Section header (e.g. "Residents", "Other") */}
                {section.label && (
                  <div className="flex items-center gap-2 px-1 pt-2">
                    <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center">
                      {section.label.startsWith("Residents") ? <Home className="h-4 w-4 text-primary" /> :
                       <Users className="h-4 w-4 text-primary" />}
                    </div>
                    <h2 className="text-base font-bold text-foreground">{section.label}</h2>
                    {(() => {
                      const allItems = section.groups.flatMap((g) => g.items);
                      const sectionSafe = allItems.filter((v) => safeIds.has(v.id)).length;
                      const sectionTotal = allItems.length;
                      const allSafe = sectionSafe === sectionTotal;
                      return (
                        <>
                          <Badge variant="secondary" className="text-[10px]">{sectionTotal}</Badge>
                          <Badge
                            variant="outline"
                            className={`text-[10px] gap-1 ${allSafe ? "border-success/40 text-success" : "border-destructive/40 text-destructive"}`}
                          >
                            {allSafe ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                            {sectionSafe}/{sectionTotal} safe
                          </Badge>
                        </>
                      );
                    })()}
                    <div className="flex-1 h-px bg-border" />
                  </div>
                )}

                {/* Sub-groups (wings) or flat group */}
                {section.groups.map((group, gIdx) => (
                  <div key={group.label || `flat-${gIdx}`} className={`space-y-2 ${group.isSubGroup ? "ml-6" : ""}`}>
                    {group.label && (
                      <div className="flex items-center gap-2 px-1">
                        <div className="h-5 w-5 rounded bg-muted flex items-center justify-center">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                        </div>
                        <h3 className="text-sm font-semibold text-foreground">{group.label}</h3>
                        <Badge variant="secondary" className="text-[10px]">{group.items.length}</Badge>
                        {(() => {
                          const groupSafe = group.items.filter((v) => safeIds.has(v.id)).length;
                          const groupTotal = group.items.length;
                          const allSafe = groupSafe === groupTotal;
                          return (
                            <Badge
                              variant="outline"
                              className={`text-[10px] gap-1 ${allSafe ? "border-success/40 text-success" : "border-destructive/40 text-destructive"}`}
                            >
                              {allSafe ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                              {groupSafe}/{groupTotal} safe
                            </Badge>
                          );
                        })()}
                        <div className="flex-1 h-px bg-border/50" />
                      </div>
                    )}
                    <div className="rounded-xl border border-border bg-card overflow-hidden">
                      <Table>
                        {sIdx === 0 && gIdx === 0 && (
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[40px]">
                                <Checkbox
                                  checked={allUnaccountedSelected}
                                  onCheckedChange={toggleSelectAll}
                                  aria-label="Select all"
                                />
                              </TableHead>
                              <TableHead className="w-[60px] text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Status</TableHead>
                              <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Name / Location</TableHead>
                              <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Type</TableHead>
                              <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Visiting</TableHead>
                              <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Checked In</TableHead>
                              <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Duration</TableHead>
                              <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Companions</TableHead>
                              <TableHead className="w-[100px] text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Action</TableHead>
                            </TableRow>
                          </TableHeader>
                        )}
                        <TableBody>
                          {group.items.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={9} className="text-center py-8">
                                <p className="text-xs text-muted-foreground">No people in this group</p>
                              </TableCell>
                            </TableRow>
                          ) : (
                            group.items.map(renderRow)
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
