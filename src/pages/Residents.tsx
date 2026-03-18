import { useState, useMemo } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppHeader } from "@/components/AppHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useVisitors } from "@/hooks/useVisitors";
import { useResidents, Resident } from "@/hooks/useResidents";
import { useWings, useResidentDetails } from "@/hooks/useWings";
import { ResidentFilterBar } from "@/components/ResidentFilterBar";
import { ResidentPresenceTable } from "@/components/ResidentPresenceTable";
import { ResidentDirectoryTable } from "@/components/ResidentDirectoryTable";
import { ResidentOutingDialog } from "@/components/ResidentOutingDialog";
import { MarkReturnDialog } from "@/components/MarkReturnDialog";
import { useToast } from "@/hooks/use-toast";
import { isPast, isToday } from "date-fns";
import { DoorOpen, LogIn, ShieldAlert, Clock, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Residents() {
  const { visitors, addVisitor, checkOutVisitor, checkInReturn, deleteVisitor } = useVisitors();
  const { residents, loading } = useResidents();
  const { data: wings = [] } = useWings();
  const { data: residentDetails = [] } = useResidentDetails();
  const { toast } = useToast();

  const [outingOpen, setOutingOpen] = useState(false);
  const [outingMode, setOutingMode] = useState<"short" | "planned">("short");
  const [outingResident, setOutingResident] = useState<{ id: string; name: string; room: string; wing: string } | null>(null);
  const [activeTab, setActiveTab] = useState("board");
  const [markReturnOpen, setMarkReturnOpen] = useState(false);
  const [activeCardFilter, setActiveCardFilter] = useState<string | null>(null);

  // Filters
  const [selectedWings, setSelectedWings] = useState<string[]>([]);
  const [careLevel, setCareLevel] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const residentVisitors = useMemo(
    () => visitors.filter(v => v.type === "resident"),
    [visitors]
  );

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

  // Presence map
  const presenceMap = useMemo(() => {
    const map = new Map<string, "in-building" | "away" | "on-leave" | "overdue">();
    residents.forEach(r => map.set(r.visitorId, "in-building"));
    residentVisitors.forEach(v => {
      if (v.status === "checked-out") {
        const isOverdue = v.expectedReturnDate && isPast(v.expectedReturnDate);
        if (isOverdue) {
          map.set(v.id, "overdue");
        } else {
          const isAway = v.leaveType === "Away" || !v.leaveType;
          map.set(v.id, isAway ? "away" : "on-leave");
        }
      }
    });
    return map;
  }, [residents, residentVisitors]);

  // Derived counts
  const inBuilding = residents.filter(r => presenceMap.get(r.visitorId) === "in-building").length;
  const awayCount = residents.filter(r => presenceMap.get(r.visitorId) === "away").length;
  const onLeaveCount = residents.filter(r => presenceMap.get(r.visitorId) === "on-leave").length;
  const overdueCount = residents.filter(r => presenceMap.get(r.visitorId) === "overdue").length;
  const dolsCount = residents.filter(r => r.dolsLpsFlag).length;
  const dueBackToday = residentVisitors.filter(v =>
    v.status === "checked-out" && v.expectedReturnDate && isToday(v.expectedReturnDate)
  ).length;

  // Away residents for Mark Return dialog
  const awayResidents = useMemo(
    () => residentVisitors.filter(v => v.status === "checked-out"),
    [residentVisitors]
  );

  const filterResident = (r: Resident) => {
    const details = detailsMap.get(r.visitorId);
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

  const handleQuickAway = (resident: Resident) => {
    setOutingResident({ id: resident.visitorId, name: resident.name, room: resident.room, wing: resident.wing });
    setOutingMode("short");
    setOutingOpen(true);
  };

  const openOuting = (mode: "short" | "planned" = "short") => {
    setOutingResident(null);
    setOutingMode(mode);
    setOutingOpen(true);
  };

  const toggleCardFilter = (filter: string) => {
    if (filter === "in-building") {
      // Switch to Directory tab instead of filtering Board
      setActiveTab("directory");
      setActiveCardFilter(null);
      return;
    }
    setActiveCardFilter(prev => prev === filter ? null : filter);
    if (activeTab !== "board") setActiveTab("board");
  };

  const countCards = [
    {
      key: "in-building",
      label: "In Building",
      value: inBuilding,
      colorClass: "text-success",
      borderClass: "border-l-success",
      icon: <span className="inline-flex h-2 w-2 rounded-full bg-success" />,
    },
    {
      key: "away",
      label: "Away",
      value: awayCount,
      colorClass: "text-warning",
      borderClass: "border-l-warning",
    },
    {
      key: "on-leave",
      label: "On Leave",
      value: onLeaveCount,
      colorClass: "text-info",
      borderClass: "border-l-info",
    },
    {
      key: "overdue",
      label: "Overdue",
      value: overdueCount,
      colorClass: "text-destructive",
      borderClass: "border-l-destructive",
      pulse: overdueCount > 0,
      icon: overdueCount > 0 ? <AlertTriangle className="h-3.5 w-3.5 text-destructive" /> : undefined,
    },
    {
      key: "due-today",
      label: "Due Back Today",
      value: dueBackToday,
      colorClass: "text-primary",
      borderClass: "border-l-primary",
      icon: <Clock className="h-3.5 w-3.5 text-primary" />,
      extra: dolsCount > 0 ? `${dolsCount} DoLS` : undefined,
    },
  ];

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex-1">
          <AppHeader
            title="Residents"
            subtitle="Manage resident presence, outings & returns"
            overdueCount={overdueCount}
            actions={
              <>
                <Button variant="outline" size="sm" className="h-[34px] text-[13px] gap-1.5 border-border" onClick={() => openOuting("short")}>
                  <DoorOpen className="h-4 w-4" />
                  Record Outing
                </Button>
                <Button size="sm" className="h-[34px] text-[13px] gap-1.5 bg-primary hover:bg-primary/90" onClick={() => setMarkReturnOpen(true)}>
                  <LogIn className="h-4 w-4" />
                  Mark Return
                </Button>
              </>
            }
          />

          {/* Interactive count cards */}
          <div className="px-6 pt-4 pb-2">
            <div className="grid grid-cols-5 gap-3">
              {countCards.map(card => {
                const isActive = activeCardFilter === card.key;
                return (
                  <button
                    key={card.key}
                    onClick={() => toggleCardFilter(card.key)}
                    className={`rounded-xl border border-border border-l-[3px] ${card.borderClass} p-4 bg-card text-left transition-all duration-150 ${
                      isActive
                        ? "ring-2 ring-primary/30 shadow-md scale-[1.02]"
                        : "hover:shadow-sm hover:scale-[1.01]"
                    } ${card.pulse ? "animate-overdue" : ""}`}
                  >
                    <div className="flex items-center justify-between">
                      <p className={`text-2xl font-bold tabular-nums ${card.colorClass}`}>
                        {card.value}
                      </p>
                      {card.icon}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 font-medium">{card.label}</p>
                    {card.extra && (
                      <p className="text-[10px] text-destructive font-semibold mt-0.5 flex items-center gap-1">
                        <ShieldAlert className="h-3 w-3" /> {card.extra}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Main content */}
          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm mx-6 mt-2 mb-6">
            <Tabs value={activeTab} onValueChange={v => { setActiveTab(v); setActiveCardFilter(null); }}>
              <div className="border-b border-border px-4">
                <TabsList className="inline-flex items-center bg-transparent rounded-none p-0 gap-0 h-auto">
                  <TabsTrigger value="board" className="rounded-none h-11 px-5 text-[15px] font-medium border-b-[3px] border-b-transparent transition-all duration-150 data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:border-b-primary data-[state=active]:shadow-none data-[state=inactive]:text-muted-foreground">
                    Board
                  </TabsTrigger>
                  <TabsTrigger value="directory" className="rounded-none h-11 px-5 text-[15px] font-medium border-b-[3px] border-b-transparent transition-all duration-150 data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:border-b-primary data-[state=active]:shadow-none data-[state=inactive]:text-muted-foreground">
                    Profiles
                    <span className="ml-1.5 text-[11px] rounded-full px-1.5 py-0.5 font-semibold tabular-nums">{residents.length}</span>
                  </TabsTrigger>
                </TabsList>
              </div>

              <ResidentFilterBar
                wings={wings}
                selectedWings={selectedWings}
                onWingsChange={setSelectedWings}
                careLevel={careLevel}
                onCareLevelChange={setCareLevel}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
              />

              <TabsContent value="board" className="mt-0">
                {loading ? (
                  <div className="p-6 space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
                ) : (
                  <ResidentPresenceTable
                    residents={residents.filter(filterResident)}
                    residentVisitors={residentVisitors}
                    detailsMap={detailsMap}
                    wingMap={wingMap}
                    onCheckInReturn={checkInReturn}
                    onQuickAway={handleQuickAway}
                    statusFilter={activeCardFilter}
                    totalResidentCount={residents.length}
                  />
                )}
              </TabsContent>

              <TabsContent value="directory" className="mt-0">
                {loading ? (
                  <div className="p-6 space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
                ) : (
                  <ResidentDirectoryTable
                    residents={residents.filter(filterResident)}
                    wingMap={wingMap}
                    presenceMap={presenceMap}
                    onQuickAway={handleQuickAway}
                  />
                )}
              </TabsContent>
            </Tabs>
          </div>
        </SidebarInset>
      </div>

      {/* Unified Outing Dialog */}
      <ResidentOutingDialog
        open={outingOpen}
        onOpenChange={setOutingOpen}
        defaultMode={outingMode}
        preselectedResident={outingResident}
        onSubmit={(visitor) => {
          addVisitor(visitor);
          setOutingResident(null);
          const isShort = visitor.leaveType === "Away";
          toast({
            title: isShort ? "Resident Marked Away" : "Leave Recorded",
            description: `${visitor.firstName} ${visitor.surname} ${isShort ? "is away" : "has been checked out on leave"}.`,
          });
        }}
      />

      {/* Mark Return Dialog */}
      <MarkReturnDialog
        open={markReturnOpen}
        onOpenChange={setMarkReturnOpen}
        awayResidents={awayResidents}
        onReturn={async (id, comment) => {
          await checkInReturn(id, comment);
          toast({
            title: "Resident Returned",
            description: "Resident has been marked as returned.",
          });
        }}
      />
    </SidebarProvider>
  );
}
