import { useState, useMemo } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppHeader } from "@/components/AppHeader";
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

import { useToast } from "@/hooks/use-toast";
import { isPast } from "date-fns";
import { Home, DoorOpen, LogIn, AlertTriangle, Users } from "lucide-react";
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

  const countCards = [
    {
      label: "In Building",
      value: inBuilding,
      colorClass: "text-success",
      borderClass: "border-l-success",
      bgClass: "bg-success/5",
      dot: true,
    },
    {
      label: "Away",
      value: away,
      colorClass: "text-warning",
      borderClass: "border-l-warning",
      bgClass: "bg-warning/5",
    },
    {
      label: "Overdue Return",
      value: overdueCount,
      colorClass: "text-destructive",
      borderClass: "border-l-destructive",
      bgClass: "bg-destructive/5",
      pulse: overdueCount > 0,
    },
  ];

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex-1">
          <AppHeader
            title="Residents"
            subtitle="Manage resident presence, leave & returns"
            overdueCount={overdueCount}
            draftCount={draftCount}
            pendingCount={pendingApprovals}
            actions={
              <>
                <Button variant="outline" size="sm" className="h-[34px] text-[13px] gap-1.5 border-border" onClick={() => setMarkAwayOpen(true)}>
                  <DoorOpen className="h-4 w-4" />
                  Mark Away
                </Button>
                <Button size="sm" className="h-[34px] text-[13px] gap-1.5 bg-primary hover:bg-primary/90" onClick={() => {
                  setActiveTab("presence");
                }}>
                  <LogIn className="h-4 w-4" />
                  Mark Return
                </Button>
              </>
            }
          />

          {/* Count cards */}
          <div className="px-6 pt-4 pb-2">
            <div className="grid grid-cols-3 gap-4">
              {countCards.map(card => (
                <div
                  key={card.label}
                  className={`rounded-xl border border-border border-l-[3px] ${card.borderClass} p-5 bg-card`}
                >
                  <p className={`text-3xl font-bold tabular-nums ${card.colorClass}`}>
                    {card.value}
                    {card.dot && card.value > 0 && (
                      <span className="inline-flex h-2 w-2 rounded-full bg-success ml-2 align-middle" />
                    )}
                    {card.pulse && (
                      <span className="relative inline-flex h-2 w-2 ml-2 align-middle">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive" />
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1 font-medium">{card.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Main content */}
          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm mx-6 mt-2 mb-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              {/* Underline-style tabs */}
              <div className="border-b border-border px-4">
                <TabsList className="inline-flex items-center bg-transparent rounded-none p-0 gap-0 h-auto">
                  <TabsTrigger value="presence" className="rounded-none h-11 px-5 text-[15px] font-medium border-b-[3px] border-b-transparent transition-all duration-150 data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:border-b-primary data-[state=active]:shadow-none data-[state=inactive]:text-muted-foreground">
                    Presence
                  </TabsTrigger>
                  <TabsTrigger value="leave" className="rounded-none h-11 px-5 text-[15px] font-medium border-b-[3px] border-b-transparent transition-all duration-150 data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:border-b-primary data-[state=active]:shadow-none data-[state=inactive]:text-muted-foreground">
                    Leave
                    {draftCount > 0 && (
                      <Badge variant="secondary" className="ml-1.5 text-[10px] bg-warning/10 text-warning">{draftCount}</Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="directory" className="rounded-none h-11 px-5 text-[15px] font-medium border-b-[3px] border-b-transparent transition-all duration-150 data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:border-b-primary data-[state=active]:shadow-none data-[state=inactive]:text-muted-foreground">
                    Directory
                    <span className="ml-1.5 text-[11px] rounded-full px-1.5 py-0.5 font-semibold tabular-nums">{residents.length}</span>
                  </TabsTrigger>
                  <TabsTrigger value="overdue" className="rounded-none h-11 px-5 text-[15px] font-medium border-b-[3px] border-b-transparent transition-all duration-150 data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:border-b-primary data-[state=active]:shadow-none data-[state=inactive]:text-muted-foreground">
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
