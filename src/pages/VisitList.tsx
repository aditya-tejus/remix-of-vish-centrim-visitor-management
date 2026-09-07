import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
  X, Printer, Search,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, isSameDay, addDays, subDays, isToday } from "date-fns";
import { Visitor } from "@/types/visitor";
import { useOverstayPolicy } from "@/hooks/useOverstayPolicy";
import { VisitListQRDialog } from "@/components/VisitListQRDialog";
import { HandoverPrintDialog } from "@/components/HandoverPrintDialog";

export default function VisitList() {
  const navigate = useNavigate();
  const { visitors, addVisitor, checkOutVisitor, checkInReturn, deleteVisitor, overstayedCount } = useVisitors();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [checkOutSheetOpen, setCheckOutSheetOpen] = useState(false);
  const [checkOutPreSelectedId, setCheckOutPreSelectedId] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [feedbackVisitor, setFeedbackVisitor] = useState<Visitor | null>(null);
  // Reception opens on the live picture: who is in the building right now.
  const [activeFilter, setActiveFilter] = useState<string | null>("checked-in");
  const [activeTab, setActiveTab] = useState<string>("all");
  const [handoverOpen, setHandoverOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [bulkCheckOutIds, setBulkCheckOutIds] = useState<string[]>([]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onNewVisit: () => setAddDialogOpen(true),
    onQuickCheckOut: () => setCheckOutSheetOpen(true),
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

  const { isOverstayed } = useOverstayPolicy();

  // Status filter from the counter row
  const displayVisitors = useMemo(() => {
    if (!activeFilter || activeFilter === "all") return searchedVisitors;
    switch (activeFilter) {
      case "checked-in": return searchedVisitors.filter(v => v.status === "checked-in");
      case "checked-out": return searchedVisitors.filter(v => v.status === "checked-out");
      case "overstayed": return searchedVisitors.filter(isOverstayed);
      default: return searchedVisitors;
    }
  }, [searchedVisitors, activeFilter, isOverstayed]);

  const filterLabels: Record<string, string> = {
    "checked-in": "On site now",
    "checked-out": "Left today",
    "overstayed": "Overdue",
  };

  const handleStatCardClick = (key: string) => {
    setActiveFilter(prev => prev === key ? null : key);
  };

  const handleCheckOutFromTable = (visitorId: string) => {
    setCheckOutPreSelectedId(visitorId);
    setCheckOutSheetOpen(true);
  };

  const handleCheckOutMany = (ids: string[]) => {
    setBulkCheckOutIds(ids);
    setCheckOutSheetOpen(true);
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex-1">
          <AppHeader
            title="Visitor List"
            overstayedCount={overstayedCount}
          />

          {/* ZONE B — Page command bar */}
          <div className="sticky top-12 z-[9] border-b border-border bg-card/95 backdrop-blur-sm">
            <div className="flex items-center justify-between px-6 py-2.5 gap-4">
              {/* Left: clock + date nav */}
              <div className="flex items-center gap-3 shrink-0">
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
                <Button onClick={() => setAddDialogOpen(true)} size="sm" className="h-8 text-[13px] gap-1.5 px-4 bg-primary hover:bg-primary/90 shadow-sm">
                  <Plus className="h-3.5 w-3.5" />
                  Check In
                </Button>
                <Button variant="ghost" size="sm" className="h-8 text-[13px] gap-1.5 text-muted-foreground" onClick={() => setCheckOutSheetOpen(true)}>
                  <LogOut className="h-3.5 w-3.5" />
                  <span className="hidden xl:inline">Check Out</span>
                </Button>
                <Button variant="ghost" size="sm" className="h-8 text-[13px] gap-1.5 text-muted-foreground" onClick={() => setQrOpen(true)}>
                  <QrCode className="h-3.5 w-3.5" />
                  <span className="hidden xl:inline">QR</span>
                </Button>
                <Button variant="ghost" size="sm" className="h-8 text-[13px] gap-1.5 text-muted-foreground" onClick={() => setHandoverOpen(true)}>
                  <Printer className="h-3.5 w-3.5" />
                  <span className="hidden xl:inline">Handover</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Counters — the live picture, readable the moment the page opens */}
          <TabContextStats
            variant="cards"
            tab={activeTab}
            visitors={tabVisitors}
            allVisitors={searchedVisitors}
            onFilter={handleStatCardClick}
            activeFilter={activeFilter}
          />

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
              onCheckOut={handleCheckOutFromTable}
              onCheckOutMany={handleCheckOutMany}
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

      <CheckInSheet open={addDialogOpen} onOpenChange={setAddDialogOpen} onAdd={addVisitor} />
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
      <HandoverPrintDialog open={handoverOpen} onOpenChange={setHandoverOpen} visitors={filteredVisitors} date={selectedDate} />
    </SidebarProvider>
  );
}
