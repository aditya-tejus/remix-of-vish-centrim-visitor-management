import { useState, useMemo, useEffect } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppHeader } from "@/components/AppHeader";
import { VisitorTable } from "@/components/VisitorTable";
import { useVisitors } from "@/hooks/useVisitors";
import { CheckInSheet } from "@/components/checkin/CheckInSheet";
import { CheckOutSheet } from "@/components/CheckOutSheet";
import { FeedbackDialog } from "@/components/FeedbackDialog";
import { useKeyboardShortcuts, KeyboardShortcutBar } from "@/hooks/useKeyboardShortcuts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus, QrCode, LogOut, ChevronLeft, ChevronRight, CalendarDays,
  X, Printer, Search, RefreshCw,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, isSameDay, addDays, subDays, isToday } from "date-fns";
import { Visitor } from "@/types/visitor";
import { useResidents } from "@/hooks/useResidents";
import { VisitListQRDialog } from "@/components/VisitListQRDialog";
import { HandoverPrintDialog } from "@/components/HandoverPrintDialog";
import { LoadingState, ErrorState, OfflineState, PermissionState } from "@/components/states";
import { useVisitViews, VisitViewKey } from "@/hooks/useVisitViews";
import { VisitViewSwitch } from "@/components/visitlist/VisitViewSwitch";
import { usePersonTypes } from "@/hooks/usePersonTypes";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useSite } from "@/contexts/SiteContext";

