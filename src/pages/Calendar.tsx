import { useMemo, useState } from "react";
import {
  addDays, addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth,
  isToday, startOfMonth, startOfWeek, subMonths,
} from "date-fns";
import { AlertTriangle, ChevronLeft, ChevronRight, Clock, Home, LogIn, LogOut, RotateCw, Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { VisitorProfile } from "@/components/VisitorProfile";
import { useVisitors } from "@/hooks/useVisitors";
import { useResidents } from "@/hooks/useResidents";
import { useVisitsInRange } from "@/hooks/useVisitsInRange";
import {
  busyLevel, dayKey, durationLabel, hourLabel, indexByDay, monthInsights, summariseMonth,
  type CalendarTypeFilter, type MonthInsights,
} from "@/lib/visitCalendar";
import type { Visitor } from "@/types/visitor";
import { cn } from "@/lib/utils";

const FILTERS: { id: CalendarTypeFilter; label: string }[] = [
  { id: "all", label: "Everyone" },
  { id: "visitor", label: "Visitors" },
  { id: "contractor", label: "Contractors" },
  { id: "volunteer", label: "Volunteers" },
  { id: "staff", label: "Staff" },
];
const TYPE_LABEL: Record<string, string> = { visitor: "Visitor", contractor: "Contractor", volunteer: "Volunteer", staff: "Staff", other: "Other" };
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
/** Busyness shades from the design system's blue scale (blue-50 to blue-300 tints). */
const BUSY_BG = ["bg-card", "bg-[#eaf1ff]", "bg-[#d7e5ff]", "bg-[#a7cbfb]/70", "bg-[#77b0f8]/60"];

/**
 * Visit calendar — who visited on any day, and which residents are due back.
 * The page names itself in the body (eyebrow, title, description) because the
 * Centrim Life app header does not carry the page title.
 */
export default function CalendarPage() {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState<Date>(() => new Date());
  const [filter, setFilter] = useState<CalendarTypeFilter>("all");
  const [profile, setProfile] = useState<Visitor | null>(null);

  const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const { visits, loading, error, refetch } = useVisitsInRange(gridStart, addDays(gridEnd, 1));
  const { visitors: today } = useVisitors(); // residents currently away, for "due back"

  const index = useMemo(() => indexByDay(visits, filter), [visits, filter]);
  const summary = useMemo(() => summariseMonth(index, month), [index, month]);
  const { residents } = useResidents();
  const residentNames = useMemo(() => residents.map((r) => r.name), [residents]);
  // Resident visit counts always use the full list: only "Visitors" are social visits.
  const insights = useMemo(() => monthInsights(index, month, residentNames), [index, month, residentNames]);
  const social = useMemo(() => monthInsights(indexByDay(visits, "visitor"), month, residentNames), [visits, month, residentNames]);
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const dueBack = useMemo(() => {
    const m = new Map<string, Visitor[]>();
    for (const r of today) {
      if (r.type !== "resident" || r.status === "checked-in" || !r.expectedReturnDate) continue;
      const k = dayKey(r.expectedReturnDate);
      const list = m.get(k);
      if (list) list.push(r); else m.set(k, [r]);
    }
    return m;
  }, [today]);

  const dayVisits = index.get(dayKey(selected)) ?? [];
  const dayDueBack = dueBack.get(dayKey(selected)) ?? [];
  const onSite = dayVisits.filter((v) => !v.checkOutTime);
  const left = dayVisits.filter((v) => v.checkOutTime);

  const goTo = (d: Date) => { setMonth(startOfMonth(d)); setSelected(d); };

  return (
    <AppShell title="Visit calendar" pageHeader={false} mainClassName="p-4 sm:p-6 space-y-6">
      {/* Page header card (design system pattern): eyebrow, title, description, filters */}
      <section aria-labelledby="calendar-title" className="grid gap-6 rounded-[20px] border border-border bg-card p-4 shadow-sm sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)] lg:items-center">
        <div className="min-w-0">
        <p className="text-[11px] font-extrabold uppercase leading-4 tracking-[0.06em] text-primary">Visitors</p>
        <h1 id="calendar-title" className="mt-1 text-[28px] font-extrabold leading-9 text-foreground">Visit calendar</h1>
        <p className="mt-1 text-sm text-muted-foreground">See who visited on any day, and which residents are due back.</p>

        <div role="group" aria-label="Show" className="mt-4 flex flex-wrap gap-2">
          {FILTERS.map((f) => {
            const on = filter === f.id;
            return (
              <button
                key={f.id}
                aria-pressed={on}
                onClick={() => setFilter(f.id)}
                className={cn(
                  "min-h-11 rounded-full border px-4 text-sm font-bold transition-colors",
                  on ? "border-primary bg-accent text-accent-foreground" : "border-input bg-card text-foreground hover:border-primary/60",
                )}
              >
                {f.label}
              </button>
            );
          })}
        </div>
        </div>

        {/* Month at a glance — fills the header's spare width on large screens */}
        <div aria-live="polite">
          <p className="mb-2 text-xs font-bold text-muted-foreground">{format(month, "MMMM yyyy")} at a glance</p>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Visits" value={loading ? "–" : String(summary.total)} />
            <Stat label="A day on average" value={loading ? "–" : String(insights.dailyAverage)} />
            <Stat
              label="Busiest day"
              value={loading || !summary.busiest ? "–" : format(summary.busiest.date, "EEE d")}
              note={summary.busiest && !loading ? `${summary.busiest.count} visits` : undefined}
            />
            <Stat label="Different people" value={loading ? "–" : String(insights.uniquePeople)} />
          </dl>
        </div>
      </section>

      {/* Phone order: month, chosen day, insights. Wide screens: day panel runs down the right. */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px] xl:items-start">
        {/* Month */}
        <section aria-label={format(month, "MMMM yyyy")} className="min-w-0 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" aria-label="Previous month" onClick={() => setMonth((m) => subMonths(m, 1))} className="h-11 w-11 rounded-lg border-input">
                <ChevronLeft aria-hidden className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" aria-label="Next month" onClick={() => setMonth((m) => addMonths(m, 1))} className="h-11 w-11 rounded-lg border-input">
                <ChevronRight aria-hidden className="h-4 w-4" />
              </Button>
            </div>
            <h3 className="text-xl font-extrabold leading-7 text-foreground">{format(month, "MMMM yyyy")}</h3>
            {!(isSameMonth(month, new Date()) && isToday(selected)) && (
              <Button variant="outline" onClick={() => goTo(new Date())} className="h-11 rounded-lg border-input font-bold">Today</Button>
            )}
            <p className="w-full text-[13px] leading-[18px] text-muted-foreground sm:ml-auto sm:w-auto">
              {loading ? "Loading visits…" : summary.total === 0 ? "No visits recorded this month" : "Choose a day to see who came"}
            </p>
          </div>

          {error ? (
            <div role="alert" className="mt-6 flex flex-col items-center gap-3 rounded-xl border border-border px-6 py-10 text-center">
              <p className="text-sm font-bold">{error}</p>
              <Button variant="outline" onClick={() => void refetch()} className="h-11 gap-2 rounded-lg border-input font-bold"><RotateCw aria-hidden className="h-4 w-4" />Try again</Button>
            </div>
          ) : (
            <>
              <div aria-hidden className="mt-5 grid grid-cols-7 gap-1.5 pb-2">
                {WEEKDAYS.map((d) => <span key={d} className="text-center text-xs font-bold text-muted-foreground">{d}</span>)}
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {days.map((d) => {
                  const k = dayKey(d);
                  const count = index.get(k)?.length ?? 0;
                  const due = dueBack.get(k)?.length ?? 0;
                  const inMonth = isSameMonth(d, month);
                  const isSel = isSameDay(d, selected);
                  const level = inMonth ? busyLevel(count, summary.max) : 0;
                  const label = `${format(d, "EEEE d MMMM")}: ${count} visit${count === 1 ? "" : "s"}${due ? `, ${due} resident${due === 1 ? "" : "s"} due back` : ""}`;
                  return (
                    <button
                      key={k}
                      aria-label={label}
                      aria-pressed={isSel}
                      onClick={() => { setSelected(d); if (!inMonth) setMonth(startOfMonth(d)); }}
                      className={cn(
                        "relative flex min-h-[60px] flex-col items-start justify-between rounded-lg border p-2 text-left transition-colors sm:min-h-[76px]",
                        BUSY_BG[level],
                        inMonth ? "border-border" : "border-transparent bg-secondary text-muted-foreground",
                        isSel && "border-primary ring-2 ring-primary",
                        "hover:border-primary/60",
                      )}
                    >
                      <span className={cn(
                        "flex h-7 min-w-7 items-center justify-center rounded-full px-1 text-[13px] font-bold",
                        isToday(d) ? "bg-primary text-primary-foreground" : inMonth ? "text-foreground" : "text-muted-foreground",
                      )}>
                        {format(d, "d")}
                      </span>
                      <span className="flex w-full flex-wrap items-end justify-between gap-1">
                        {count > 0 && (
                          <span className="flex items-baseline gap-1 leading-none">
                            <span className={cn("text-sm font-extrabold tabular-nums sm:text-lg", inMonth ? "text-foreground" : "text-muted-foreground")}>{count}</span>
                            <span className="hidden text-[11px] font-semibold text-muted-foreground md:inline">visit{count === 1 ? "" : "s"}</span>
                          </span>
                        )}
                        {due > 0 && (
                          <span title={`${due} due back`} className="inline-flex items-center gap-0.5 rounded-full bg-[hsl(var(--info)/0.12)] px-1.5 text-[11px] font-bold leading-5 text-info-strong">
                            <Home aria-hidden className="h-3 w-3" />{due}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  Quieter
                  {BUSY_BG.slice(1).map((c) => <span key={c} aria-hidden className={cn("h-3 w-5 rounded border border-border", c)} />)}
                  Busier
                </span>
                <span className="inline-flex items-center gap-1"><Home aria-hidden className="h-3.5 w-3.5 text-info-strong" />Resident due back</span>
              </div>
            </>
          )}
        </section>

        {/* Selected day */}
        <section aria-labelledby="day-title" className="w-full rounded-2xl border border-border bg-card shadow-sm xl:sticky xl:top-6 xl:col-start-2 xl:row-span-2 xl:row-start-1">
          <div className="border-b border-border p-4 sm:p-5">
            <h3 id="day-title" className="text-lg font-extrabold leading-[26px] text-foreground">
              {isToday(selected) ? "Today, " : ""}{format(selected, isToday(selected) ? "d MMMM" : "EEEE d MMMM")}
            </h3>
            <p className="text-[13px] leading-[18px] text-muted-foreground">
              {dayVisits.length} visit{dayVisits.length === 1 ? "" : "s"}
              {onSite.length > 0 && <> · <span className="font-bold text-success-strong">{onSite.length} still on site</span></>}
            </p>
          </div>

          <div className="max-h-[70vh] overflow-y-auto xl:max-h-[calc(100vh-11rem)]">
            {dayDueBack.length > 0 && (
              <DayGroup title="Residents due back">
                {dayDueBack.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                    <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--info)/0.12)] text-info-strong"><Home className="h-4 w-4" /></span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{r.firstName} {r.surname}</p>
                      <p className="text-[13px] text-muted-foreground">Expected {format(r.expectedReturnDate!, "h:mm a")}{r.leaveType ? ` · ${r.leaveType}` : ""}</p>
                    </div>
                  </li>
                ))}
              </DayGroup>
            )}

            {dayVisits.length === 0 && dayDueBack.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <p className="text-sm font-bold">No visits on this day.</p>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  {filter === "all" ? "Choose another day on the calendar." : "Try Everyone, or choose another day."}
                </p>
              </div>
            ) : (
              <>
                {onSite.length > 0 && <DayGroup title="Still on site">{onSite.map((v) => <VisitRow key={v.id} v={v} onOpen={() => setProfile(v)} />)}</DayGroup>}
                {left.length > 0 && <DayGroup title="Signed out">{left.map((v) => <VisitRow key={v.id} v={v} onOpen={() => setProfile(v)} />)}</DayGroup>}
              </>
            )}
          </div>
        </section>

        {!error && (
          <div className="grid min-w-0 gap-6 md:grid-cols-2 xl:col-start-1">
            <ArrivalsByHour insights={insights} loading={loading} month={month} />
            <ResidentsVisits social={social} loading={loading} month={month} />
          </div>
        )}
      </div>

      <VisitorProfile visitor={profile} allVisitors={visits} open={!!profile} onOpenChange={(o) => { if (!o) setProfile(null); }} />
    </AppShell>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl bg-secondary px-3 py-2.5">
      <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-2xl font-extrabold leading-8 tabular-nums text-foreground">
        {value}
        {note && <span className="block text-xs font-semibold leading-4 text-muted-foreground">{note}</span>}
      </dd>
    </div>
  );
}

function InsightCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <h3 className="text-base font-extrabold leading-6 text-foreground">{title}</h3>
      <p className="text-[13px] leading-[18px] text-muted-foreground">{description}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Single-series bar chart: arrivals per hour across the month, peak hour named in text. */
function ArrivalsByHour({ insights, loading, month }: { insights: MonthInsights; loading: boolean; month: Date }) {
  const { byHour, peakHour } = insights;
  const used = byHour.map((n, h) => (n > 0 ? h : -1)).filter((h) => h >= 0);
  const first = Math.min(7, ...(used.length ? used : [7]));
  const last = Math.max(20, ...(used.length ? used : [20]));
  const hours = Array.from({ length: last - first + 1 }, (_, i) => first + i);
  const max = Math.max(1, ...byHour);
  return (
    <InsightCard title="When people arrive" description={`Sign-ins by hour, ${format(month, "MMMM")}`}>
      {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : peakHour === null ? (
        <p className="text-sm text-muted-foreground">No arrivals recorded this month.</p>
      ) : (
        <>
          <p className="flex items-center gap-2 text-sm text-foreground">
            <Clock aria-hidden className="h-4 w-4 text-primary" />
            Busiest from <span className="font-bold">{hourLabel(peakHour)} to {hourLabel((peakHour + 1) % 24)}</span>
          </p>
          <div role="img" aria-label={`Arrivals by hour. Busiest ${hourLabel(peakHour)} with ${byHour[peakHour]} arrivals.`} className="mt-4">
            <div className="flex h-28 items-end gap-[2px] border-b border-border">
              {hours.map((h) => (
                <div key={h} className="group relative flex h-full flex-1 items-end">
                  <div
                    className={cn("w-full rounded-t-[4px]", h === peakHour ? "bg-primary" : "bg-primary/45")}
                    style={{ height: `${(byHour[h] / max) * 100}%`, minHeight: byHour[h] ? 2 : 0 }}
                  />
                  <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs font-semibold text-background shadow group-hover:block">
                    {hourLabel(h)}: {byHour[h]}
                  </span>
                </div>
              ))}
            </div>
            <div aria-hidden className="mt-1 flex gap-[2px] text-[11px] text-muted-foreground">
              {hours.map((h) => <span key={h} className="flex-1 text-center">{(h - first) % 3 === 0 ? hourLabel(h).replace(" ", "") : ""}</span>)}
            </div>
          </div>
          <ul className="sr-only">{hours.map((h) => <li key={h}>{hourLabel(h)}: {byHour[h]} arrivals</li>)}</ul>
        </>
      )}
    </InsightCard>
  );
}

/** Who is getting visitors, and who is not — a wellbeing prompt for care staff. */
function ResidentsVisits({ social, loading, month }: { social: MonthInsights; loading: boolean; month: Date }) {
  const [showAll, setShowAll] = useState(false);
  const top = social.topResidents;
  const none = social.residentsWithoutVisits;
  const max = Math.max(1, ...top.map((r) => r.count));
  const shown = showAll ? none : none.slice(0, 6);
  return (
    <InsightCard title="Residents and their visitors" description={`Social visits in ${format(month, "MMMM")} (visitors only)`}>
      {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
        <div className="space-y-4">
          {top.length === 0 ? (
            <p className="text-sm text-muted-foreground">No social visits recorded this month.</p>
          ) : (
            <ol className="space-y-2.5">
              {top.map((r) => (
                <li key={r.name} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm">
                  <span className="truncate font-semibold text-foreground">{r.name}</span>
                  <span aria-hidden className="h-2 rounded-full bg-secondary">
                    <span className="block h-2 rounded-full bg-primary/70" style={{ width: `${(r.count / max) * 100}%` }} />
                  </span>
                  <span className="text-xs font-bold tabular-nums text-muted-foreground">{r.count}</span>
                </li>
              ))}
            </ol>
          )}
          {none.length > 0 && (
            <div className="rounded-xl border border-[hsl(var(--warning)/0.35)] bg-[hsl(var(--warning)/0.08)] p-3">
              <p className="flex items-center gap-2 text-sm font-bold text-warning-strong">
                <AlertTriangle aria-hidden className="h-4 w-4 shrink-0" />
                {none.length} resident{none.length === 1 ? " has" : "s have"} had no visitors this month
              </p>
              <p className="mt-1 text-[13px] leading-5 text-foreground">
                {shown.join(", ")}
                {none.length > 6 && (
                  <button onClick={() => setShowAll((s) => !s)} className="ml-1 font-bold text-primary underline-offset-4 hover:underline">
                    {showAll ? "Show fewer" : `and ${none.length - 6} more`}
                  </button>
                )}
              </p>
            </div>
          )}
          {top.length > 0 && none.length === 0 && (
            <p className="flex items-center gap-2 text-[13px] text-muted-foreground"><Users aria-hidden className="h-4 w-4" />Every resident has had at least one visitor.</p>
          )}
        </div>
      )}
    </InsightCard>
  );
}

function DayGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="sticky top-0 z-10 bg-secondary px-4 py-2 text-xs font-bold text-muted-foreground sm:px-5">{title}</h4>
      <ul className="divide-y divide-border">{children}</ul>
    </div>
  );
}

function VisitRow({ v, onOpen }: { v: Visitor; onOpen: () => void }) {
  const initials = `${v.firstName?.[0] ?? ""}${v.surname?.[0] ?? ""}`.toUpperCase();
  return (
    <li className="flex items-start gap-3 px-4 py-3 sm:px-5">
      <span aria-hidden className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-extrabold text-accent-foreground">{initials}</span>
      <div className="min-w-0 flex-1">
        <button onClick={onOpen} className="block max-w-full truncate rounded text-left text-sm font-bold text-foreground underline-offset-4 hover:text-primary hover:underline">
          {v.firstName} {v.surname}<span className="sr-only">, open profile</span>
        </button>
        <p className="truncate text-[13px] leading-[18px] text-muted-foreground">
          {TYPE_LABEL[v.type] ?? v.type}{v.whomToVisit ? <> · visiting <span className="font-semibold text-foreground">{v.whomToVisit}</span></> : null}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><LogIn aria-hidden className="h-3.5 w-3.5 text-success-strong" />{format(v.checkInTime, "h:mm a")}</span>
          {v.checkOutTime ? (
            <span className="inline-flex items-center gap-1"><LogOut aria-hidden className="h-3.5 w-3.5" />{format(v.checkOutTime, "h:mm a")}</span>
          ) : (
            <span className="rounded-full bg-[hsl(var(--success)/0.12)] px-2 font-bold leading-5 text-success-strong">On site</span>
          )}
          <span>{durationLabel(v.checkInTime, v.checkOutTime)}</span>
          {v.autoCheckedOut && <span className="font-semibold text-warning-strong">Signed out automatically</span>}
        </p>
      </div>
    </li>
  );
}
