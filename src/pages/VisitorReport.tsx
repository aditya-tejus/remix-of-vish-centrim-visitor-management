import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

  return (
    <AppShell
      title="Visitor Report"
      subtitle="Every person recorded at this site for the chosen period"
      mainClassName="p-6 space-y-4"
    >
      {/* Period and site */}
      <section aria-label="Period and site" className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          {!useCustom && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setWeekOffset((w) => w - 1)} aria-label="Previous week">
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </Button>
              <div className="min-w-[220px] text-center">
                <p className="text-sm font-semibold text-foreground">{rangeLabel}</p>
                <p className="text-[12px] text-muted-foreground">
                  {weekOffset === 0 ? "This week" : weekOffset === -1 ? "Last week" : "Selected week"}
                </p>
              </div>
              <Button variant="outline" size="icon" onClick={() => setWeekOffset((w) => w + 1)} aria-label="Next week">
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Button>
              {weekOffset !== 0 && (
                <Button variant="ghost" size="sm" onClick={() => setWeekOffset(0)}>
                  This week
                </Button>
              )}
            </div>
          )}

          {useCustom && (
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-[12px] text-muted-foreground">
                From
                <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="mt-1" />
              </label>
              <label className="text-[12px] text-muted-foreground">
                To
                <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="mt-1" />
              </label>
            </div>
          )}

          <Button variant="ghost" size="sm" onClick={() => setUseCustom((v) => !v)}>
            {useCustom ? "Use whole weeks" : "Choose dates"}
          </Button>

          {sites.length > 1 && (
            <div className="ml-auto">
              <Select value={siteId ?? currentSiteId ?? ""} onValueChange={(v) => setSiteId(v)}>
                <SelectTrigger className="w-[220px]" aria-label="Site">
                  <SelectValue placeholder="Site" />
                </SelectTrigger>
                <SelectContent>
                  {sites.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <p className="mt-3 flex items-start gap-2 text-[12px] text-muted-foreground">
          <Info className="mt-[2px] h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            Times shown in {timeZone}
            {timeZoneIsFallback && " — this device's time zone, because no time zone is set for this site"}.
            {capped && ` Dates are limited to ${MAX_RANGE_DAYS} days, so the end date was shortened.`}
          </span>
        </p>
      </section>

      {/* Totals */}
      <section aria-label="Summary" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "People recorded", value: totals.people, icon: Users },
          { label: "Still on site", value: totals.onSite, icon: UserCheck },
          { label: "No sign-out recorded", value: totals.missing, icon: Clock },
          { label: "Older records", value: totals.legacy, icon: Info },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span className="text-[12px]">{label}</span>
            </div>
            <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
          </div>
        ))}
      </section>

      {/* Filters and export */}
      <section aria-label="Filters" className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or destination"
            aria-label="Search name or destination"
            className="pl-9"
          />
        </div>
        <Select value={personType} onValueChange={setPersonType}>
          <SelectTrigger className="w-[180px]" aria-label="Person type">
            <SelectValue placeholder="All person types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All person types</SelectItem>
            {personTypes.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant={missingOnly ? "default" : "outline"} onClick={() => setMissingOnly((v) => !v)}>
          <Clock className="mr-2 h-4 w-4" aria-hidden="true" />
          No sign-out recorded
        </Button>
        {canExport && (
          <>
            <Button variant="outline" onClick={handleCsv} disabled={rows.length === 0}>
              <Download className="mr-2 h-4 w-4" aria-hidden="true" />
              Export CSV
            </Button>
            <Button variant="outline" onClick={handlePrint} disabled={rows.length === 0}>
              <Printer className="mr-2 h-4 w-4" aria-hidden="true" />
              Print
            </Button>
          </>
        )}
      </section>

      {/* Table */}
      <section aria-label="Visitor activity" className="rounded-xl border border-border bg-card">
        {loading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : error ? (
          <p className="p-6 text-sm text-destructive">{error}</p>
        ) : rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            No visits recorded for this period.
          </p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Person type</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Arrived</TableHead>
                  <TableHead>Destination</TableHead>
                  <TableHead>Left</TableHead>
                  <TableHead>Record</TableHead>
                  {canSeeScreening && <TableHead>Check-in questions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.slice(0, visible).map((row) => (
                  <TableRow key={row.key}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="capitalize">{row.personType}</TableCell>
                    <TableCell className="text-[13px] text-muted-foreground">
                      {row.role === "primary" ? "Main visitor" : `With ${row.withPrimaryName || "main visitor"}`}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-[13px]">
                      {formatTimeInZone(row.arrived, timeZone)}
                      <span className="block text-muted-foreground">{formatDateInZone(row.arrived, timeZone)}</span>
                    </TableCell>
                    <TableCell className="text-[13px]">{row.destination || "—"}</TableCell>
                    <TableCell className="whitespace-nowrap text-[13px]">
                      {row.left ? (
                        <>
                          {formatTimeInZone(row.left, timeZone)}
                          <span className="block text-muted-foreground">{formatDateInZone(row.left, timeZone)}</span>
                        </>
                      ) : (
                        <Badge variant={row.leftState === "missing" ? "destructive" : "secondary"}>
                          {LEFT_STATE_LABELS[row.leftState]}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-[13px] text-muted-foreground">
                      {row.record === "legacy" ? "Older record" : "Attendance record"}
                    </TableCell>
                    {canSeeScreening && (
                      <TableCell className="text-[13px]">{row.screeningStatus || "Not recorded"}</TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {rows.length > visible && (
              <div className="border-t border-border p-3 text-center">
                <Button variant="ghost" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
                  Show more ({rows.length - visible} remaining)
                </Button>
              </div>
            )}
          </>
        )}
      </section>
    </AppShell>
  );
}
