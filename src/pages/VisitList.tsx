import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { VisitorTable } from "@/components/VisitorTable";
import { useVisitors } from "@/hooks/useVisitors";
import { AddVisitDialog } from "@/components/AddVisitDialog";
import { CheckOutDialog } from "@/components/CheckOutDialog";

import { FeedbackDialog } from "@/components/FeedbackDialog";
import { NotificationBell } from "@/components/NotificationBell";
import { useKeyboardShortcuts, KeyboardShortcutBar } from "@/hooks/useKeyboardShortcuts";
import { Button } from "@/components/ui/button";
import { Plus, QrCode, LogOut, DoorOpen, ChevronLeft, ChevronRight, CalendarDays, X, Clock, Printer } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, isSameDay, addDays, subDays, isToday, isPast } from "date-fns";
import { Visitor } from "@/types/visitor";
import { VisitListQRDialog } from "@/components/VisitListQRDialog";
import { HandoverPrintDialog } from "@/components/HandoverPrintDialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function VisitList() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { visitors, addVisitor, checkOutVisitor, checkInReturn, deleteVisitor, overstayedCount } = useVisitors();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [checkOutDialogOpen, setCheckOutDialogOpen] = useState(false);
  const [residentLeaveOpen, setResidentLeaveOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [feedbackVisitor, setFeedbackVisitor] = useState<Visitor | null>(null);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [handoverOpen, setHandoverOpen] = useState(false);
  const [draftCount, setDraftCount] = useState(0);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());

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

  // Fetch draft and pending counts
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

  const filteredVisitors = useMemo(
    () => visitors.filter((v) => isSameDay(v.checkInTime, selectedDate)),
    [visitors, selectedDate]
  );

  const overdueResidents = visitors.filter(v => v.type === "resident" && v.status === "checked-out" && v.expectedReturnDate && isPast(v.expectedReturnDate)).length;

  // Apply filter to table
  const displayVisitors = useMemo(() => {
    if (!activeFilter || activeFilter === "all") return filteredVisitors;
    switch (activeFilter) {
      case "checked-in": return filteredVisitors.filter(v => v.status === "checked-in");
      case "checked-out": return filteredVisitors.filter(v => v.status === "checked-out");
      case "overstayed": return filteredVisitors.filter(v => v.status === "checked-in" && Date.now() - v.checkInTime.getTime() > 8 * 3600000);
      case "on-leave": return visitors.filter(v => v.type === "resident" && v.status === "checked-out");
      default: return filteredVisitors;
    }
  }, [filteredVisitors, visitors, activeFilter]);

  // Recent check-ins (last 5)
  const recentCheckIns = useMemo(() => {
    return filteredVisitors
      .filter(v => v.status === "checked-in")
      .sort((a, b) => b.checkInTime.getTime() - a.checkInTime.getTime())
      .slice(0, 5);
  }, [filteredVisitors]);

  const filterLabels: Record<string, string> = {
    "checked-in": "Currently Inside",
    "checked-out": "Checked Out",
    "overstayed": "Overstayed",
    "on-leave": "Residents On Leave",
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex-1">
          {/* Top bar */}
          <header className="sticky top-0 z-10 bg-card border-b border-border">
            <div className="flex items-center justify-between px-6 h-14">
              <div className="flex items-center gap-4">
                <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
                <div>
                  <h1 className="text-xl font-bold text-foreground leading-tight">Visitor List</h1>
                  <p className="text-[13px] text-muted-foreground">
                    {isToday(selectedDate) ? "Today's visits" : format(selectedDate, "EEEE, dd MMMM yyyy")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 font-mono text-muted-foreground mr-1">
                  <Clock className="h-3.5 w-3.5" />
                  <span className="text-sm font-semibold text-foreground">{format(currentTime, "HH:mm")}</span>
                </div>
                <div className="w-px h-5 bg-border" />
                <NotificationBell
                  overstayedCount={overstayedCount}
                  overdueCount={overdueResidents}
                  draftCount={draftCount}
                  pendingCount={pendingApprovals}
                />
                <div className="w-px h-5 bg-border" />
                <Button variant="outline" size="sm" className="h-[34px] text-[13px] gap-1.5 border-border" onClick={() => setHandoverOpen(true)}>
                  <Printer className="h-4 w-4" />
                  Handover
                </Button>
                <Button variant="outline" size="sm" className="h-[34px] text-[13px] gap-1.5 border-border" onClick={() => setResidentLeaveOpen(true)}>
                  <DoorOpen className="h-4 w-4" />
                  Resident Leave
                </Button>
                <Button variant="outline" size="sm" className="h-[34px] text-[13px] gap-1.5 border-border" onClick={() => setCheckOutDialogOpen(true)}>
                  <LogOut className="h-4 w-4" />
                  Check Out
                </Button>
                <Button variant="outline" size="sm" className="h-[34px] text-[13px] gap-1.5 border-border" onClick={() => setQrOpen(true)}>
                  <QrCode className="h-4 w-4" />
                  QR Check-In
                </Button>
                <Button onClick={() => setAddDialogOpen(true)} size="sm" className="h-[34px] text-[13px] gap-1.5 bg-primary hover:bg-primary/90">
                  <Plus className="h-4 w-4" />
                  New Visit
                </Button>
              </div>
            </div>
          </header>


          {/* Date Navigator */}
          <div className="border-b border-border bg-card">
            <div className="flex items-center justify-center gap-2 px-6 py-2.5">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedDate((d) => subDays(d, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center bg-muted rounded-lg p-1 gap-0.5">
                {[-2, -1, 0, 1, 2].map((offset) => {
                  const date = addDays(new Date(), offset);
                  const isSelected = isSameDay(date, selectedDate);
                  return (
                    <button
                      key={offset}
                      className={`h-7 px-3 rounded-md text-[13px] font-medium transition-all duration-150 ${
                        isSelected
                          ? "bg-card text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      onClick={() => setSelectedDate(date)}
                    >
                      {offset === 0 ? "Today" : format(date, "EEE dd")}
                    </button>
                  );
                })}
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedDate((d) => addDays(d, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <div className="w-px h-5 bg-border mx-1" />
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 text-[13px] gap-1.5 border-border">
                    <CalendarDays className="h-3.5 w-3.5" />
                    Pick Date
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="center">
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

          {/* Filter pill */}
          {activeFilter && activeFilter !== "all" && filterLabels[activeFilter] && (
            <div className="px-6 pt-3">
              <div className="inline-flex items-center gap-1.5 bg-primary/10 text-primary rounded-full px-3 py-1 text-xs font-medium">
                Filtering: {filterLabels[activeFilter]}
                <button onClick={() => setActiveFilter(null)} className="ml-1 hover:bg-primary/20 rounded-full p-0.5">
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
          )}

          {/* Recent check-ins strip */}
          {recentCheckIns.length > 0 && (
            <div className="px-6 pt-2 flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Recent:</span>
              {recentCheckIns.map((v) => (
                <div key={v.id} className="inline-flex items-center gap-1.5 bg-success/10 text-success rounded-full px-2.5 py-0.5 text-[11px] font-medium">
                  <span className="h-1.5 w-1.5 rounded-full bg-success" />
                  {v.firstName} {v.surname}
                  <span className="text-success/60">{format(v.checkInTime, "HH:mm")}</span>
                </div>
              ))}
            </div>
          )}

          {/* ZONE 3 — Table */}
          <main className="p-6 pb-16">
            <VisitorTable
              visitors={displayVisitors}
              onCheckOut={checkOutVisitor}
              onCheckInReturn={checkInReturn}
              onDelete={deleteVisitor}
              onFeedback={(v) => setFeedbackVisitor(v)}
              activeTab={activeTab}
              onTabChange={setActiveTab}
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
      <ResidentLeaveDialog open={residentLeaveOpen} onOpenChange={setResidentLeaveOpen} onSubmit={(visitor) => {
        addVisitor(visitor);
        toast({ title: "Resident Marked Away", description: `${visitor.firstName} ${visitor.surname} has been checked out.` });
      }} />
    </SidebarProvider>
  );
}
