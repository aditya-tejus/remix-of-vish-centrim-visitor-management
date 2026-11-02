import { useState, useMemo, useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { useAttendance } from "@/hooks/useAttendance";
import { PresenceList } from "@/components/visitlist/PresenceList";
import { VisitorProfile } from "@/components/VisitorProfile";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useVisitors } from "@/hooks/useVisitors";
import { CheckInSheet } from "@/components/checkin/CheckInSheet";
import { CheckOutSheet } from "@/components/CheckOutSheet";
import { FeedbackDialog } from "@/components/FeedbackDialog";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus, QrCode, LogOut, ChevronLeft, ChevronRight, CalendarDays,
  X, Printer, Search, RefreshCw, LogIn, AlertTriangle, History, Home,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, isSameDay, addDays, subDays, isToday } from "date-fns";
import { Visitor } from "@/types/visitor";
import { useResidents } from "@/hooks/useResidents";
import { VisitListQRDialog } from "@/components/VisitListQRDialog";
import { HandoverPrintDialog } from "@/components/HandoverPrintDialog";
import { LoadingState, ErrorState, OfflineState, PermissionDeniedState } from "@/components/states";
import { useVisitViews, VisitViewKey } from "@/hooks/useVisitViews";
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

  // Companions are individually accountable people on the same visit.
  const { parties, checkOutPeople } = useAttendance();

  const handleCheckOutCompanion = async (partyId: string) => {
    try {
      await checkOutPeople([partyId]);
      refresh();
    } catch {
      /* the list keeps showing them on site until the sign-out succeeds */
    }
  };
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
  const [profileVisitor, setProfileVisitor] = useState<Visitor | null>(null);
  const navigate = useNavigate();

  const { deskTypes } = usePersonTypes();
  const { can, loading: permsLoading } = usePermissions();
  const { role } = useAuth();
  const { currentSite } = useSite();

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

  // Everyone at this site who is not a resident, regardless of arrival day.
  // The live views ("On site now", "Overdue") use this so that anyone still
  // signed in from an earlier day never disappears from the desk's list.
  const liveCandidates = useMemo(
    () => visitors.filter((v) => v.type !== "resident"),
    [visitors]
  );

  // Date-filtered visitors (non-residents only) for the historical views
  const dateVisitors = useMemo(
    () => liveCandidates.filter((v) => isSameDay(v.checkInTime, selectedDate)),
    [liveCandidates, selectedDate]
  );

  // Search includes the resident being visited, so typing a resident's name
  // brings up everyone who came to see them.
  const { residents } = useResidents();
  const residentNameById = useMemo(() => {
    const map: Record<string, string> = {};
    residents.forEach((r) => { map[r.visitorId] = `${r.name} ${r.room} ${r.wing}`.toLowerCase(); });
    return map;
  }, [residents]);

  const applySearch = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return (list: Visitor[]) => {
      if (!q) return list;
      return list.filter((v) =>
        `${v.firstName} ${v.surname}`.toLowerCase().includes(q) ||
        v.mobile.toLowerCase().includes(q) ||
        (v.whomToVisit || "").toLowerCase().includes(q) ||
        (v.email || "").toLowerCase().includes(q) ||
        (v.visitedResidentIds || []).some((id) => (residentNameById[id] || "").includes(q))
      );
    };
  }, [searchQuery, residentNameById]);

  const searchedVisitors = useMemo(() => applySearch(dateVisitors), [applySearch, dateVisitors]);
  const searchedLive = useMemo(() => applySearch(liveCandidates), [applySearch, liveCandidates]);

  const byType = (list: Visitor[]) =>
    activeType === "all" ? list : list.filter((v) => v.type === activeType);

  const typeVisitors = useMemo(() => byType(searchedVisitors), [searchedVisitors, activeType]);
  const typeLive = useMemo(() => byType(searchedLive), [searchedLive, activeType]);

  // "Expected back" only exists where residents are tracked away with a return time.
  const scheduledAvailable = useMemo(
    () => visitors.some((v) => v.type === "resident"),
    [visitors]
  );

  const { views, rowsFor } = useVisitViews({
    dayVisitors: typeVisitors,
    liveVisitors: typeLive,
    allVisitors: visitors,
    selectedDate,
    scheduledAvailable,
  });

  const currentView = views.find((v) => v.key === activeView) ?? views[0];
  const rows = rowsFor(currentView.key);

  // The two live views ignore the day picker — they always show who is signed in.
  const isLiveView = currentView.key === "on-site" || currentView.key === "overdue";

  const typeChips = useMemo(
    () => [
      { value: "all", label: "All" },
      ...deskTypes.map((t) => ({ value: t.type, label: t.label })),
    ],
    [deskTypes]
  );

  // Chip counts follow the active view so the numbers always match the rows.
  const countForType = (type: string) => {
    const base = isLiveView
      ? searchedLive.filter((v) => v.status === "checked-in")
      : searchedVisitors;
    return type === "all" ? base.length : base.filter((v) => v.type === type).length;
  };

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


  // Residents due back ignore the type chips (they are all residents) but still honour search.
  const isResidentsView = currentView.key === "scheduled";
  const listRows = isResidentsView ? applySearch(rows) : rows;
  const overdueBackCount = isResidentsView || scheduledAvailable
    ? (rowsFor("scheduled").filter((v) => v.expectedReturnDate && v.expectedReturnDate.getTime() < Date.now()).length)
    : 0;

  const tileMeta: Record<VisitViewKey, { icon: typeof LogIn; note: (count: number) => string; attention: (count: number) => boolean }> = {
    "on-site": { icon: LogIn, note: () => "Signed in right now, any day", attention: () => false },
    overdue: { icon: AlertTriangle, note: (c) => (c ? "Past their expected time" : "Nobody past their time"), attention: (c) => c > 0 },
    recent: { icon: History, note: () => (isToday(selectedDate) ? "Came and went today" : `On ${format(selectedDate, "EEE d MMM")}`), attention: () => false },
    scheduled: { icon: Home, note: () => (overdueBackCount ? `${overdueBackCount} overdue back` : "Out with a return time"), attention: () => overdueBackCount > 0 },
  };

  return (
    <>
    <AppShell title="Visitors" overstayedCount={overstayedCount} mainClassName="space-y-4 p-4 pb-20 sm:space-y-6 sm:p-6">
      {/* Page header: the app's own top bar does not carry the page name. */}
      <section aria-labelledby="onsite-title" className="rounded-[20px] border border-border bg-card p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-extrabold uppercase leading-4 tracking-[0.06em] text-primary">Visitors</p>
            <h2 id="onsite-title" className="mt-1 text-[28px] font-extrabold leading-9 text-foreground">On site and today</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Who is in the building right now, and everyone who came and went.
              {currentSite?.name ? <span className="font-semibold text-foreground"> {currentSite.name}.</span> : null}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
            {canCheckIn && (
              <Button onClick={() => setAddDialogOpen(true)} className="col-span-2 h-11 gap-2 rounded-lg px-5 font-bold sm:col-span-1">
                <Plus aria-hidden className="h-4 w-4" />Check in
              </Button>
            )}
            {canCheckOut && (
              <Button variant="outline" onClick={() => setCheckOutSheetOpen(true)} className="h-11 gap-2 rounded-lg border-input font-bold">
                <LogOut aria-hidden className="h-4 w-4" />Check out
              </Button>
            )}
            <Button variant="outline" onClick={() => setHandoverOpen(true)} className="h-11 gap-2 rounded-lg border-input font-bold">
              <Printer aria-hidden className="h-4 w-4" />Handover
            </Button>
            <Button variant="outline" onClick={() => setQrOpen(true)} className="col-span-2 h-11 gap-2 rounded-lg border-input font-bold sm:col-span-1">
              <QrCode aria-hidden className="h-4 w-4" />Check-in QR code
            </Button>
          </div>
        </div>

        {/* The four views double as the page's headline numbers. */}
        <div role="group" aria-label="Show" className="mt-5 grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
          {views.map((view) => {
            const meta = tileMeta[view.key];
            const Icon = meta.icon;
            const on = view.key === currentView.key;
            const warn = meta.attention(view.count);
            return (
              <button
                key={view.key}
                type="button"
                aria-pressed={on}
                onClick={() => setActiveView(view.key)}
                className={cn(
                  "min-h-[88px] rounded-xl border p-3 text-left transition-colors sm:p-4",
                  on ? "border-primary bg-accent ring-1 ring-primary" : warn ? "border-[hsl(var(--warning)/0.45)] bg-[hsl(var(--warning)/0.06)] hover:border-[hsl(var(--warning))]" : "border-border bg-secondary/60 hover:border-primary/50",
                )}
              >
                <span className="flex items-center gap-1.5 text-[13px] font-bold text-foreground">
                  <Icon aria-hidden className={cn("h-4 w-4", warn ? "text-warning-strong" : on ? "text-primary" : "text-muted-foreground")} />
                  {view.label}
                </span>
                <span className={cn("mt-1 block text-[28px] font-extrabold leading-8 tabular-nums", warn ? "text-warning-strong" : "text-foreground")}>{view.count}</span>
                <span className={cn("block text-xs", warn ? "font-bold text-warning-strong" : "text-muted-foreground")}>{meta.note(view.count)}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Search and filters for the chosen view */}
      <section aria-label="Search and filter" className="rounded-2xl border border-border bg-card p-3 shadow-sm sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              aria-label="Search this list"
              placeholder={isResidentsView ? "Search resident or room" : "Search name, phone or who they are visiting"}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-11 rounded-lg border-input bg-background pl-10 pr-11 text-base"
            />
            {searchQuery && (
              <Button variant="ghost" size="icon" onClick={() => setSearchQuery("")} aria-label="Clear search" className="absolute right-0 top-1/2 h-11 w-11 -translate-y-1/2 text-muted-foreground">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          {!isLiveView && (
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-11 w-11 shrink-0 rounded-lg border-input" aria-label="Previous day" onClick={() => setSelectedDate((d) => subDays(d, 1))}><ChevronLeft className="h-4 w-4" /></Button>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="h-11 flex-1 gap-2 rounded-lg border-input font-bold lg:flex-none"><CalendarDays aria-hidden className="h-4 w-4" />{isToday(selectedDate) ? "Today" : format(selectedDate, "EEE d MMM yyyy")}</Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end"><Calendar mode="single" selected={selectedDate} onSelect={(date) => date && setSelectedDate(date)} initialFocus /></PopoverContent>
              </Popover>
              <Button variant="outline" size="icon" className="h-11 w-11 shrink-0 rounded-lg border-input" aria-label="Next day" onClick={() => setSelectedDate((d) => addDays(d, 1))}><ChevronRight className="h-4 w-4" /></Button>
              {!isToday(selectedDate) && <Button variant="ghost" className="h-11 rounded-lg font-bold" onClick={() => setSelectedDate(new Date())}>Back to today</Button>}
            </div>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {!isResidentsView && (
            <div role="group" aria-label="Person type" className="flex flex-wrap gap-2">
              {typeChips.map((chip) => {
                const on = activeType === chip.value;
                return (
                  <button
                    key={chip.value}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setActiveType(chip.value)}
                    className={cn(
                      "min-h-11 rounded-full border px-4 text-sm font-bold transition-colors",
                      on ? "border-primary bg-accent text-accent-foreground" : "border-input bg-card text-foreground hover:border-primary/60",
                    )}
                  >
                    {chip.value === "all" ? "Everyone" : chip.label}{" "}
                    <span className="ml-1 tabular-nums text-muted-foreground">{countForType(chip.value)}</span>
                  </button>
                );
              })}
            </div>
          )}
          <div className="ml-auto flex items-center gap-1 text-[13px] text-muted-foreground">
            {lastUpdated && <span aria-live="polite">Updated {format(lastUpdated, "h:mm a")}</span>}
            <Button variant="ghost" size="icon" className="h-11 w-11 rounded-lg" aria-label="Refresh list" onClick={() => refresh()}>
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
          </div>
        </div>
      </section>

      <div className="min-w-0">
        {!canView ? (
          <PermissionDeniedState description="You do not have permission to see who is on site. Ask an administrator if you need this." />
        ) : !online ? (
          <OfflineState description="You are offline. The list below may be out of date — check-ins will save once the connection returns." />
        ) : loading && visitors.length === 0 ? (
          <LoadingState rows={6} label="Loading today's visits" />
        ) : error ? (
          <ErrorState description={error} action={<Button variant="outline" onClick={() => refresh()}>Try again</Button>} />
        ) : (
          <PresenceList
            rows={listRows}
            allVisitors={visitors}
            companionParties={parties}
            emptyTitle={searchQuery.trim() && listRows.length === 0 ? "No matches" : currentView.emptyTitle}
            emptyDescription={
              searchQuery.trim() && listRows.length === 0
                ? `Nobody in this list matches "${searchQuery.trim()}". Check the spelling, or clear the search.`
                : activeType !== "all" && !isResidentsView
                  ? `${currentView.emptyDescription} The ${typeChips.find((c) => c.value === activeType)?.label.toLowerCase() ?? ""} filter is on.`
                  : currentView.emptyDescription
            }
            emptyAction={
              searchQuery.trim() ? <Button variant="outline" className="h-11 rounded-lg border-input font-bold" onClick={() => setSearchQuery("")}>Clear search</Button>
                : activeType !== "all" && !isResidentsView ? <Button variant="outline" className="h-11 rounded-lg border-input font-bold" onClick={() => setActiveType("all")}>Show everyone</Button>
                : undefined
            }
            canCheckOut={canCheckOut}
            canRecordReturn={canCheckIn}
            canExport={canExport}
            canDelete={canDelete}
            showDestination={showDestination}
            onOpen={(v) => setProfileVisitor(v)}
            onOpenResident={(id) => navigate(`/visitors/${id}`)}
            onCheckOut={handleCheckOutFromTable}
            onCheckOutMany={handleCheckOutMany}
            onCheckOutParty={handleCheckOutCompanion}
            onRecordReturn={async (id, comment, time) => { await checkInReturn(id, comment, time); refresh(); }}
            onDelete={deleteVisitor}
            onFeedback={(v) => setFeedbackVisitor(v)}
          />
        )}
        <p className="mt-4 hidden text-center text-xs text-muted-foreground lg:block">
          Keyboard shortcuts: <Kbd>N</Kbd> check in · <Kbd>C</Kbd> check out · <Kbd>Q</Kbd> check-in QR code
        </p>
      </div>
    </AppShell>

      <VisitorProfile
        visitor={profileVisitor}
        allVisitors={visitors}
        open={!!profileVisitor}
        onOpenChange={(o) => { if (!o) setProfileVisitor(null); }}
        onCheckOut={canCheckOut ? (id) => { setProfileVisitor(null); handleCheckOutFromTable(id); } : undefined}
      />
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
      <HandoverPrintDialog open={handoverOpen} onOpenChange={setHandoverOpen} visitors={liveCandidates} date={selectedDate} />
    </>
  );
}

function Kbd({ children }: { children: string }) {
  return <kbd className="mx-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-secondary px-1 font-mono text-[11px] font-semibold text-foreground">{children}</kbd>;
}
