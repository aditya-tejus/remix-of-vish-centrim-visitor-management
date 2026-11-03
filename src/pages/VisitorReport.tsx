import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatTile } from "@/components/ui/reception-primitives";
import { stayLabel } from "@/lib/presence";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Info,
  Printer,
  Search,
  UserCheck,
  Users,
} from "lucide-react";
import { useSite } from "@/contexts/SiteContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useWeeklyVisitReport } from "@/hooks/useWeeklyVisitReport";
import {
  LEFT_STATE_LABELS,
  MAX_RANGE_DAYS,
  buildReportRows,
  clampRange,
  filterReportRows,
  formatDateInZone,
  formatDateTimeInZone,
  formatTimeInZone,
  groupRowsByDay,
  reportTotals,
  weekWindow,
} from "@/lib/weeklyReport";
import { exportReportToCSV, printReport } from "@/lib/weeklyReportExport";
import { toast } from "@/hooks/use-toast";

const PAGE_SIZE = 100;

function toInputDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default function VisitorReport() {
  const { sites, currentSite, currentSiteId, isLegacySite } = useSite();
  const { can } = usePermissions();

  const [siteId, setSiteId] = useState<string | null>(currentSiteId);
  const [weekOffset, setWeekOffset] = useState(0);
  const [useCustom, setUseCustom] = useState(false);
  const [customFrom, setCustomFrom] = useState(toInputDate(new Date()));
  const [customTo, setCustomTo] = useState(toInputDate(new Date()));
  const [search, setSearch] = useState("");
  const [personType, setPersonType] = useState("all");
  const [missingOnly, setMissingOnly] = useState(false);
  const [visible, setVisible] = useState(PAGE_SIZE);

  const site = sites.find((s) => s.id === (siteId ?? currentSiteId)) ?? currentSite;
  const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const timeZone = site?.timezone || browserZone;
  const timeZoneIsFallback = !site?.timezone;

  const canSeeScreening = can("screening.view");
  const canExport = can("data.export");

  const { window: range, capped } = useMemo(() => {
    if (useCustom) {
      const from = new Date(`${customFrom}T00:00:00`);
      const to = new Date(`${customTo}T23:59:59`);
      return clampRange(from, to);
    }
    return { window: weekWindow(new Date(), timeZone, weekOffset), capped: false };
  }, [useCustom, customFrom, customTo, timeZone, weekOffset]);

  const { canonical, legacy, loading, error } = useWeeklyVisitReport(
    siteId ?? currentSiteId,
    range.start,
    range.end
  );

  const allRows = useMemo(
    () =>
      buildReportRows(canonical, legacy, {
        siteId: siteId ?? currentSiteId,
        includeUnassigned: isLegacySite,
        now: new Date(),
        timeZone,
        includeScreening: canSeeScreening,
      }),
    [canonical, legacy, siteId, currentSiteId, isLegacySite, timeZone, canSeeScreening]
  );

  const rows = useMemo(
    () => filterReportRows(allRows, { search, personType, missingOnly }),
    [allRows, search, personType, missingOnly]
  );
  const totals = useMemo(() => reportTotals(rows), [rows]);
  const personTypes = useMemo(
    () => Array.from(new Set(allRows.map((r) => r.personType))).sort(),
    [allRows]
  );

  const rangeLabel = `${formatDateInZone(range.start, timeZone)} to ${formatDateInZone(
    new Date(range.end.getTime() - 1000),
    timeZone
  )}`;

  const exportContext = {
    siteName: site?.name || "This site",
    rangeLabel,
    timeZone,
    timeZoneIsFallback,
    generatedAt: formatDateTimeInZone(new Date(), timeZone),
    includeScreening: canSeeScreening,
  };

  const handleCsv = () => {
    if (rows.length === 0) return;
    exportReportToCSV(rows, exportContext, `visitor-report-${toInputDate(range.start)}.csv`);
  };

  const handlePrint = () => {
    if (rows.length === 0) return;
    const opened = printReport(rows, exportContext);
    if (!opened) {
      toast({
        title: "Printing was blocked",
        description: "Your browser stopped the print window from opening. Allow pop-ups for this site and try again.",
        variant: "destructive",
      });
    }
  };

  const groups = useMemo(() => groupRowsByDay(rows.slice(0, visible), timeZone), [rows, visible, timeZone]);
  const typeLabel = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

  return (
    <AppShell
      title="Visitor report"
      mainClassName="p-4 sm:p-6"
      eyebrow="Reports"
      subtitle="Everyone who arrived and left in the chosen week. Residents are on the Residents page."
      actions={canExport ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handlePrint} disabled={rows.length === 0}><Printer className="h-4 w-4" aria-hidden="true" />Print</Button>
          <Button variant="outline" onClick={handleCsv} disabled={rows.length === 0}><Download className="h-4 w-4" aria-hidden="true" />Download</Button>
        </div>
      ) : undefined}
      headerContent={
        <div className="flex flex-wrap items-center gap-3">
          {!useCustom ? (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="h-11 w-11" onClick={() => setWeekOffset((w) => w - 1)} aria-label="Previous week">
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </Button>
              <div className="min-w-[200px] text-center">
                <p className="text-sm font-extrabold text-foreground">{weekOffset === 0 ? "This week" : weekOffset === -1 ? "Last week" : "Selected week"}</p>
                <p className="text-[13px] text-muted-foreground">{rangeLabel}</p>
              </div>
              <Button variant="outline" size="icon" className="h-11 w-11" onClick={() => setWeekOffset((w) => w + 1)} aria-label="Next week" disabled={weekOffset >= 0}>
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Button>
              {weekOffset !== 0 && <Button variant="ghost" onClick={() => setWeekOffset(0)}>Back to this week</Button>}
            </div>
          ) : (
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-[13px] font-bold text-foreground">From
                <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="mt-1" />
              </label>
              <label className="text-[13px] font-bold text-foreground">To
                <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="mt-1" />
              </label>
            </div>
          )}
          <Button variant="ghost" onClick={() => setUseCustom((v) => !v)}>{useCustom ? "Use whole weeks" : "Choose dates"}</Button>
          {sites.length > 1 && (
            <Select value={siteId ?? currentSiteId ?? ""} onValueChange={(v) => setSiteId(v)}>
              <SelectTrigger className="w-[220px] sm:ml-auto" aria-label="Site"><SelectValue placeholder="Site" /></SelectTrigger>
              <SelectContent>{sites.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          )}
        </div>
      }
    >
      <div className="space-y-5">
        <section aria-label="Summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="People recorded" icon={Users} value={loading ? "…" : totals.people} note="Including people who came with them" />
          <StatTile label="Still on site" icon={UserCheck} value={loading ? "…" : totals.onSite} note="Arrived today, not signed out yet" />
          <StatTile label="No sign-out recorded" icon={Clock} value={loading ? "…" : totals.missing}
            tone={totals.missing > 0 ? "attention" : "neutral"} note={totals.missing > 0 ? "From an earlier day. Check and correct." : "Every earlier visit signed out"} />
          <StatTile label="Older records" icon={Info} value={loading ? "…" : totals.legacy} note="Saved before the current system" />
        </section>

        <section aria-label="Visitor activity" className="rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or who they saw"
                aria-label="Search name or who they saw" className="pl-9" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={personType} onValueChange={setPersonType}>
                <SelectTrigger className="w-[180px]" aria-label="Person type"><SelectValue placeholder="Everyone" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Everyone</SelectItem>
                  {personTypes.map((t) => <SelectItem key={t} value={t}>{typeLabel(t)}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="outline" aria-pressed={missingOnly} onClick={() => setMissingOnly((v) => !v)}
                className={missingOnly ? "border-primary bg-accent text-accent-foreground" : undefined}>
                <Clock className="h-4 w-4" aria-hidden="true" />No sign-out only
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="space-y-2 p-4">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : error ? (
            <p role="alert" className="p-6 text-sm font-semibold text-destructive">{error}</p>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-base font-extrabold text-foreground">{search || personType !== "all" || missingOnly ? "No one matches these filters" : "No visits recorded in this period"}</p>
              <p className="mt-1 text-sm text-muted-foreground">{search || personType !== "all" || missingOnly ? "Clear the search or filters to see everyone." : "Try the previous week."}</p>
            </div>
          ) : (
            <>
              <div className="divide-y divide-border">
                {groups.map((g) => (
                  <div key={g.day}>
                    <h2 className="sticky top-0 z-[1] flex items-baseline justify-between bg-muted/70 px-4 py-2 text-[13px] font-extrabold text-foreground backdrop-blur">
                      {g.day}<span className="font-semibold text-muted-foreground">{g.rows.length} {g.rows.length === 1 ? "person" : "people"}</span>
                    </h2>
                    <ul className="divide-y divide-border">
                      {g.rows.map((row) => (
                        <li key={row.key} className="grid gap-x-4 gap-y-1 px-4 py-3 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_13rem_10.5rem] md:items-center">
                          <div className="min-w-0">
                            <p className="truncate text-[15px] font-bold text-foreground">{row.name}</p>
                            <p className="truncate text-[13px] text-muted-foreground">
                              {typeLabel(row.personType)}{row.role === "companion" ? ` · with ${row.withPrimaryName || "main visitor"}` : ""}
                              {row.record === "legacy" ? " · older record" : ""}
                            </p>
                          </div>
                          <p className="min-w-0 truncate text-[13px] text-foreground">{row.destination ? <>Seeing <strong className="font-bold">{row.destination}</strong></> : <span className="text-muted-foreground">No one named</span>}</p>
                          <p className="text-[13px] tabular-nums text-foreground">
                            {formatTimeInZone(row.arrived, timeZone)} – {row.left ? formatTimeInZone(row.left, timeZone) : "…"}
                            {row.left && <span className="text-muted-foreground"> · {stayLabel(row.arrived, row.left)}</span>}
                          </p>
                          <div className="flex flex-wrap gap-1.5 md:justify-end">
                            {row.leftState === "missing" && <span className="rounded-full bg-warning-subtle px-2.5 py-0.5 text-xs font-bold text-warning-strong">{LEFT_STATE_LABELS.missing}</span>}
                            {row.leftState === "on-site" && <span className="rounded-full bg-info-subtle px-2.5 py-0.5 text-xs font-bold text-info-strong">{LEFT_STATE_LABELS["on-site"]}</span>}
                            {canSeeScreening && row.screeningStatus && <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">Questions: {row.screeningStatus}</span>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              {rows.length > visible && (
                <div className="border-t border-border p-3 text-center">
                  <Button variant="outline" onClick={() => setVisible((v) => v + PAGE_SIZE)}>Show more ({rows.length - visible} more)</Button>
                </div>
              )}
            </>
          )}
        </section>

        <p className="flex items-start gap-2 text-[13px] text-muted-foreground">
          <Info className="mt-[2px] h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            Times shown in {timeZone}
            {timeZoneIsFallback && " (this device's time zone, because no time zone is set for this site)"}.
            {capped && ` Dates are limited to ${MAX_RANGE_DAYS} days, so the end date was shortened.`}
          </span>
        </p>
      </div>
    </AppShell>
  );
}
