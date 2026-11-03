import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { addDays, format, startOfDay, subDays } from "date-fns";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CalendarDays, Clock, Download, HeartHandshake, RefreshCw, TrendingUp, Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/reception-primitives";
import { ChartCard, ChoiceChips, Legend, TYPE_COLOR, axisTick, tooltipStyle } from "@/components/reports/ReportParts";
import { useVisitsInRange } from "@/hooks/useVisitsInRange";
import { useResidents } from "@/hooks/useResidents";
import { useSite } from "@/contexts/SiteContext";
import { exportCsvAudited } from "@/lib/exportAudit";
import { PATTERN_TYPE_LABEL, hourLabel, minutesLabel, visitPatterns } from "@/lib/visitPatterns";

type Period = "7" | "30" | "90";
const PERIODS: { id: Period; label: string }[] = [
  { id: "7", label: "Last 7 days" },
  { id: "30", label: "Last 30 days" },
  { id: "90", label: "Last 90 days" },
];

/**
 * Visit patterns — when people come, who they come to see, and how long they
 * stay. Answers the questions a manager asks when planning reception cover.
 * Residents are never counted as visits.
 */
export default function ReportsPage() {
  const [period, setPeriod] = useState<Period>("30");
  const { currentSiteId, currentSite } = useSite();
  const todayKey = format(new Date(), "yyyy-MM-dd");
  // Stable dates (start of day) so the query does not refetch on every render.
  const { from, to } = useMemo(() => {
    const today = startOfDay(new Date(`${todayKey}T00:00:00`));
    return { from: subDays(today, Number(period) - 1), to: addDays(today, 1) };
  }, [todayKey, period]);
  const { visits, loading, error, refetch } = useVisitsInRange(from, to);
  const { residents } = useResidents();
  const residentNames = useMemo(() => residents.map((r) => r.name), [residents]);
  const p = useMemo(() => visitPatterns(visits, from, new Date(to.getTime() - 1), residentNames), [visits, from, to, residentNames]);

  const periodLabel = PERIODS.find((x) => x.id === period)!.label.toLowerCase();
  const typeSeries = p.typesPresent.map((t) => ({ key: t, label: PATTERN_TYPE_LABEL[t], color: TYPE_COLOR[t] }));
  const busiestWeekday = [...p.byWeekday].sort((a, b) => b.average - a.average)[0];
  const quietHours = p.byHour.filter((h) => h.hour >= 7 && h.hour <= 21);

  const exportDaily = () => exportCsvAudited(
    ["Date", "All visits", ...p.typesPresent.map((t) => PATTERN_TYPE_LABEL[t])],
    p.byDay.map((d) => [format(d.date, "yyyy-MM-dd"), d.total, ...p.typesPresent.map((t) => d[t])]),
    { filenamePrefix: "visit-patterns", auditAction: "visit_patterns_export", siteId: currentSiteId, siteName: currentSite?.name ?? null, scopeNote: `Daily counts, ${periodLabel}` },
  );

  return (
    <AppShell
      title="Visit patterns"
      mainClassName="p-4 sm:p-6"
      subtitle="When people visit, who they come to see and how long they stay. Use it to plan reception cover and spot residents who may be lonely."
      eyebrow="Reports"
      actions={<Button variant="outline" onClick={exportDaily} disabled={loading || p.total === 0}><Download className="h-4 w-4" />Download daily counts</Button>}
      headerContent={<ChoiceChips label="Period" options={PERIODS} value={period} onChange={(v) => setPeriod(v as Period)} />}
    >
      <div className="space-y-5">
        {error && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[hsl(var(--destructive)/0.4)] bg-error-subtle p-4 text-sm font-semibold text-destructive">
            {error}
            <Button variant="outline" size="sm" onClick={() => void refetch()}><RefreshCw className="h-4 w-4" />Try again</Button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="Visits" icon={TrendingUp} value={loading ? "…" : p.total} note={periodLabel} />
          <StatTile label="Different people" icon={Users} value={loading ? "…" : p.people} note="Counted once each" />
          <StatTile label="Average visit" icon={Clock} value={loading ? "…" : minutesLabel(p.averageMinutes)} note="Visits that signed out" />
          <StatTile label="Busiest day" icon={CalendarDays}
            value={loading ? "…" : p.busiestDay ? format(p.busiestDay.date, "EEE d MMM") : "—"}
            note={p.busiestDay ? `${p.busiestDay.count} visits` : "No visits yet"} />
        </div>

        {!loading && p.total === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
            <p className="text-base font-extrabold text-foreground">No visits in the {periodLabel}</p>
            <p className="mt-1 text-sm text-muted-foreground">Try a longer period, or check the visitor report for older records.</p>
            <Button asChild variant="outline" className="mt-4"><Link to="/reports/visitor-report">Open visitor report</Link></Button>
          </div>
        ) : (
          <>
            <ChartCard title="Visits each day" description="Stacked by who visited">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={p.byDay} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={16} />
                    <YAxis allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "hsl(var(--muted))" }} />
                    {typeSeries.map((s, i) => (
                      <Bar isAnimationActive={false} key={s.key} dataKey={s.key} name={s.label} stackId="day" fill={s.color} maxBarSize={36}
                        radius={i === typeSeries.length - 1 ? [4, 4, 0, 0] : 0} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <Legend items={typeSeries} />
            </ChartCard>

            <div className="grid gap-5 lg:grid-cols-2">
              <ChartCard title="Busiest times of day" description={p.peakHour !== null ? `Most arrivals around ${hourLabel(p.peakHour)}` : "Arrivals by hour"}>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={quietHours} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} interval={1} />
                      <YAxis allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "hsl(var(--muted))" }} />
                      <Bar isAnimationActive={false} dataKey="count" name="Arrivals" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">Shows 7 AM to 9 PM.</p>
              </ChartCard>

              <ChartCard title="Average visits by weekday" description={busiestWeekday?.average ? `${busiestWeekday.day} is usually busiest` : "Per day of the week"}>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={p.byWeekday} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="day" tick={axisTick} tickLine={false} axisLine={false} />
                      <YAxis tick={axisTick} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "hsl(var(--muted))" }} />
                      <Bar isAnimationActive={false} dataKey="average" name="Average visits" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <ChartCard title="Residents with the most visitors" description="Family and friends only, not contractors or staff">
                {p.topResidents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No family or friend visits named a resident in this period.</p>
                ) : (
                  <ol className="space-y-2.5">
                    {p.topResidents.map((r) => (
                      <li key={r.name} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3 text-sm">
                        <span className="truncate font-bold text-foreground">{r.name}</span>
                        <span className="h-2.5 rounded-full bg-muted" aria-hidden>
                          <span className="block h-full rounded-full bg-[hsl(var(--chart-1))]" style={{ width: `${(r.count / p.topResidents[0].count) * 100}%` }} />
                        </span>
                        <span className="tabular-nums font-semibold text-foreground">{r.count} {r.count === 1 ? "visit" : "visits"}</span>
                      </li>
                    ))}
                  </ol>
                )}
                {p.residentsWithoutVisitors.length > 0 && (
                  <div className="mt-5 rounded-xl border border-[hsl(var(--warning)/0.45)] bg-warning-subtle/50 p-4">
                    <p className="flex items-center gap-2 text-sm font-extrabold text-warning-strong">
                      <HeartHandshake className="h-4 w-4" aria-hidden />
                      {p.residentsWithoutVisitors.length} {p.residentsWithoutVisitors.length === 1 ? "resident has" : "residents have"} had no visitors in the {periodLabel}
                    </p>
                    <p className="mt-1 text-sm text-foreground">{p.residentsWithoutVisitors.slice(0, 12).join(", ")}{p.residentsWithoutVisitors.length > 12 ? ` and ${p.residentsWithoutVisitors.length - 12} more` : ""}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Worth sharing with their key worker or the activities team.</p>
                  </div>
                )}
              </ChartCard>

              <ChartCard title="How long people stay" description="Average visit length by type">
                {p.lengthByType.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No one has signed out yet in this period.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {p.lengthByType.map((l) => (
                      <li key={l.type} className="flex items-center justify-between gap-3 py-3 text-sm">
                        <span className="flex items-center gap-2 font-bold text-foreground">
                          <span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ background: TYPE_COLOR[l.type] }} />{l.label}
                        </span>
                        <span className="text-right">
                          <span className="font-extrabold tabular-nums text-foreground">{minutesLabel(l.minutes)}</span>
                          <span className="block text-xs text-muted-foreground">{l.visits} {l.visits === 1 ? "visit" : "visits"}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </ChartCard>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
