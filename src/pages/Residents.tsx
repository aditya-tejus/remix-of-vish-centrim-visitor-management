import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useResidents } from "@/hooks/useResidents";
import { usePermissions } from "@/hooks/usePermissions";
import { useResidentMovement } from "@/hooks/useResidentMovement";
import { useSite } from "@/contexts/SiteContext";
import { useOperatingContext } from "@/contexts/OperatingContext";
import { ResidentOutingDialog } from "@/components/ResidentOutingDialog";
import { CheckInReturnDialog } from "@/components/CheckInReturnDialog";
import { ResidentDirectoryTable } from "@/components/ResidentDirectoryTable";
import { residentLocation, sameLocalDay, movementTimeZone, formatMovementTime, residentLocalInstant } from "@/lib/residentMovement";
import { DoorOpen, LogIn, Search, ShieldAlert, RefreshCw, Clock, AlertTriangle } from "lucide-react";

export default function Residents() {
  const { can, loading: permissionLoading } = usePermissions();
  const { currentSiteId, currentSite } = useSite();
  const { terms, pack, modules, jurisdiction } = useOperatingContext();
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
  const expected = away.filter(r => r.expectedReturnDate && sameLocalDay(r.expectedReturnDate, now, timeZone));
  const noAbsence = residents.filter(r => residentLocation(r, now) === "no-absence");
  const source = tab === "away" ? away : tab === "expected" ? expected : tab === "no-absence" ? noAbsence : residents;
  const filtered = source.filter(r => `${r.name} ${r.room} ${r.wing} ${r.keyWorker ?? ""}`.toLowerCase().includes(search.toLowerCase())).sort((a,b) => {
    const urgency = Number(residentLocation(b,now) === "overdue") - Number(residentLocation(a,now) === "overdue");
    return urgency || (a.expectedReturnDate?.getTime() ?? Infinity) - (b.expectedReturnDate?.getTime() ?? Infinity) || a.name.localeCompare(b.name);
  });
  const presenceMap = new Map(residents.map(r => [r.visitorId, residentLocation(r, now)]));
  const openOuting = (id: string | null) => { setSelectedId(id); setOutingOpen(true); };
  return <AppShell title={terms.residentPlural} subtitle={`${pack.shortLabel} · Absences and returns`}>
    <div className="p-4 md:p-6 space-y-5 text-base">
      {permissionLoading ? <p role="status">Checking access…</p> : !can("presence.view") ? <p role="alert">You do not have access to resident movements.</p> : !currentSiteId ? <p role="status">Select a site to view residents.</p> : <>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="font-semibold">{currentSite?.name}</p><p className="text-sm text-muted-foreground">{modules.selfReportedAway ? "Optional, resident-reported absences. Location not confirmed." : "Recorded movements only. No absence recorded is not a physical sighting."}</p></div>
          <div className="flex flex-wrap gap-2">
            {can("checkout.perform") && <Button onClick={() => openOuting(null)} disabled={loading || saving} className="gap-2 min-h-touch"><DoorOpen aria-hidden="true" className="h-4 w-4" />{modules.selfReportedAway ? "Record absence" : "Record outing"}</Button>}
            <Button variant="outline" onClick={() => void refetch()} disabled={loading || saving} className="gap-2 min-h-touch"><RefreshCw aria-hidden="true" className="h-4 w-4" />Refresh</Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-8 gap-y-2 border-y border-border py-3">
          <p><strong className="tabular-nums">{away.length}</strong> away recorded</p><p className="text-warning-strong"><strong>{overdue.length}</strong> past expected return</p><p><strong>{expected.length}</strong> expected today</p><p><strong>{noAbsence.length}</strong> no absence reported</p>
        </div>
        <Tabs value={tab} onValueChange={view => setParams({view})}>
          <TabsList aria-label="Resident views" className="h-auto flex flex-wrap justify-start gap-1 bg-transparent p-0">
            <TabsTrigger value="away" className="min-h-touch text-base">Away</TabsTrigger><TabsTrigger value="expected" className="min-h-touch text-base">Expected back</TabsTrigger><TabsTrigger value="no-absence" className="min-h-touch text-base">No absence reported</TabsTrigger><TabsTrigger value="directory" className="min-h-touch text-base">Directory</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative max-w-lg"><Search aria-hidden="true" className="h-4 w-4 absolute left-3 top-3.5 text-muted-foreground"/><Input aria-label="Search residents" placeholder={`Search name, ${terms.place.toLowerCase()} or ${terms.area.toLowerCase()}`} value={search} onChange={e=>setSearch(e.target.value)} className="pl-10 min-h-touch text-base" /></div>
        <p className="text-sm text-muted-foreground">Times in {timeZone}{!currentSite?.timezone ? " (country fallback; site time zone not configured)" : ""}. Movement records do not confirm physical safety.</p>
        {error ? <p role="alert" className="text-destructive-strong">{error}</p> : loading ? <p role="status">Loading residents…</p> : tab === "directory" ? <ResidentDirectoryTable residents={filtered} wingMap={new Map()} presenceMap={presenceMap} onQuickAway={can("checkout.perform") ? r=>openOuting(r.visitorId) : undefined} /> : <div className="bg-card border-y border-border divide-y divide-border">
          {filtered.length === 0 && <p role="status" className="py-10 px-4 text-muted-foreground">{search ? "No matching residents." : tab === "no-absence" ? "No residents in this view." : "No recorded absences in this view. Other residents’ locations remain unconfirmed."}</p>}
          {filtered.map(r => {
            const status = residentLocation(r, now);
            return <div key={r.visitorId} className="p-4 flex flex-col lg:flex-row lg:items-center gap-3">
              <div className="flex-1 min-w-0"><Link to={`/visitors/${r.visitorId}`} className="font-semibold text-primary underline-offset-4 hover:underline break-words">{r.name}</Link><p className="text-sm text-muted-foreground">{r.room || `${terms.place} not recorded`}{r.wing ? ` · ${r.wing}` : ""}</p>{r.dolsLpsFlag && <p className="text-sm text-destructive-strong flex gap-1 items-center"><ShieldAlert aria-hidden="true" className="h-4 w-4"/>DoLS/LPS — individual safeguards</p>}</div>
              <div className="flex-1 min-w-0"><p className={status === "overdue" ? "text-warning-strong font-semibold" : "text-foreground"}>{status === "no-absence" ? "No absence reported" : status === "overdue" ? "Past expected return" : "Recorded absence"}</p><p className="text-sm text-muted-foreground">{status === "no-absence" ? "Location not confirmed" : r.checkoutReason || r.leaveType || "Reason not recorded"}</p>{status !== "no-absence" && r.accompaniedByName && <p className="text-sm">With {r.accompaniedByName}</p>}</div>
              {status !== "no-absence" && <div className="flex-1 text-sm"><p>Left: {r.checkOutTime ? formatMovementTime(r.checkOutTime,timeZone) : "Time not recorded"}</p><p className="flex gap-1 items-center"><Clock aria-hidden="true" className="h-4 w-4"/>Expected: {r.expectedReturnDate ? formatMovementTime(r.expectedReturnDate,timeZone) : "Not supplied"}</p></div>}
              {status !== "no-absence" && can("checkin.create") ? <Button variant="outline" disabled={saving} onClick={()=>setReturnId(r.visitorId)} className="gap-2 min-h-touch"><LogIn aria-hidden="true" className="h-4 w-4"/>Record return</Button> : status === "no-absence" && can("checkout.perform") ? <Button variant="outline" disabled={saving} onClick={()=>openOuting(r.visitorId)} className="gap-2 min-h-touch"><DoorOpen aria-hidden="true" className="h-4 w-4"/>Record absence</Button> : null}
            </div>;
          })}
        </div>}
      </>}
    </div>
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
