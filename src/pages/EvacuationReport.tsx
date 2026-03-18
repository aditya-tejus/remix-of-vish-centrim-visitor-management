import { useState, useEffect } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Shield, Download, Clock, Users, CheckCircle2, AlertTriangle } from "lucide-react";

interface DrillRecord {
  id: string;
  title: string;
  started_at: string;
  ended_at: string | null;
  total_people: number;
  accounted_for: number;
  status: string;
  started_by: string;
}

export default function EvacuationReport() {
  const [drills, setDrills] = useState<DrillRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDrills = async () => {
      const { data } = await supabase
        .from("evacuation_drills")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(50);
      if (data) setDrills(data);
      setLoading(false);
    };
    fetchDrills();
  }, []);

  const exportCSV = () => {
    const headers = ["Title", "Date", "Duration", "Total", "Accounted", "Status", "Started By"];
    const rows = drills.map((d) => [
      d.title,
      format(new Date(d.started_at), "dd/MM/yyyy HH:mm"),
      d.ended_at ? `${Math.round((new Date(d.ended_at).getTime() - new Date(d.started_at).getTime()) / 60000)}m` : "In progress",
      d.total_people,
      d.accounted_for,
      d.status,
      d.started_by,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `evacuation-report-${format(new Date(), "yyyy-MM-dd")}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
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
                    <Shield className="h-5 w-5 text-destructive" /> Evacuation Report
                  </h1>
                  <p className="text-[13px] text-muted-foreground">History of evacuation drills and roll calls</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5">
                <Download className="h-3.5 w-3.5" /> Export CSV
              </Button>
            </div>
          </header>

          <main className="p-6">
            {loading ? (
              <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
            ) : drills.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-border rounded-xl">
                <Shield className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium text-muted-foreground">No evacuation drills recorded</p>
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-[11px] uppercase tracking-wider">Drill</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Date</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Duration</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">People</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Accounted</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {drills.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="font-medium text-sm">{d.title}</TableCell>
                        <TableCell className="text-sm">{format(new Date(d.started_at), "dd MMM yyyy HH:mm")}</TableCell>
                        <TableCell className="text-sm">
                          {d.ended_at
                            ? `${Math.round((new Date(d.ended_at).getTime() - new Date(d.started_at).getTime()) / 60000)}m`
                            : "—"}
                        </TableCell>
                        <TableCell className="text-sm">{d.total_people}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium">{d.accounted_for}</span>
                            {d.accounted_for === d.total_people ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                            ) : (
                              <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={d.status === "completed" ? "secondary" : "destructive"} className="text-[10px]">
                            {d.status}
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
