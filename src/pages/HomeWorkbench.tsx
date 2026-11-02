import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { useVisitors } from "@/hooks/useVisitors";
import { CheckInSheet } from "@/components/checkin/CheckInSheet";
import { CheckOutSheet } from "@/components/CheckOutSheet";
import { ResidentOutingDialog } from "@/components/ResidentOutingDialog";

import { ActiveNowList } from "@/components/workbench/ActiveNowList";
import { PracticeDataNotice } from "@/components/PracticeDataNotice";
import { DayGroupedHistory } from "@/components/workbench/DayGroupedHistory";
import { Button } from "@/components/ui/button";
import { AttentionRow, StatTile } from "@/components/ui/reception-primitives";
import { UserPlus, LogOut, DoorOpen, Clock, Users, AlertTriangle, ShieldAlert } from "lucide-react";
import { useOccupancy } from "@/hooks/useOccupancy";
import { useOutbreakMode } from "@/hooks/useOutbreakMode";
import { format, isPast } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Visitor } from "@/types/visitor";

export default function HomeWorkbench() {
  const navigate = useNavigate();
  const { visitors, addVisitorAsync, checkOutVisitor, checkInReturn, overstayedCount, markResidentAway } = useVisitors();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [checkOutDialogOpen, setCheckOutDialogOpen] = useState(false);
  const [residentLeaveOpen, setResidentLeaveOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [draftCount, setDraftCount] = useState(0);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const { count: onSiteCount, cap, atLimit, nearLimit } = useOccupancy();
  const { enabled: outbreakMode } = useOutbreakMode();

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
    // Residents live here: a resident at home is not "on site" as a visitor.
    () => visitors.filter((v) => v.type !== "resident" && v.status === "checked-in"),
    [visitors]
  );

  const checkedOutVisitors = useMemo(
    () => visitors.filter((v) => v.type !== "resident" && v.status === "checked-out"),
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
    <>
    <AppShell
            title="Today"
            eyebrow={format(currentTime, "EEEE d MMMM yyyy")}
            subtitle="What needs doing at reception right now."
            actions={<>
              <Button onClick={() => setAddDialogOpen(true)} className="gap-2"><UserPlus aria-hidden className="h-4 w-4" />Check in</Button>
              <Button variant="outline" onClick={() => setCheckOutDialogOpen(true)} className="gap-2"><LogOut aria-hidden className="h-4 w-4" />Check out</Button>
              <Button variant="outline" onClick={() => setResidentLeaveOpen(true)} className="gap-2"><DoorOpen aria-hidden className="h-4 w-4" />Record outing</Button>
            </>}
            headerContent={
              <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
                <StatTile label="On site now" value={activeVisitors.length} icon={Users} className="bg-secondary/60 shadow-none" />
                <StatTile label="Checked out" value={checkedOutVisitors.length} icon={LogOut} className="bg-secondary/60 shadow-none" />
                <StatTile label="Residents out" value={residentsOnLeave} icon={DoorOpen} className="bg-secondary/60 shadow-none" />
                <StatTile label="Past expected time" value={overstayedCount} icon={Clock} tone={overstayedCount > 0 ? "attention" : "neutral"} className={overstayedCount > 0 ? "shadow-none" : "bg-secondary/60 shadow-none"} />
              </div>
            }
            overstayedCount={overstayedCount}
            overdueCount={overdueResidents}
            draftCount={draftCount}
            pendingCount={pendingApprovals}
            mainClassName="p-4 sm:p-6 space-y-5 max-w-[1600px] w-full mx-auto"
          >
            <PracticeDataNotice />

            {/* Outbreak Mode banner */}
            {outbreakMode && (
              <div className="flex items-start gap-3 rounded-card border border-destructive/30 bg-destructive/5 p-4">
                <ShieldAlert className="h-5 w-5 text-destructive-strong shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-destructive-strong">Outbreak Mode is on</p>
                  <p className="text-[13px] text-muted-foreground mt-0.5">
                    Self check-in at the kiosk is blocked for anyone reporting symptoms or a temperature above 37.8&deg;C.
                    They are asked to see a staff member, and reception is alerted. An admin can turn this off from the header.
                  </p>
                </div>
              </div>
            )}

            {/* Live occupancy */}
            {cap !== null && (
              <div
                className={`flex items-center justify-between gap-4 rounded-card border p-4 ${
                  atLimit
                    ? "border-destructive/30 bg-destructive/5"
                    : nearLimit
                    ? "border-warning/30 bg-warning/5"
                    : "border-border bg-card"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full ${
                      atLimit ? "bg-destructive/10 text-destructive-strong" : nearLimit ? "bg-warning/10 text-warning-strong" : "bg-primary/10 text-primary"
                    }`}
                  >
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {atLimit
                        ? "Visitor limit reached"
                        : nearLimit
                        ? "Approaching the visitor limit"
                        : "Visitors on site"}
                    </p>
                    <p className="text-[13px] text-muted-foreground">
                      {atLimit
                        ? "No further visitors should be admitted until someone leaves."
                        : nearLimit
                        ? "Only a few places left before the limit is reached."
                        : "Live count against the maximum set in Settings."}
                    </p>
                  </div>
                </div>
                <p
                  className={`text-2xl font-bold tabular-nums ${
                    atLimit ? "text-destructive-strong" : nearLimit ? "text-warning-strong" : "text-foreground"
                  }`}
                >
                  {onSiteCount} / {cap}
                </p>
              </div>
            )}

            {/* Needs attention */}
            <section aria-labelledby="attention-title" className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id="attention-title" className="text-lg font-extrabold text-foreground">Needs attention</h2>
                <Button variant="destructive-outline" onClick={() => navigate("/evacuation")} className="gap-2">
                  <ShieldAlert className="h-4 w-4" aria-hidden="true" /> Emergency roll call
                </Button>
              </div>
              <ul className="mt-2 divide-y divide-border">
                {[
                  { label: "Visitors still on site past their expected time", count: overstayedCount, path: "/visit-list" },
                  { label: "Residents overdue back from an outing", count: overdueResidents, path: "/residents?view=expected" },
                  { label: "Leave requests waiting for approval", count: pendingApprovals, path: "/residents" },
                ].map((row) => (
                  <li key={row.label}>
                    <AttentionRow label={row.label} count={row.count} onClick={() => navigate(row.path)} />
                  </li>
                ))}
              </ul>
              {overstayedCount === 0 && overdueResidents === 0 && pendingApprovals === 0 && (
                <p className="py-1 text-sm text-muted-foreground">Nothing outstanding right now.</p>
              )}
            </section>

            {/* Two-column layout: Active Now + History */}
            <div className="space-y-6">
              {/* Active Now — pinned, wider */}
              <div className="min-w-0">
                <ActiveNowList
                  visitors={activeVisitors}
                  onCheckOut={checkOutVisitor}
                  onViewAll={() => navigate("/visit-list")}
                />
              </div>

              {/* Day-grouped history */}
              <div className="min-w-0">
                <DayGroupedHistory visitors={visitors} />
              </div>
            </div>
    </AppShell>

      <CheckInSheet open={addDialogOpen} onOpenChange={setAddDialogOpen} onAdd={addVisitorAsync} />
      <CheckOutSheet open={checkOutDialogOpen} onOpenChange={setCheckOutDialogOpen} visitors={visitors} onCheckOut={checkOutVisitor} />
      <ResidentOutingDialog open={residentLeaveOpen} onOpenChange={setResidentLeaveOpen} onMarkAway={markResidentAway} />
    </>
  );
}
