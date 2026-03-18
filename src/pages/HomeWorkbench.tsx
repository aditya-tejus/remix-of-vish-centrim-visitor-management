import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppHeader } from "@/components/AppHeader";
import { useVisitors } from "@/hooks/useVisitors";
import { AddVisitDialog } from "@/components/AddVisitDialog";
import { CheckOutSheet } from "@/components/CheckOutSheet";
import { ResidentOutingDialog } from "@/components/ResidentOutingDialog";

import { ActiveNowList } from "@/components/workbench/ActiveNowList";
import { DayGroupedHistory } from "@/components/workbench/DayGroupedHistory";
import { Button } from "@/components/ui/button";
import { UserPlus, LogOut, DoorOpen, Clock, Users, AlertTriangle } from "lucide-react";
import { format, isPast } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Visitor } from "@/types/visitor";

export default function HomeWorkbench() {
  const navigate = useNavigate();
  const { visitors, addVisitor, checkOutVisitor, checkInReturn, overstayedCount } = useVisitors();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [checkOutDialogOpen, setCheckOutDialogOpen] = useState(false);
  const [residentLeaveOpen, setResidentLeaveOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [draftCount, setDraftCount] = useState(0);
  const [pendingApprovals, setPendingApprovals] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

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

  const activeVisitors = useMemo(
    () => visitors.filter((v) => v.status === "checked-in"),
    [visitors]
  );

  const checkedOutVisitors = useMemo(
    () => visitors.filter((v) => v.status === "checked-out"),
    [visitors]
  );

  const residentsOnLeave = useMemo(
    () => visitors.filter((v) => v.type === "resident" && v.status === "checked-out").length,
    [visitors]
  );

  const overdueResidents = useMemo(
    () => visitors.filter((v) => v.type === "resident" && v.status === "checked-out" && v.expectedReturnDate && isPast(v.expectedReturnDate)).length,
    [visitors]
  );

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex-1">
          <AppHeader
            title="Home"
            subtitle={format(currentTime, "EEEE, dd MMMM yyyy")}
            overstayedCount={overstayedCount}
            overdueCount={overdueResidents}
            draftCount={draftCount}
            pendingCount={pendingApprovals}
          />

          <main className="p-6 space-y-6">
            {/* 3 Big Action Buttons */}
            <section>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  onClick={() => setAddDialogOpen(true)}
                  className="group relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-border bg-card p-8 min-h-[160px] transition-all duration-200 hover:border-primary hover:shadow-md active:scale-[0.98]"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <UserPlus className="h-7 w-7" />
                  </div>
                  <span className="text-lg font-semibold text-foreground">Check-In</span>
                  <span className="text-[13px] text-muted-foreground">Register a visitor, contractor or volunteer</span>
                </button>

                <button
                  onClick={() => setCheckOutDialogOpen(true)}
                  className="group relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-border bg-card p-8 min-h-[160px] transition-all duration-200 hover:border-warning hover:shadow-md active:scale-[0.98]"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-warning/10 text-warning transition-colors group-hover:bg-warning group-hover:text-warning-foreground">
                    <LogOut className="h-7 w-7" />
                  </div>
                  <span className="text-lg font-semibold text-foreground">Check-Out</span>
                  <span className="text-[13px] text-muted-foreground">Sign out a visitor or mark departure</span>
                </button>

                <button
                  onClick={() => setResidentLeaveOpen(true)}
                  className="group relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-border bg-card p-8 min-h-[160px] transition-all duration-200 hover:border-info hover:shadow-md active:scale-[0.98]"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-info/10 text-info transition-colors group-hover:bg-info group-hover:text-info-foreground">
                    <DoorOpen className="h-7 w-7" />
                  </div>
                  <span className="text-lg font-semibold text-foreground">Resident Leave</span>
                  <span className="text-[13px] text-muted-foreground">Manage resident departures & returns</span>
                  {residentsOnLeave > 0 && (
                    <span className="absolute top-3 right-3 flex h-6 min-w-[24px] items-center justify-center rounded-full bg-info text-info-foreground text-xs font-bold px-1.5">
                      {residentsOnLeave}
                    </span>
                  )}
                </button>
              </div>
            </section>

            {/* Summary cards */}
            <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Users className="h-4 w-4" />
                  <span className="text-[12px] font-medium uppercase tracking-wider">On-Site Now</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{activeVisitors.length}</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <LogOut className="h-4 w-4" />
                  <span className="text-[12px] font-medium uppercase tracking-wider">Checked Out</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{checkedOutVisitors.length}</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <DoorOpen className="h-4 w-4" />
                  <span className="text-[12px] font-medium uppercase tracking-wider">On Leave</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{residentsOnLeave}</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-[12px] font-medium uppercase tracking-wider">Overstayed</span>
                </div>
                <p className={`text-2xl font-bold ${overstayedCount > 0 ? "text-destructive" : "text-foreground"}`}>{overstayedCount}</p>
              </div>
            </section>

            {/* Two-column layout: Active Now + History */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              {/* Active Now — pinned, wider */}
              <div className="lg:col-span-3">
                <ActiveNowList
                  visitors={activeVisitors}
                  onCheckOut={checkOutVisitor}
                  onViewAll={() => navigate("/visit-list")}
                />
              </div>

              {/* Day-grouped history */}
              <div className="lg:col-span-2">
                <DayGroupedHistory visitors={visitors} />
              </div>
            </div>
          </main>
        </SidebarInset>
      </div>

      <AddVisitDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} onAdd={addVisitor} />
      <CheckOutSheet open={checkOutDialogOpen} onOpenChange={setCheckOutDialogOpen} visitors={visitors} onCheckOut={checkOutVisitor} />
      <ResidentLeaveDialog open={residentLeaveOpen} onOpenChange={setResidentLeaveOpen} onSubmit={addVisitor} />
    </SidebarProvider>
  );
}
