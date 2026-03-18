import { useState, useMemo } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useVisitors } from "@/hooks/useVisitors";
import { useResidents, Resident } from "@/hooks/useResidents";
import { useWings, useResidentDetails } from "@/hooks/useWings";
import { ResidentLeaveDialog } from "@/components/ResidentLeaveDialog";
import { ResidentLeaveTable } from "@/components/ResidentLeaveTable";
import { LeaveRequestsReview } from "@/components/LeaveRequestsReview";
import { ResidentFilterBar } from "@/components/ResidentFilterBar";
import { ResidentPresenceTable } from "@/components/ResidentPresenceTable";
import { ResidentDirectoryTable } from "@/components/ResidentDirectoryTable";
import { NotificationBell } from "@/components/NotificationBell";
import { useToast } from "@/hooks/use-toast";
import { isPast } from "date-fns";
import { Home, DoorOpen, LogIn, AlertTriangle, Users, BookOpen } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

export default function Residents() {
  const { visitors, addVisitor, checkOutVisitor, checkInReturn, deleteVisitor, overstayedCount } = useVisitors();
  const { residents, loading } = useResidents();
  const { data: wings = [] } = useWings();
  const { data: residentDetails = [] } = useResidentDetails();
  const { toast } = useToast();

  const [markAwayOpen, setMarkAwayOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("presence");
  const [draftCount, setDraftCount] = useState(0);
  const [pendingApprovals, setPendingApprovals] = useState(0);

  // Filters — shared across tabs
  const [selectedWings, setSelectedWings] = useState<string[]>([]);
  const [careLevel, setCareLevel] = useState("all");
  const [leaveStatus, setLeaveStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch counts
  useEffect(() => {
    const fetchCounts = async () => {
      const [drafts, pending] = await Promise.all([
        supabase.from("leave_requests").select("id", { count: "exact", head: true }).eq("source", "external").eq("status", "pending"),
        supabase.from("leave_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
      ]);
      setDraftCount(drafts.count || 0);
      setPendingApprovals(pending.count || 0);
    };
    fetchCounts();
  }, []);

  // Resident visitors (type=resident)
  const residentVisitors = useMemo(
    () => visitors.filter(v => v.type === "resident"),
    [visitors]
  );

  // Details map
  const detailsMap = useMemo(() => {
    const map = new Map<string, typeof residentDetails[0]>();
    residentDetails.forEach(d => map.set(d.visitor_id, d));
    return map;
  }, [residentDetails]);

  const wingMap = useMemo(() => {
    const map = new Map<string, typeof wings[0]>();
    wings.forEach(w => map.set(w.id, w));
    return map;
  }, [wings]);

  // Derived counts
  const inBuilding = residentVisitors.filter(v => v.status === "checked-in").length;
  const away = residentVisitors.filter(v => v.status === "checked-out").length;
  const overdueCount = residentVisitors.filter(v =>
    v.status === "checked-out" && v.expectedReturnDate && isPast(v.expectedReturnDate)
  ).length;

  // Filter residents (used by Presence and Directory)
  const filterResident = (r: any) => {
    const details = detailsMap.get(r.visitorId || r.id);
    if (selectedWings.length > 0 && (!details?.wing_id || !selectedWings.includes(details.wing_id))) return false;
    if (careLevel !== "all" && (details?.care_level || "standard") !== careLevel) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const name = `${r.firstName || r.name || ""} ${r.surname || ""}`.toLowerCase();
      const room = (details?.room || r.room || "").toLowerCase();
      const kw = (details?.key_worker || r.keyWorker || "").toLowerCase();
      if (!name.includes(q) && !room.includes(q) && !kw.includes(q)) return false;
    }
    return true;
  };

  const stats = [
    { label: "In Building", value: inBuilding, icon: <Home className="h-3.5 w-3.5" />, accent: "text-success" },
    { label: "Away", value: away, icon: <DoorOpen className="h-3.5 w-3.5" />, accent: "text-warning" },
    { label: "Overdue Return", value: overdueCount, icon: <AlertTriangle className="h-3.5 w-3.5" />, accent: "text-destructive" },
    { label: "Total Residents", value: residents.length, icon: <Users className="h-3.5 w-3.5" />, accent: "text-info" },
  ];

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex-1">
          {/* Header */}
          <header className="sticky top-0 z-10 bg-card border-b border-border">
            <div className="flex items-center justify-between px-6 h-14">
              <div className="flex items-center gap-4">
                <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
                <div>
                  <h1 className="text-xl font-bold text-foreground leading-tight">Residents</h1>
                  <p className="text-[13px] text-muted-foreground">Manage resident presence, leave & returns</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <NotificationBell
                  overstayedCount={0}
                  overdueCount={overdueCount}
                  draftCount={draftCount}
                  pendingCount={pendingApprovals}
                />
                <div className="w-px h-5 bg-border" />
                <Button variant="outline" size="sm" className="h-[34px] text-[13px] gap-1.5 border-border" onClick={() => setMarkAwayOpen(true)}>
                  <DoorOpen className="h-4 w-4" />
                  Mark Away
                </Button>
                <Button size="sm" className="h-[34px] text-[13px] gap-1.5 bg-primary hover:bg-primary/90" onClick={() => {
                  // Switch to presence tab to see returns
                  setActiveTab("presence");
                }}>
                  <LogIn className="h-4 w-4" />
                  Mark Return
                </Button>
              </div>
            </div>
          </header>

          {/* Contextual stats */}
          <div className="flex items-center gap-1.5 px-4 py-2 border-b border-border bg-muted/30">
            {stats.map(stat => (
              <div
                key={stat.label}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium"
              >
                <span className={stat.accent}>{stat.icon}</span>
                <span className="text-muted-foreground">{stat.label}</span>
                <span className={`font-bold tabular-nums ${stat.value > 0 && stat.accent.includes("destructive") ? "text-destructive" : "text-foreground"}`}>
                  {stat.value}
                </span>
                {stat.label === "Overdue Return" && stat.value > 0 && (
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-destructive" />
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Main content */}
          <div className="rounded-[10px] border border-border bg-card overflow-hidden shadow-sm mx-6 mt-4 mb-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <div className="border-b border-border px-2">
                <TabsList className="inline-flex items-center bg-muted rounded-lg p-1 gap-0.5 h-auto">
                  <TabsTrigger value="presence" className="rounded-md h-8 px-4 text-[13px] font-medium transition-all duration-150 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=inactive]:text-muted-foreground">
                    Presence
                  </TabsTrigger>
                  <TabsTrigger value="leave" className="rounded-md h-8 px-4 text-[13px] font-medium transition-all duration-150 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=inactive]:text-muted-foreground">
                    Leave
                    {draftCount > 0 && (
                      <Badge variant="secondary" className="ml-1.5 text-[10px] bg-warning/10 text-warning">{draftCount}</Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="directory" className="rounded-md h-8 px-4 text-[13px] font-medium transition-all duration-150 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=inactive]:text-muted-foreground">
                    Directory
                    <span className="ml-1.5 text-[10px] rounded-full px-1.5 py-0.5 font-semibold">{residents.length}</span>
                  </TabsTrigger>
                  <TabsTrigger value="overdue" className="rounded-md h-8 px-4 text-[13px] font-medium transition-all duration-150 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=inactive]:text-muted-foreground">
                    Overdue
                    {overdueCount > 0 && (
                      <Badge variant="destructive" className="ml-1.5 text-[10px] animate-pulse">{overdueCount}</Badge>
                    )}
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Shared filter bar */}
              <ResidentFilterBar
                wings={wings}
                selectedWings={selectedWings}
                onWingsChange={setSelectedWings}
                careLevel={careLevel}
                onCareLevelChange={setCareLevel}
                leaveStatus={leaveStatus}
                onLeaveStatusChange={setLeaveStatus}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
              />

              {/* Presence tab */}
              <TabsContent value="presence" className="mt-0">
                {loading ? (
                  <div className="p-6 space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
                ) : (
                  <ResidentPresenceTable
                    residents={residents.filter(filterResident)}
                    residentVisitors={residentVisitors}
                    detailsMap={detailsMap}
                    wingMap={wingMap}
                    onCheckInReturn={checkInReturn}
                  />
                )}
              </TabsContent>

              {/* Leave tab */}
              <TabsContent value="leave" className="mt-0">
                <ResidentLeaveTable
                  residents={residentVisitors}
                  onCheckInReturn={checkInReturn}
                  onDelete={deleteVisitor}
                />
              </TabsContent>

              {/* Directory tab */}
              <TabsContent value="directory" className="mt-0">
                {loading ? (
                  <div className="p-6 space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
                ) : (
                  <ResidentDirectoryTable
                    residents={residents.filter(filterResident)}
                    wingMap={wingMap}
                  />
                )}
              </TabsContent>

              {/* Overdue tab */}
              <TabsContent value="overdue" className="mt-0">
                <ResidentLeaveTable
                  residents={residentVisitors.filter(v =>
                    v.status === "checked-out" && v.expectedReturnDate && isPast(v.expectedReturnDate)
                  )}
                  onCheckInReturn={checkInReturn}
                  onDelete={deleteVisitor}
                />
              </TabsContent>
            </Tabs>
          </div>
        </SidebarInset>
      </div>

      <ResidentLeaveDialog open={markAwayOpen} onOpenChange={setMarkAwayOpen} onSubmit={(visitor) => {
        addVisitor(visitor);
        toast({ title: "Resident Marked Away", description: `${visitor.firstName} ${visitor.surname} has been checked out.` });
      }} />
    </SidebarProvider>
  );
}
