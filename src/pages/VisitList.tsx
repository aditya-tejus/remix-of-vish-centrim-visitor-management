import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { VisitorTable } from "@/components/VisitorTable";
import { useVisitors } from "@/hooks/useVisitors";
import { AddVisitDialog } from "@/components/AddVisitDialog";
import { CheckOutDialog } from "@/components/CheckOutDialog";
import { FeedbackDialog } from "@/components/FeedbackDialog";
import { useKeyboardShortcuts, KeyboardShortcutBar } from "@/hooks/useKeyboardShortcuts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus, QrCode, LogOut, ChevronLeft, ChevronRight, CalendarDays,
  X, Clock, Printer, Search, Users, AlertTriangle, LogIn,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, isSameDay, addDays, subDays, isToday } from "date-fns";
import { Visitor } from "@/types/visitor";
import { VisitListQRDialog } from "@/components/VisitListQRDialog";
import { HandoverPrintDialog } from "@/components/HandoverPrintDialog";

export default function VisitList() {
  const navigate = useNavigate();
  const { visitors, addVisitor, checkOutVisitor, checkInReturn, deleteVisitor, overstayedCount } = useVisitors();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [checkOutDialogOpen, setCheckOutDialogOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [feedbackVisitor, setFeedbackVisitor] = useState<Visitor | null>(null);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [handoverOpen, setHandoverOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState("");

  // Live clock
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onNewVisit: () => setAddDialogOpen(true),
    onQuickCheckOut: () => setCheckOutDialogOpen(true),
    onQRScan: () => setQrOpen(true),
  });

  // Date-filtered visitors (non-residents only)
  const filteredVisitors = useMemo(
    () => visitors
      .filter((v) => v.type !== "resident")
      .filter((v) => isSameDay(v.checkInTime, selectedDate)),
    [visitors, selectedDate]
  );

  // Search filter
  const searchedVisitors = useMemo(() => {
    if (!searchQuery.trim()) return filteredVisitors;
    const q = searchQuery.toLowerCase();
    return filteredVisitors.filter((v) =>
      `${v.firstName} ${v.surname}`.toLowerCase().includes(q) ||
      v.mobile.toLowerCase().includes(q) ||
      (v.whomToVisit || "").toLowerCase().includes(q) ||
      (v.email || "").toLowerCase().includes(q)
    );
  }, [filteredVisitors, searchQuery]);

  // Status filter from stat cards / TabContextStats
  const displayVisitors = useMemo(() => {
    if (!activeFilter || activeFilter === "all") return searchedVisitors;
    switch (activeFilter) {
      case "checked-in": return searchedVisitors.filter(v => v.status === "checked-in");
      case "checked-out": return searchedVisitors.filter(v => v.status === "checked-out");
      case "overstayed": return searchedVisitors.filter(v => v.status === "checked-in" && Date.now() - v.checkInTime.getTime() > 8 * 3600000);
      default: return searchedVisitors;
    }
  }, [searchedVisitors, activeFilter]);

  // Summary counts for cards
  const totalToday = filteredVisitors.length;
  const activeCount = filteredVisitors.filter(v => v.status === "checked-in").length;
  const overstayedToday = filteredVisitors.filter(v => v.status === "checked-in" && Date.now() - v.checkInTime.getTime() > 8 * 3600000).length;

  const filterLabels: Record<string, string> = {
    "checked-in": "Active / On-site",
    "checked-out": "Checked Out",
    "overstayed": "Overstayed",
  };

  const handleStatCardClick = (key: string) => {
    setActiveFilter(prev => prev === key ? null : key);
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex-1">
          {/* ZONE A — Shell header (slim, generic) */}
          <header className="sticky top-0 z-10 bg-card border-b border-border">
            <div className="flex items-center px-6 h-12">
              <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
              <h1 className="text-lg font-bold text-foreground ml-4">Visitor List</h1>
            </div>
          </header>

          {/* ZONE B — Page command bar */}
          <div className="sticky top-12 z-[9] border-b border-border bg-card/95 backdrop-blur-sm">
            <div className="flex items-center justify-between px-6 py-2.5 gap-4">
              {/* Left: clock + date nav */}
              <div className="flex items-center gap-3 shrink-0">
                <div className="flex items-center gap-1.5 font-mono">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm font-semibold text-foreground tabular-nums">{format(currentTime, "HH:mm")}</span>
                </div>
                <div className="w-px h-4 bg-border" />
                <span className="text-[13px] text-muted-foreground font-medium">
                  {format(selectedDate, "EEE, dd MMM yyyy")}
                </span>
                <div className="flex items-center gap-0.5">
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelectedDate(d => subDays(d, 1))}>
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  {!isToday(selectedDate) && (
                    <Button variant="ghost" size="sm" className="h-6 text-[11px] px-2" onClick={() => setSelectedDate(new Date())}>
                      Today
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelectedDate(d => addDays(d, 1))}>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        <CalendarDays className="h-3.5 w-3.5" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={(date) => date && setSelectedDate(date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Centre: search */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search by name, phone, or visiting..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-9 text-[13px] bg-muted/50 border-transparent focus:border-border focus:bg-card"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Right: actions */}
              <div className="flex items-center gap-1.5 shrink-0">
                <Button variant="ghost" size="sm" className="h-8 text-[12px] gap-1.5 text-muted-foreground" onClick={() => setHandoverOpen(true)}>
                  <Printer className="h-3.5 w-3.5" />
                  <span className="hidden xl:inline">Handover</span>
                </Button>
                <Button variant="ghost" size="sm" className="h-8 text-[12px] gap-1.5 text-muted-foreground" onClick={() => setCheckOutDialogOpen(true)}>
                  <LogOut className="h-3.5 w-3.5" />
                  <span className="hidden xl:inline">Check Out</span>
                </Button>
                <Button variant="ghost" size="sm" className="h-8 text-[12px] gap-1.5 text-muted-foreground" onClick={() => setQrOpen(true)}>
                  <QrCode className="h-3.5 w-3.5" />
                  <span className="hidden xl:inline">QR</span>
                </Button>
                <Button onClick={() => setAddDialogOpen(true)} size="sm" className="h-8 text-[12px] gap-1.5 bg-primary hover:bg-primary/90 shadow-sm">
                  <Plus className="h-3.5 w-3.5" />
                  New Visit
                </Button>
              </div>
            </div>
          </div>

          {/* ZONE C — Summary count cards */}
          <div className="px-6 pt-4 pb-2">
            <div className="grid grid-cols-3 gap-3">
              {/* All Today */}
              <button
                onClick={() => handleStatCardClick("all")}
                className={`rounded-lg border p-3.5 text-left transition-all duration-150 hover:shadow-sm ${
                  !activeFilter || activeFilter === "all"
                    ? "border-border bg-card"
                    : "border-transparent bg-muted/40 hover:bg-muted/60"
                }`}
              >
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Users className="h-4 w-4" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider">All Today</span>
                </div>
                <p className="text-2xl font-bold text-foreground tabular-nums">{totalToday}</p>
              </button>

              {/* Active / On-site */}
              <button
                onClick={() => handleStatCardClick("checked-in")}
                className={`rounded-lg border p-3.5 text-left transition-all duration-150 hover:shadow-sm ${
                  activeFilter === "checked-in"
                    ? "border-primary/30 bg-primary/5 ring-1 ring-primary/20"
                    : "border-transparent bg-muted/40 hover:bg-muted/60"
                }`}
              >
                <div className="flex items-center gap-2 text-success mb-1">
                  <LogIn className="h-4 w-4" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider">Active</span>
                </div>
                <p className="text-2xl font-bold text-foreground tabular-nums">{activeCount}</p>
              </button>

              {/* Overstayed */}
              <button
                onClick={() => handleStatCardClick("overstayed")}
                className={`rounded-lg border p-3.5 text-left transition-all duration-150 hover:shadow-sm ${
                  activeFilter === "overstayed"
                    ? "border-destructive/30 bg-destructive/5 ring-1 ring-destructive/20"
                    : "border-transparent bg-muted/40 hover:bg-muted/60"
                }`}
              >
                <div className="flex items-center gap-2 text-destructive mb-1">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider">Overstayed</span>
                  {overstayedToday > 0 && (
                    <span className="relative flex h-1.5 w-1.5 ml-auto">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-destructive" />
                    </span>
                  )}
                </div>
                <p className={`text-2xl font-bold tabular-nums ${overstayedToday > 0 ? "text-destructive" : "text-foreground"}`}>{overstayedToday}</p>
              </button>
            </div>
          </div>

          {/* Filter pill */}
          {activeFilter && activeFilter !== "all" && filterLabels[activeFilter] && (
            <div className="px-6 pb-1">
              <div className="inline-flex items-center gap-1.5 bg-primary/10 text-primary rounded-full px-3 py-1 text-xs font-medium">
                Filtering: {filterLabels[activeFilter]}
                <button onClick={() => setActiveFilter(null)} className="ml-1 hover:bg-primary/20 rounded-full p-0.5">
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
          )}

          {/* ZONE D — Table */}
          <main className="px-6 pb-16 pt-2">
            <VisitorTable
              visitors={displayVisitors}
              onCheckOut={checkOutVisitor}
              onCheckInReturn={checkInReturn}
              onDelete={deleteVisitor}
              onFeedback={(v) => setFeedbackVisitor(v)}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              onFilter={setActiveFilter}
              activeFilter={activeFilter}
            />
          </main>

          <KeyboardShortcutBar />
        </SidebarInset>
      </div>

      <AddVisitDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} onAdd={addVisitor} />
      <CheckOutDialog open={checkOutDialogOpen} onOpenChange={setCheckOutDialogOpen} visitors={visitors} onCheckOut={checkOutVisitor} />
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
      <HandoverPrintDialog open={handoverOpen} onOpenChange={setHandoverOpen} visitors={filteredVisitors} date={selectedDate} />
    </SidebarProvider>
  );
}
