import { useState, useMemo } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useVisitors } from "@/hooks/useVisitors";
import { format, subDays } from "date-fns";
import { Download, Search, ClipboardList, Filter } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function PresenceLog() {
  const { visitors, loading } = useVisitors();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateRange, setDateRange] = useState("7");

  const filtered = useMemo(() => {
    const cutoff = subDays(new Date(), parseInt(dateRange));
    let list = visitors.filter((v) => v.checkInTime >= cutoff);
    if (typeFilter !== "all") list = list.filter((v) => v.type === typeFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((v) => `${v.firstName} ${v.surname}`.toLowerCase().includes(q) || v.whomToVisit?.toLowerCase().includes(q));
    }
    return list.sort((a, b) => b.checkInTime.getTime() - a.checkInTime.getTime());
  }, [visitors, search, typeFilter, dateRange]);

  const exportCSV = () => {
    const headers = ["Name", "Type", "Check-In", "Check-Out", "Duration", "Visiting", "Status"];
    const rows = filtered.map((v) => [
      `${v.firstName} ${v.surname}`,
      v.type,
      format(v.checkInTime, "dd/MM/yyyy HH:mm"),
      v.checkOutTime ? format(v.checkOutTime, "dd/MM/yyyy HH:mm") : "",
      v.checkOutTime ? `${Math.round((v.checkOutTime.getTime() - v.checkInTime.getTime()) / 60000)}m` : "Active",
      v.whomToVisit || "",
      v.status,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `presence-log-${format(new Date(), "yyyy-MM-dd")}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex-1">
          <header className="sticky top-0 z-10 bg-card border-b border-border">
            <div className="flex items-center justify-between px-6 h-14">
              <div className="flex items-center gap-4">
                <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
                <div>
                  <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
                    <ClipboardList className="h-5 w-5 text-primary" /> Presence Log
                  </h1>
                  <p className="text-[13px] text-muted-foreground">Complete record of all check-ins and check-outs</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5">
                <Download className="h-3.5 w-3.5" /> Export CSV
              </Button>
            </div>
          </header>

          <main className="p-6 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="pl-10 h-9" />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="visitor">Visitors</SelectItem>
                  <SelectItem value="contractor">Contractors</SelectItem>
                  <SelectItem value="volunteer">Volunteers</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="resident">Residents</SelectItem>
                </SelectContent>
              </Select>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Today</SelectItem>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
              <Badge variant="secondary">{filtered.length} records</Badge>
            </div>

            {loading ? (
              <div className="space-y-2">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-border rounded-xl">
                <ClipboardList className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium text-muted-foreground">No records found</p>
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-[11px] uppercase tracking-wider">Name</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Type</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Check-In</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Check-Out</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Visiting</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.slice(0, 200).map((v) => (
                      <TableRow key={v.id}>
                        <TableCell className="font-medium text-sm">{v.firstName} {v.surname}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px] capitalize">{v.type}</Badge></TableCell>
                        <TableCell className="text-sm">{format(v.checkInTime, "dd MMM HH:mm")}</TableCell>
                        <TableCell className="text-sm">{v.checkOutTime ? format(v.checkOutTime, "dd MMM HH:mm") : "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{v.whomToVisit || "—"}</TableCell>
                        <TableCell>
                          <Badge variant={v.status === "checked-in" ? "default" : "secondary"} className="text-[10px]">
                            {v.status === "checked-in" ? "Active" : "Out"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