export default function VisitList() {
  const {
    visitors, loading, error, refresh, addVisitorAsync, checkOutVisitor,
    checkInReturn, deleteVisitor, overstayedCount, lastUpdated,
  } = useVisitors();
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [checkOutSheetOpen, setCheckOutSheetOpen] = useState(false);
  const [checkOutPreSelectedId, setCheckOutPreSelectedId] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [feedbackVisitor, setFeedbackVisitor] = useState<Visitor | null>(null);
  // Reception opens on the live picture: who is in the building right now.
  const [activeView, setActiveView] = useState<VisitViewKey>("on-site");
  // Person-type chips always start at All — a filter left on by the last shift
  // must never hide people from the next one.
  const [activeType, setActiveType] = useState<string>("all");
  const [handoverOpen, setHandoverOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [bulkCheckOutIds, setBulkCheckOutIds] = useState<string[]>([]);
  const [showDestination, setShowDestination] = useState(true);

  const { deskTypes } = usePersonTypes();
  const { can, loading: permsLoading } = usePermissions();
  const { role } = useAuth();
  const { currentSiteName } = useSite();

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", down); };
  }, []);

  // Reuse the existing destination privacy setting rather than adding another one.
  useEffect(() => {
    supabase
      .from("settings")
      .select("value")
      .eq("key", "badge_show_destination")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value !== undefined && data?.value !== null) {
          setShowDestination(String(data.value) !== "false");
        }
      });
  }, []);

  useKeyboardShortcuts({
    onNewVisit: () => setAddDialogOpen(true),
    onQuickCheckOut: () => setCheckOutSheetOpen(true),
    onQRScan: () => setQrOpen(true),
  });

  // Date-filtered visitors (non-residents only)
  const dateVisitors = useMemo(
    () => visitors
      .filter((v) => v.type !== "resident")
      .filter((v) => isSameDay(v.checkInTime, selectedDate)),
    [visitors, selectedDate]
  );

  // Search includes the resident being visited, so typing a resident's name
  // brings up everyone who came to see them.
  const { residents } = useResidents();
  const residentNameById = useMemo(() => {
    const map: Record<string, string> = {};
    residents.forEach((r) => { map[r.visitorId] = `${r.name} ${r.room} ${r.wing}`.toLowerCase(); });
    return map;
  }, [residents]);

  const searchedVisitors = useMemo(() => {
    if (!searchQuery.trim()) return dateVisitors;
    const q = searchQuery.toLowerCase();
    return dateVisitors.filter((v) =>
      `${v.firstName} ${v.surname}`.toLowerCase().includes(q) ||
      v.mobile.toLowerCase().includes(q) ||
      (v.whomToVisit || "").toLowerCase().includes(q) ||
      (v.email || "").toLowerCase().includes(q) ||
      (v.visitedResidentIds || []).some((id) => (residentNameById[id] || "").includes(q))
    );
  }, [dateVisitors, searchQuery, residentNameById]);

  const typeVisitors = useMemo(
    () => (activeType === "all" ? searchedVisitors : searchedVisitors.filter((v) => v.type === activeType)),
    [searchedVisitors, activeType]
  );

  // "Expected back" only exists where residents are tracked away with a return time.
  const scheduledAvailable = useMemo(
    () => visitors.some((v) => v.type === "resident"),
    [visitors]
  );

  const { views, rowsFor } = useVisitViews({
    dayVisitors: typeVisitors,
    allVisitors: visitors,
    selectedDate,
    scheduledAvailable,
  });

  const currentView = views.find((v) => v.key === activeView) ?? views[0];
  const rows = rowsFor(currentView.key);

  const typeChips = useMemo(
    () => [
      { value: "all", label: "All" },
      ...deskTypes.map((t) => ({ value: t.type, label: t.label })),
    ],
    [deskTypes]
  );

  const countForType = (type: string) =>
    type === "all" ? searchedVisitors.length : searchedVisitors.filter((v) => v.type === type).length;

  const handleCheckOutFromTable = (visitorId: string) => {
    setCheckOutPreSelectedId(visitorId);
    setCheckOutSheetOpen(true);
  };

  const handleCheckOutMany = (ids: string[]) => {
    setBulkCheckOutIds(ids);
    setCheckOutSheetOpen(true);
  };

  const canView = permsLoading || can("presence.view");
  const canCheckIn = permsLoading || can("checkin.create");
  const canCheckOut = permsLoading || can("checkout.perform");
  const canExport = can("data.export");
  const canDelete = role === "admin";

  const searchEmpty = searchQuery.trim().length > 0 && rows.length === 0;

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex-1 min-w-0">
          <AppHeader title="Visitor List" overstayedCount={overstayedCount} />

          {/* Page command bar */}
          <div className="sticky top-12 z-[9] border-b border-border bg-card/95 backdrop-blur-sm">
            <div className="flex flex-wrap items-center justify-between px-4 sm:px-6 py-2.5 gap-y-2 gap-x-4">
              {/* Left: which site and which day */}
              <div className="flex items-center gap-3 shrink-0 min-w-0">
                <div className="flex flex-col min-w-0">
                  <span className="text-[13px] font-medium text-foreground truncate">
                    {currentSiteName || "This site"}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {format(selectedDate, "EEE, dd MMM yyyy")}
                    {!isToday(selectedDate) && " · not today"}
                  </span>
                </div>
                <div className="flex items-center gap-0.5">
                  <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Previous day" onClick={() => setSelectedDate(d => subDays(d, 1))}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  {!isToday(selectedDate) && (
                    <Button variant="ghost" size="sm" className="h-8 text-[12px] px-2" onClick={() => setSelectedDate(new Date())}>
                      Today
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Next day" onClick={() => setSelectedDate(d => addDays(d, 1))}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Pick a date">
                        <CalendarDays className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={selectedDate} onSelect={(date) => date && setSelectedDate(date)} initialFocus />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Centre: search */}
              <div className="relative order-last sm:order-none w-full sm:w-auto sm:flex-1 min-w-0 sm:max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                <Input
                  aria-label="Search visits"
                  placeholder="Search name, phone, or who they are visiting"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 pl-9 text-[13px] bg-muted/50 border-transparent focus:border-border focus:bg-card"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    aria-label="Clear search"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Right: primary action first, supporting actions after */}
              <div className="flex items-center gap-1.5 shrink-0">
                {canCheckIn && (
                  <Button onClick={() => setAddDialogOpen(true)} size="sm" className="h-9 text-[13px] gap-1.5 px-4 shadow-sm">
                    <Plus className="h-4 w-4" aria-hidden />
                    Check In
                  </Button>
                )}
                {canCheckOut && (
                  <Button variant="ghost" size="sm" className="h-9 text-[13px] gap-1.5 text-muted-foreground" onClick={() => setCheckOutSheetOpen(true)}>
                    <LogOut className="h-4 w-4" aria-hidden />
                    <span className="hidden xl:inline">Check Out</span>
                  </Button>
                )}
                <Button variant="ghost" size="sm" className="h-9 text-[13px] gap-1.5 text-muted-foreground" onClick={() => setQrOpen(true)}>
                  <QrCode className="h-4 w-4" aria-hidden />
                  <span className="hidden xl:inline">QR</span>
                </Button>
                <Button variant="ghost" size="sm" className="h-9 text-[13px] gap-1.5 text-muted-foreground" onClick={() => setHandoverOpen(true)}>
                  <Printer className="h-4 w-4" aria-hidden />
                  <span className="hidden xl:inline">Handover</span>
                </Button>
              </div>
            </div>
          </div>

          {/* One switch decides what the list shows */}
          <VisitViewSwitch views={views} active={currentView.key} onChange={setActiveView} />

          {/* Person-type chips, always starting at All */}
          <div className="flex items-center gap-2 overflow-x-auto px-4 sm:px-6 py-2">
            {typeChips.map((chip) => (
              <button
                key={chip.value}
                onClick={() => setActiveType(chip.value)}
                aria-pressed={activeType === chip.value}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors ${
                  activeType === chip.value
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {chip.label} <span className="tabular-nums">{countForType(chip.value)}</span>
              </button>
            ))}
            <div className="ml-auto hidden sm:flex items-center gap-2 text-[11px] text-muted-foreground">
              {lastUpdated && <span>Updated {format(lastUpdated, "hh:mm a")}</span>}
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Refresh list" onClick={() => refresh()}>
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <main className="px-4 sm:px-6 pb-16 pt-1 min-w-0">
            {!canView ? (
              <PermissionState description="You do not have permission to see who is on site. Ask an administrator if you need this." />
            ) : !online ? (
              <OfflineState description="You are offline. The list below may be out of date — check-ins will save once the connection returns." />
            ) : loading && visitors.length === 0 ? (
              <LoadingState rows={6} label="Loading today's visits" />
            ) : error ? (
              <ErrorState description={error} action={<Button variant="outline" onClick={() => refresh()}>Try again</Button>} />
            ) : (
              <VisitorTable
                visitors={rows}
                onCheckOut={handleCheckOutFromTable}
                onCheckOutMany={handleCheckOutMany}
                onCheckInReturn={checkInReturn}
                onDelete={deleteVisitor}
                onFeedback={(v) => setFeedbackVisitor(v)}
                personType={activeType}
                emptyTitle={searchEmpty ? "No matches" : currentView.emptyTitle}
                emptyDescription={
                  searchEmpty
                    ? `Nothing on this day matches "${searchQuery}". Try a different spelling, or clear the search.`
                    : currentView.emptyDescription
                }
                canCheckOut={canCheckOut}
                canExport={canExport}
                canDelete={canDelete}
                showDestination={showDestination}
              />
            )}
          </main>

          <KeyboardShortcutBar />
        </SidebarInset>
      </div>

      <CheckInSheet open={addDialogOpen} onOpenChange={setAddDialogOpen} onAdd={addVisitorAsync} />
      <CheckOutSheet
        open={checkOutSheetOpen}
        onOpenChange={setCheckOutSheetOpen}
        visitors={visitors}
        onCheckOut={checkOutVisitor}
        preSelectedVisitorId={checkOutPreSelectedId}
        onPreSelectedClear={() => { setCheckOutPreSelectedId(null); setBulkCheckOutIds([]); }}
        bulkVisitorIds={bulkCheckOutIds}
      />
      {feedbackVisitor && (
        <FeedbackDialog
          open={!!feedbackVisitor}
          onOpenChange={(open) => !open && setFeedbackVisitor(null)}
          visitorId={feedbackVisitor.id}
          visitorName={`${feedbackVisitor.firstName} ${feedbackVisitor.surname}`}
          visitorType={feedbackVisitor.type}
        />
      )}
      <VisitListQRDialog open={qrOpen} onOpenChange={setQrOpen} />
      <HandoverPrintDialog open={handoverOpen} onOpenChange={setHandoverOpen} visitors={dateVisitors} date={selectedDate} />
    </SidebarProvider>
  );
}
