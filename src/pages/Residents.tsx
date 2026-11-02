import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useResidents, type Resident } from "@/hooks/useResidents";
import { usePermissions } from "@/hooks/usePermissions";
import { useResidentMovement } from "@/hooks/useResidentMovement";
import { useSite } from "@/contexts/SiteContext";
import { useOperatingContext } from "@/contexts/OperatingContext";
import { ResidentOutingDialog } from "@/components/ResidentOutingDialog";
import { CheckInReturnDialog } from "@/components/CheckInReturnDialog";
import { ResidentList } from "@/components/residents/ResidentList";
import { ResidentPanel } from "@/components/residents/ResidentPanel";
import { inView, matchesResident, sortResidents, wingCounts, type ResidentView } from "@/lib/residentView";
import { cn } from "@/lib/utils";
import { residentLocation, movementTimeZone, residentLocalInstant } from "@/lib/residentMovement";
import { DoorOpen, Search, RefreshCw, Clock, Home, Users, X } from "lucide-react";

export default function Residents() {
  const { can, loading: permissionLoading } = usePermissions();
  const { currentSiteId, currentSite } = useSite();
  const { terms, modules, jurisdiction } = useOperatingContext();
  const { residents, loading, error, refetch } = useResidents({ enabled: !permissionLoading && can("presence.view") });
  const { save, saving } = useResidentMovement(refetch);
  const [params, setParams] = useSearchParams();
  const tab = ["away", "expected", "no-absence", "directory"].includes(params.get("view") ?? "") ? params.get("view") ?? "away" : "away";
  const [search, setSearch] = useState("");
  const [outingOpen, setOutingOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [returnId, setReturnId] = useState<string | null>(null);
  const selected = residents.find(r => r.visitorId === selectedId);
  const returning = residents.find(r => r.visitorId === returnId);
  const timeZone = movementTimeZone(currentSite?.timezone, jurisdiction);
  const now = new Date();
  const away = residents.filter(r => residentLocation(r, now) !== "no-absence");
  const overdue = away.filter(r => residentLocation(r, now) === "overdue");
  const dueBack = residents.filter(r => inView(r, "expected", now, timeZone));
  const noAbsence = residents.filter(r => residentLocation(r, now) === "no-absence");
  const [wing, setWing] = useState<string>("all");
  const [panelId, setPanelId] = useState<string | null>(null);
  const navigate = useNavigate();
  const view = tab as ResidentView;
  const inSearch = (list: Resident[]) => list.filter((r) => matchesResident(r, search));
  const wings = wingCounts(inSearch(residents.filter((r) => inView(r, view, now, timeZone))));
  const filtered = sortResidents(
    inSearch(residents.filter((r) => inView(r, view, now, timeZone))).filter((r) => wing === "all" || r.wing === wing),
    now,
  );
  const presenceMap = new Map(residents.map(r => [r.visitorId, residentLocation(r, now)]));
  const openOuting = (id: string | null) => { setPanelId(null); setSelectedId(id); setOutingOpen(true); };
  const openReturn = (id: string) => { setPanelId(null); setReturnId(id); };
  const panelResident = residents.find((r) => r.visitorId === panelId) ?? null;
  const absenceAction = modules.selfReportedAway ? "Record absence" : "Record outing";
  const labels = {
    place: terms.place,
    safeguards: jurisdiction === "UK" ? "DoLS/LPS" : "Individual safeguards",
    absenceAction,
    showClinical: modules.clinicalSupportFields !== false,
  };
  const canOuting = can("checkout.perform");
  const canReturn = can("checkin.create");

  const tiles: { key: ResidentView; label: string; icon: typeof DoorOpen; count: number; note: string; warn: boolean }[] = [
    { key: "away", label: modules.selfReportedAway ? "Away" : "Out now", icon: DoorOpen, count: away.length, note: overdue.length ? `${overdue.length} past expected return` : "Recorded as out", warn: overdue.length > 0 },
    { key: "expected", label: "Due back today", icon: Clock, count: dueBack.length, note: overdue.length ? "Overdue returns listed first" : "Expected back today", warn: overdue.length > 0 },
    { key: "no-absence", label: "No absence recorded", icon: Home, count: noAbsence.length, note: "Not a confirmed sighting", warn: false },
    { key: "directory", label: `All ${terms.residentPlural.toLowerCase()}`, icon: Users, count: residents.length, note: "Care needs and contacts", warn: false },
  ];
  const current = tiles.find((t) => t.key === view)!;
  const emptyState = search.trim()
    ? { title: "No matches", description: `Nobody in this list matches "${search.trim()}".`, action: <Button variant="outline" className="h-11 rounded-lg border-input font-bold" onClick={() => setSearch("")}>Clear search</Button> }
    : wing !== "all"
      ? { title: `Nobody in ${wing}`, description: "No residents in this list are in that area.", action: <Button variant="outline" className="h-11 rounded-lg border-input font-bold" onClick={() => setWing("all")}>Show all areas</Button> }
      : view === "away" ? { title: "Nobody is recorded as out", description: "Residents appear here when an outing or absence is recorded." }
      : view === "expected" ? { title: "Nobody is due back today", description: "Residents who are out and due back today appear here, overdue returns first." }
      : view === "no-absence" ? { title: "Every resident is recorded as out", description: "Record their returns as they come back." }
      : { title: "No residents at this site", description: "Resident records are added in the resident management system." };

  return <AppShell title={terms.residentPlural} mainClassName="space-y-4 p-4 pb-16 sm:space-y-6 sm:p-6">
    {permissionLoading ? <p role="status">Checking access…</p> : !can("presence.view") ? <p role="alert">You do not have access to resident movements.</p> : !currentSiteId ? <p role="status">Select a site to view residents.</p> : <>
      {/* Page header: the app's own top bar does not carry the page name. */}
      <section aria-labelledby="residents-title" className="rounded-[20px] border border-border bg-card p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-extrabold uppercase leading-4 tracking-[0.06em] text-primary">{terms.residentPlural}</p>
            <h2 id="residents-title" className="mt-1 text-[28px] font-extrabold leading-9 text-foreground">{modules.selfReportedAway ? "Time away" : "Outings and returns"}</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              {modules.selfReportedAway ? "Optional, resident-reported time away. Location is not confirmed." : "Who is recorded as out, who is due back, and how to reach their contacts."}
              {currentSite?.name ? <span className="font-semibold text-foreground"> {currentSite.name}.</span> : null}
            </p>
          </div>
          <div className="flex gap-2">
            {canOuting && <Button onClick={() => openOuting(null)} disabled={loading || saving} className="h-11 flex-1 gap-2 rounded-lg px-5 font-bold sm:flex-none"><DoorOpen aria-hidden="true" className="h-4 w-4" />{absenceAction}</Button>}
            <Button variant="outline" size="icon" onClick={() => void refetch()} disabled={loading || saving} aria-label="Refresh" className="h-11 w-11 shrink-0 rounded-lg border-input"><RefreshCw aria-hidden="true" className={cn("h-4 w-4", loading && "animate-spin")} /></Button>
          </div>
        </div>
        <div role="group" aria-label="Show" className="mt-5 grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
          {tiles.map((t) => {
            const on = t.key === view;
            const Icon = t.icon;
            return (
              <button key={t.key} type="button" aria-pressed={on} onClick={() => { setParams({ view: t.key }); setWing("all"); }}
                className={cn("min-h-[88px] rounded-xl border p-3 text-left transition-colors sm:p-4",
                  on ? "border-primary bg-accent ring-1 ring-primary" : t.warn ? "border-[hsl(var(--warning)/0.45)] bg-[hsl(var(--warning)/0.06)] hover:border-[hsl(var(--warning))]" : "border-border bg-secondary/60 hover:border-primary/50")}>
                <span className="flex items-center gap-1.5 text-[13px] font-bold text-foreground"><Icon aria-hidden className={cn("h-4 w-4", t.warn ? "text-warning-strong" : on ? "text-primary" : "text-muted-foreground")} />{t.label}</span>
                <span className={cn("mt-1 block text-[28px] font-extrabold leading-8 tabular-nums", t.warn ? "text-warning-strong" : "text-foreground")}>{loading ? "–" : t.count}</span>
                <span className={cn("block text-xs", t.warn ? "font-bold text-warning-strong" : "text-muted-foreground")}>{t.note}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section aria-label="Search and filter" className="rounded-2xl border border-border bg-card p-3 shadow-sm sm:p-4">
        <div className="relative">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Search residents" placeholder={`Search name, ${terms.place.toLowerCase()} or ${terms.area.toLowerCase()}`} value={search} onChange={e => setSearch(e.target.value)} className="h-11 rounded-lg border-input bg-background pl-10 pr-11 text-base" />
          {search && <Button variant="ghost" size="icon" onClick={() => setSearch("")} aria-label="Clear search" className="absolute right-0 top-1/2 h-11 w-11 -translate-y-1/2 text-muted-foreground"><X className="h-4 w-4" /></Button>}
        </div>
        {wings.length > 1 && (
          <div role="group" aria-label={terms.area} className="mt-3 flex flex-wrap gap-2">
            {[{ wing: "all", count: wings.reduce((n, w) => n + w.count, 0) }, ...wings].map((w) => {
              const on = wing === w.wing;
              return (
                <button key={w.wing} type="button" aria-pressed={on} onClick={() => setWing(w.wing)}
                  className={cn("min-h-11 rounded-full border px-4 text-sm font-bold transition-colors", on ? "border-primary bg-accent text-accent-foreground" : "border-input bg-card text-foreground hover:border-primary/60")}>
                  {w.wing === "all" ? `All ${terms.areaPlural.toLowerCase()}` : w.wing}{" "}<span className="ml-1 tabular-nums text-muted-foreground">{w.count}</span>
                </button>
              );
            })}
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Times in {timeZone}{!currentSite?.timezone ? " (country default; the site time zone is not set)" : ""}. Movement records show what was recorded, not where someone is right now.
        </p>
      </section>

      {error ? (
        <div role="alert" className="rounded-2xl border border-border bg-card px-6 py-10 text-center">
          <p className="font-bold">{error}</p>
          <Button variant="outline" onClick={() => void refetch()} className="mt-3 h-11 gap-2 rounded-lg border-input font-bold"><RefreshCw aria-hidden className="h-4 w-4" />Try again</Button>
        </div>
      ) : loading ? <p role="status" className="rounded-2xl border border-border bg-card px-6 py-10 text-center text-muted-foreground">Loading {terms.residentPlural.toLowerCase()}…</p> : (
        <ResidentList
          residents={filtered}
          view={view}
          now={now}
          timeZone={timeZone}
          labels={labels}
          canRecordOuting={canOuting}
          canRecordReturn={canReturn}
          busy={saving}
          empty={emptyState}
          onOpen={(r) => setPanelId(r.visitorId)}
          onOpenRecord={(r) => navigate(`/visitors/${r.visitorId}`)}
          onRecordOuting={(r) => openOuting(r.visitorId)}
          onRecordReturn={(r) => openReturn(r.visitorId)}
        />
      )}
      <span className="sr-only" aria-live="polite">{current.label}: {filtered.length}</span>
    </>}
    <ResidentPanel
      resident={panelResident}
      open={!!panelResident}
      onOpenChange={(o) => { if (!o) setPanelId(null); }}
      now={now}
      timeZone={timeZone}
      labels={labels}
      canRecordOuting={canOuting}
      canRecordReturn={canReturn}
      onRecordOuting={(r) => openOuting(r.visitorId)}
      onRecordReturn={(r) => openReturn(r.visitorId)}
      onOpenRecord={(r) => navigate(`/visitors/${r.visitorId}`)}
    />
    <ResidentOutingDialog open={outingOpen} onOpenChange={setOutingOpen} preselectedResident={selected ? {id:selected.visitorId,name:selected.name,room:selected.room,wing:selected.wing} : null} presenceMap={presenceMap} onMarkAway={async (id,d) => {
      const resident=residents.find(r=>r.visitorId===id); if (!resident) throw new Error("Refresh resident records before saving.");
      await save(resident,"leave",{expected_return:d.expectedReturnDate?.toISOString() ?? null,reason:d.checkoutReason ?? null,leave_type:d.leaveType ?? "Away",accompanied_by:d.accompaniedBy ?? null,accompanied_by_name:d.accompaniedByName ?? null,comments:d.comments ?? null,return_notification_opt_in:d.returnNotificationOptIn ?? false,...(d.companionDetails ? {companion_details:d.companionDetails} : {}),...(d.recordedTime ? {recorded_time:d.recordedTime.toISOString()} : {})});
    }} />
    {returning && <CheckInReturnDialog key={`${currentSiteId}-${returning.visitorId}`} open={!!returnId} onOpenChange={o=>{if(!o)setReturnId(null);}} visitorName={returning.name} onConfirm={async (comment,time) => {
      let recorded: Date | undefined;
      if(time){const parts=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date()).map(p=>[p.type,p.value]));recorded=residentLocalInstant(`${parts.year}-${parts.month}-${parts.day}T${time}`,timeZone);}
      await save(returning,"return",{comments:comment,...(recorded?{recorded_time:recorded.toISOString()}: {})});setReturnId(null);
    }} />}
  </AppShell>;
}
