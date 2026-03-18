import { useState, useMemo } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Users, UserX, Heart, TrendingDown, Search, CalendarDays, Download,
  MoreHorizontal, MessageSquare, Bell, Sparkles, ArrowUpDown, AlertTriangle,
} from "lucide-react";
import { useVisitors } from "@/hooks/useVisitors";
import { useResidents } from "@/hooks/useResidents";
import {
  format, subDays, subMonths, differenceInCalendarMonths, isWithinInterval,
  startOfDay, endOfDay, isSameDay,
} from "date-fns";
import { exportVisitorsToCSV } from "@/lib/exportVisitors";
import { useToast } from "@/hooks/use-toast";
import { WelfareNoteDialog } from "@/components/WelfareNoteDialog";

type DatePreset = "7d" | "30d" | "90d" | "custom";
type SortField = "name" | "totalVisits" | "lastVisit" | "avgPerMonth";
type SortDir = "asc" | "desc";

interface ResidentVisitStats {
  residentName: string;
  room: string;
  wing: string;
  uniqueVisitors: number;
  totalVisits: number;
  lastVisitDate: Date | null;
  avgVisitsPerMonth: number;
  isLowAlert: boolean;
  visitorsThisMonth: number;
}

export default function VisitorAnalytics() {
  const { visitors } = useVisitors();
  const { toast } = useToast();

  const [datePreset, setDatePreset] = useState<DatePreset>("30d");
  const [customFrom, setCustomFrom] = useState<Date | undefined>(subDays(new Date(), 30));
  const [customTo, setCustomTo] = useState<Date | undefined>(new Date());
  const [searchQuery, setSearchQuery] = useState("");
  const [visitorTypeFilter, setVisitorTypeFilter] = useState("all");
  const [wingFilter, setWingFilter] = useState("all");
  const [sortField, setSortField] = useState<SortField>("totalVisits");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [welfareResident, setWelfareResident] = useState<string | null>(null);

  // Date range
  const dateRange = useMemo(() => {
    const now = new Date();
    if (datePreset === "7d") return { from: subDays(now, 7), to: now };
    if (datePreset === "30d") return { from: subDays(now, 30), to: now };
    if (datePreset === "90d") return { from: subDays(now, 90), to: now };
    return { from: customFrom || subDays(now, 30), to: customTo || now };
  }, [datePreset, customFrom, customTo]);

  // Filtered visitors within date range (only type=visitor coming to visit residents)
  const filteredVisitors = useMemo(() => {
    return visitors.filter((v) => {
      if (v.type === "resident") return false; // residents themselves aren't visitors
      const inRange = isWithinInterval(v.checkInTime, {
        start: startOfDay(dateRange.from),
        end: endOfDay(dateRange.to),
      });
      if (!inRange) return false;
      if (visitorTypeFilter !== "all" && v.type !== visitorTypeFilter) return false;
      return true;
    });
  }, [visitors, dateRange, visitorTypeFilter]);

  // Compute stats per resident
  const residentStats = useMemo((): ResidentVisitStats[] => {
    const months = Math.max(1, differenceInCalendarMonths(dateRange.to, dateRange.from) || 1);
    const thisMonth = new Date();
    const startOfMonth = new Date(thisMonth.getFullYear(), thisMonth.getMonth(), 1);

    return mockResidents.map((resident) => {
      // Find visitors who visited this resident
      const residentVisits = filteredVisitors.filter(
        (v) => v.whomToVisit?.toLowerCase().includes(resident.name.toLowerCase().split(" ")[0])
            || v.whomToVisit === resident.name
      );

      const uniqueVisitorNames = new Set(
        residentVisits.map((v) => `${v.firstName} ${v.surname}`.toLowerCase())
      );

      const lastVisit = residentVisits.length > 0
        ? residentVisits.reduce((latest, v) =>
            v.checkInTime > latest ? v.checkInTime : latest,
            residentVisits[0].checkInTime
          )
        : null;

      const visitsThisMonth = visitors.filter(
        (v) =>
          v.type !== "resident" &&
          v.checkInTime >= startOfMonth &&
          (v.whomToVisit?.toLowerCase().includes(resident.name.toLowerCase().split(" ")[0])
            || v.whomToVisit === resident.name)
      ).length;

      const avgPerMonth = residentVisits.length / months;

      return {
        residentName: resident.name,
        room: resident.room,
        wing: resident.wing,
        uniqueVisitors: uniqueVisitorNames.size,
        totalVisits: residentVisits.length,
        lastVisitDate: lastVisit,
        avgVisitsPerMonth: Math.round(avgPerMonth * 10) / 10,
        isLowAlert: avgPerMonth < 2,
        visitorsThisMonth: visitsThisMonth,
      };
    });
  }, [filteredVisitors, dateRange, visitors]);

  // Apply search and wing filter
  const filteredStats = useMemo(() => {
    let result = residentStats;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (r) => r.residentName.toLowerCase().includes(q) || r.room.toLowerCase().includes(q)
      );
    }
    if (wingFilter !== "all") {
      result = result.filter((r) => r.wing === wingFilter);
    }
    // Sort
    result = [...result].sort((a, b) => {
      let cmp = 0;
      if (sortField === "name") cmp = a.residentName.localeCompare(b.residentName);
      else if (sortField === "totalVisits") cmp = a.totalVisits - b.totalVisits;
      else if (sortField === "avgPerMonth") cmp = a.avgVisitsPerMonth - b.avgVisitsPerMonth;
      else if (sortField === "lastVisit") {
        const aTime = a.lastVisitDate?.getTime() || 0;
        const bTime = b.lastVisitDate?.getTime() || 0;
        cmp = aTime - bTime;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return result;
  }, [residentStats, searchQuery, wingFilter, sortField, sortDir]);

  // Summary stats
  const noVisitorsThisMonth = residentStats.filter((r) => r.visitorsThisMonth === 0).length;
  const lowVisitCount = residentStats.filter((r) => r.isLowAlert).length;
  const mostVisited = residentStats.reduce(
    (top, r) => (r.totalVisits > top.totalVisits ? r : top),
    residentStats[0] || { residentName: "—", totalVisits: 0 }
  );

  const wings = [...new Set(mockResidents.map((r) => r.wing))];

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("asc"); }
  };

  const handleExportCSV = () => {
    const rows = filteredStats.map((r) => ({
      "Resident Name": r.residentName,
      "Room": r.room,
      "Wing": r.wing,
      "Unique Visitors": r.uniqueVisitors,
      "Total Visits": r.totalVisits,
      "Last Visit Date": r.lastVisitDate ? format(r.lastVisitDate, "dd/MM/yyyy") : "N/A",
      "Avg Visits/Month": r.avgVisitsPerMonth,
      "Status": r.isLowAlert ? "Low Visitor Alert" : "Normal",
    }));
    const header = Object.keys(rows[0] || {}).join(",");
    const csv = [header, ...rows.map((r) => Object.values(r).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `visitor-analytics-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Exported", description: `${filteredStats.length} resident records exported to CSV.` });
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
                  <h1 className="text-lg font-semibold text-foreground">Visitor Analytics</h1>
                  <p className="text-xs text-muted-foreground">
                    Resident social engagement & visitor insights
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExportCSV}>
                <Download className="h-4 w-4" /> Export CSV
              </Button>
            </div>
          </header>

          <main className="p-6 space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-xl border border-border bg-card p-5 border-l-4 border-l-destructive">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">No Visitors This Month</p>
                    <p className="text-3xl font-bold tracking-tight text-foreground">{noVisitorsThisMonth}</p>
                  </div>
                  <div className="rounded-xl p-2.5 bg-destructive/10 text-destructive">
                    <UserX className="h-5 w-5" />
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-border bg-card p-5 border-l-4 border-l-warning">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Low Visit Alerts</p>
                    <p className="text-3xl font-bold tracking-tight text-foreground">{lowVisitCount}</p>
                  </div>
                  <div className="rounded-xl p-2.5 bg-warning/10 text-warning">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-border bg-card p-5 border-l-4 border-l-primary">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Total Residents</p>
                    <p className="text-3xl font-bold tracking-tight text-foreground">{mockResidents.length}</p>
                  </div>
                  <div className="rounded-xl p-2.5 bg-primary/10 text-primary">
                    <Users className="h-5 w-5" />
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-border bg-card p-5 border-l-4 border-l-success">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Most Visited</p>
                    <p className="text-lg font-bold tracking-tight text-foreground truncate">{mostVisited?.residentName || "—"}</p>
                    <p className="text-xs text-muted-foreground">{mostVisited?.totalVisits || 0} visits</p>
                  </div>
                  <div className="rounded-xl p-2.5 bg-success/10 text-success">
                    <Heart className="h-5 w-5" />
                  </div>
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
              <div className="flex flex-wrap items-center gap-3">
                {/* Date Range */}
                <div className="flex items-center gap-1.5 bg-muted/50 rounded-lg p-1">
                  {([
                    { value: "7d", label: "7 Days" },
                    { value: "30d", label: "30 Days" },
                    { value: "90d", label: "90 Days" },
                    { value: "custom", label: "Custom" },
                  ] as { value: DatePreset; label: string }[]).map((p) => (
                    <Button
                      key={p.value}
                      variant={datePreset === p.value ? "default" : "ghost"}
                      size="sm"
                      className="h-7 text-xs px-3"
                      onClick={() => setDatePreset(p.value)}
                    >
                      {p.label}
                    </Button>
                  ))}
                </div>

                {datePreset === "custom" && (
                  <div className="flex items-center gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {customFrom ? format(customFrom, "dd MMM yy") : "From"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={customFrom} onSelect={setCustomFrom} /></PopoverContent>
                    </Popover>
                    <span className="text-xs text-muted-foreground">to</span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {customTo ? format(customTo, "dd MMM yy") : "To"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={customTo} onSelect={setCustomTo} /></PopoverContent>
                    </Popover>
                  </div>
                )}

                <div className="h-6 w-px bg-border" />

                {/* Wing filter */}
                <Select value={wingFilter} onValueChange={setWingFilter}>
                  <SelectTrigger className="h-8 w-[140px] text-xs rounded-lg">
                    <SelectValue placeholder="All Wings" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Wings</SelectItem>
                    {wings.map((w) => <SelectItem key={w} value={w}>{w}</SelectItem>)}
                  </SelectContent>
                </Select>

                {/* Visitor type */}
                <Select value={visitorTypeFilter} onValueChange={setVisitorTypeFilter}>
                  <SelectTrigger className="h-8 w-[140px] text-xs rounded-lg">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Visitor Types</SelectItem>
                    <SelectItem value="visitor">Family/Friend</SelectItem>
                    <SelectItem value="contractor">Contractor</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex-1" />

                {/* Search */}
                <div className="relative w-[220px]">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search resident..."
                    className="pl-8 h-8 text-xs rounded-lg"
                  />
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="rounded-xl border border-border bg-card shadow-soft overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Resident</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Unit / Room</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground cursor-pointer" onClick={() => toggleSort("totalVisits")}>
                      <span className="inline-flex items-center gap-1">
                        Total Visits
                        <ArrowUpDown className="h-3 w-3" />
                      </span>
                    </TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Unique Visitors</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground cursor-pointer" onClick={() => toggleSort("lastVisit")}>
                      <span className="inline-flex items-center gap-1">
                        Last Visit
                        <ArrowUpDown className="h-3 w-3" />
                      </span>
                    </TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground cursor-pointer" onClick={() => toggleSort("avgPerMonth")}>
                      <span className="inline-flex items-center gap-1">
                        Avg / Month
                        <ArrowUpDown className="h-3 w-3" />
                      </span>
                    </TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Status</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStats.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-16">
                        <div className="flex flex-col items-center gap-2">
                          <Users className="h-8 w-8 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">No residents match your filters</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredStats.map((r) => (
                      <TableRow
                        key={r.residentName}
                        className={`transition-colors ${
                          r.isLowAlert
                            ? "bg-destructive/[0.04] border-l-2 border-l-destructive"
                            : "hover:bg-muted/50"
                        }`}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className={`text-[11px] font-semibold ${
                                r.isLowAlert ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
                              }`}>
                                {r.residentName.split(" ").map((n) => n[0]).join("")}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium text-foreground">{r.residentName}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm text-foreground">{r.room}</p>
                            <p className="text-[11px] text-muted-foreground">{r.wing}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-semibold text-foreground">{r.totalVisits}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-foreground">{r.uniqueVisitors}</span>
                        </TableCell>
                        <TableCell>
                          {r.lastVisitDate ? (
                            <span className="text-sm text-foreground">{format(r.lastVisitDate, "dd MMM yyyy")}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">No visits</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className={`text-sm font-semibold ${r.isLowAlert ? "text-destructive" : "text-foreground"}`}>
                            {r.avgVisitsPerMonth}
                          </span>
                        </TableCell>
                        <TableCell>
                          {r.isLowAlert ? (
                            <Badge variant="destructive" className="text-[10px] gap-1">
                              <TrendingDown className="h-3 w-3" />
                              Low Visitor Alert
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px]">Normal</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                              <DropdownMenuItem onClick={() => setWelfareResident(r.residentName)}>
                                <MessageSquare className="h-3.5 w-3.5 mr-2" />
                                Add Welfare Note
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                toast({ title: "Care Team Notified", description: `Lifestyle team alerted about ${r.residentName}.` });
                              }}>
                                <Bell className="h-3.5 w-3.5 mr-2" />
                                Notify Care Team
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                toast({ title: "Activity Scheduled", description: `A lifestyle activity prompt has been created for ${r.residentName}.` });
                              }}>
                                <Sparkles className="h-3.5 w-3.5 mr-2" />
                                Schedule Activity
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </main>
        </SidebarInset>
      </div>

      {welfareResident && (
        <WelfareNoteDialog
          open={!!welfareResident}
          onOpenChange={(o) => { if (!o) setWelfareResident(null); }}
          residentName={welfareResident}
        />
      )}
    </SidebarProvider>
  );
}
