import { useMemo, useState } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { AppHeader } from "@/components/AppHeader";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useVisitors } from "@/hooks/useVisitors";
import { usePermissions } from "@/hooks/usePermissions";
import { useSite } from "@/contexts/SiteContext";
import { usePersonTypes } from "@/hooks/usePersonTypes";
import { isOverstayedSync } from "@/hooks/useOverstayPolicy";
import { exportCsvAudited } from "@/lib/exportAudit";
import { LoadingState, EmptyState, ErrorState, PermissionDeniedState } from "@/components/states";
import { useToast } from "@/hooks/use-toast";
import { format, subDays } from "date-fns";
import { Download, Users, Clock, History } from "lucide-react";

type Tab = "onsite" | "overdue" | "history";

export default function OperationsReport() {
  const { visitors, loading, error } = useVisitors();
  const { can, loading: permsLoading } = usePermissions();
  const { currentSite, currentSiteId } = useSite();
  const { personTypes } = usePersonTypes();
  const { toast } = useToast();

  const [tab, setTab] = useState<Tab>("onsite");
  const [typeFilter, setTypeFilter] = useState("all");
  const [fromDate, setFromDate] = useState(format(subDays(new Date(), 7), "yyyy-MM-dd"));
  const [toDate, setToDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const canView = can("presence.view");
  const canExport = can("data.export");

  const byType = (list: typeof visitors) =>
    typeFilter === "all" ? list : list.filter((v) => v.type === typeFilter);

  const onSite = useMemo(
    () => byType(visitors.filter((v) => v.status === "checked-in")).sort((a, b) => b.checkInTime.getTime() - a.checkInTime.getTime()),
    [visitors, typeFilter]
  );

  const overdue = useMemo(() => onSite.filter((v) => isOverstayedSync(v)), [onSite]);

  const history = useMemo(() => {
    const start = new Date(`${fromDate}T00:00:00`);
    const end = new Date(`${toDate}T23:59:59`);
    return byType(visitors.filter((v) => v.checkInTime >= start && v.checkInTime <= end)).sort(
      (a, b) => b.checkInTime.getTime() - a.checkInTime.getTime()
    );
  }, [visitors, typeFilter, fromDate, toDate]);

  const current = tab === "onsite" ? onSite : tab === "overdue" ? overdue : history;

  const hoursOnSite = (checkIn: Date, checkOut?: Date | null) =>
    ((checkOut ?? new Date()).getTime() - checkIn.getTime()) / 3600000;

  const handleExport = async () => {
    if (!canExport) return;
    await exportCsvAudited(
      ["Name", "Type", "Checked in", "Checked out", "Hours on site", "Visiting", "Status"],
      current.map((v) => [
        `${v.firstName} ${v.surname}`.trim(),
        v.type,
        format(v.checkInTime, "hh:mm a dd MMM yyyy"),
        v.checkOutTime ? format(v.checkOutTime, "hh:mm a dd MMM yyyy") : "",
        hoursOnSite(v.checkInTime, v.checkOutTime).toFixed(1),
        v.whomToVisit || "",
        v.status,
      ]),
      {
        filenamePrefix: `visits-${tab}`,
        auditAction: "operations_report_export",
        siteId: currentSiteId,
        siteName: currentSite?.name ?? null,
        scopeNote: tab === "history" ? `${fromDate} to ${toDate}` : tab,
      }
    );
    toast({ title: "Export downloaded", description: "This download has been recorded in the audit trail." });
  };

  if (permsLoading) return <Shell><LoadingState label="Checking your access" /></Shell>;
  if (!canView) {
    return (
      <Shell>
        <PermissionDeniedState description="You do not have permission to see who is on site." />
      </Shell>
    );
  }

  return (
    <Shell
      actions={
        canExport ? (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExport} disabled={current.length === 0}>
            <Download className="h-3.5 w-3.5" /> Export this list
          </Button>
        ) : undefined
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SummaryCard icon={Users} label="On site now" value={onSite.length} />
        <SummaryCard icon={Clock} label="Longer than expected" value={overdue.length} tone="warning" />
        <SummaryCard icon={History} label="Visits in range" value={history.length} />
      </div>

      <Card className="rounded-xl">
        <CardContent className="p-4 space-y-4">
          <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <TabsList>
                <TabsTrigger value="onsite">On site now</TabsTrigger>
                <TabsTrigger value="overdue">Not checked out</TabsTrigger>
                <TabsTrigger value="history">Visit history</TabsTrigger>
              </TabsList>

              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <Label className="text-[12px]">Person type</Label>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="h-9 w-[170px] text-[13px] rounded-lg"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All types</SelectItem>
                      {personTypes.filter((t) => t.deskEnabled).map((t) => (
                        <SelectItem key={t.type} value={t.type}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {tab === "history" && (
                  <>
                    <div className="space-y-1">
                      <Label className="text-[12px]">From</Label>
                      <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-9 text-[13px] rounded-lg" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[12px]">To</Label>
                      <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-9 text-[13px] rounded-lg" />
                    </div>
                  </>
                )}
              </div>
            </div>

            <TabsContent value={tab} className="mt-4">
              {error ? (
                <ErrorState description={error} />
              ) : loading ? (
                <LoadingState label="Loading visits" />
              ) : current.length === 0 ? (
                <EmptyState
                  title={tab === "overdue" ? "Nobody is over their expected time" : "No visits to show"}
                  description={tab === "history" ? "Try widening the date range." : undefined}
                />
              ) : (
                <div className="w-full overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[12px]">Name</TableHead>
                      <TableHead className="text-[12px]">Type</TableHead>
                      <TableHead className="text-[12px]">Checked in</TableHead>
                      <TableHead className="text-[12px]">Checked out</TableHead>
                      <TableHead className="text-[12px]">Time on site</TableHead>
                      <TableHead className="text-[12px]">Visiting</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {current.map((v) => {
                      const hrs = hoursOnSite(v.checkInTime, v.checkOutTime);
                      return (
                        <TableRow key={v.id}>
                          <TableCell className="text-[13px] font-medium">{v.firstName} {v.surname}</TableCell>
                          <TableCell className="text-[13px] capitalize">{v.type}</TableCell>
                          <TableCell className="text-[13px] whitespace-nowrap">{format(v.checkInTime, "hh:mm a dd MMM")}</TableCell>
                          <TableCell className="text-[13px] whitespace-nowrap">
                            {v.checkOutTime ? format(v.checkOutTime, "hh:mm a dd MMM") : <span className="text-muted-foreground">Still here</span>}
                          </TableCell>
                          <TableCell className="text-[13px]">
                            {hrs.toFixed(1)}h{" "}
                            {!v.checkOutTime && isOverstayedSync(v) && (
                              <Badge variant="outline" className="ml-1 text-[10px] border-warning/40 text-warning">Over time</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-[13px] text-muted-foreground">{v.whomToVisit || "—"}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </Shell>
  );
}

function SummaryCard({ icon: Icon, label, value, tone }: { icon: any; label: string; value: number; tone?: "warning" }) {
  return (
    <Card className="rounded-xl">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${tone === "warning" ? "bg-warning/10 text-warning" : "bg-primary/10 text-primary"}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-[12px] text-muted-foreground">{label}</p>
          <p className="text-xl font-bold text-foreground">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function Shell({ children, actions }: { children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex-1">
          <AppHeader
            title="Who is on site"
            subtitle="Live presence, people over their expected time, and visit history for this site."
            actions={actions}
          />
          <main className="p-6 space-y-4">{children}</main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
