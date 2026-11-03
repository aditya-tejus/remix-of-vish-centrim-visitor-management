import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { addDays, format, startOfDay, subDays } from "date-fns";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, Download, MessageSquare, Star, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/reception-primitives";
import { ChartCard, ChoiceChips, axisTick, tooltipStyle } from "@/components/reports/ReportParts";
import { RatingPill } from "@/components/feedback/RatingPill";
import { useFeedbackQuestions, useFeedbackResponses, useFeedbackSurveys } from "@/hooks/useFeedback";
import { useSite } from "@/contexts/SiteContext";
import { useToast } from "@/hooks/use-toast";
import { exportCsvAudited } from "@/lib/exportAudit";
import { RATING_LABEL, feedbackSummary } from "@/lib/feedbackView";

type Period = "7" | "30" | "90";
const PERIODS: { id: Period; label: string }[] = [
  { id: "7", label: "Last 7 days" }, { id: "30", label: "Last 30 days" }, { id: "90", label: "Last 90 days" },
];

/** Feedback summary: how people rate the home, and which low scores still need a reply. */
export function FeedbackReports({ period = "30" }: { period?: Period }) {
  const { data: questions = [] } = useFeedbackQuestions();
  const { data: responses = [], isLoading } = useFeedbackResponses(1000);
  const { data: surveys = [] } = useFeedbackSurveys();
  const todayKey = format(new Date(), "yyyy-MM-dd");
  const { from, to } = useMemo(() => {
    const today = startOfDay(new Date(`${todayKey}T00:00:00`));
    return { from: subDays(today, Number(period) - 1), to: new Date(addDays(today, 1).getTime() - 1) };
  }, [todayKey, period]);
  const s = useMemo(() => feedbackSummary(responses, from, to, surveys), [responses, from, to, surveys]);
  const question = (id: string) => questions.find((q) => q.id === id)?.question;
  const periodLabel = PERIODS.find((p) => p.id === period)!.label.toLowerCase();
  const maxRating = Math.max(1, ...s.byRating.map((b) => b.count));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Average rating" icon={Star} value={isLoading ? "…" : s.average ?? "—"} note={s.average ? `Out of 5 · ${RATING_LABEL[Math.round(s.average)]}` : "No ratings yet"} />
        <StatTile label="Responses" icon={MessageSquare} value={isLoading ? "…" : s.count} note={periodLabel} />
        <StatTile label="Different people" icon={Users} value={isLoading ? "…" : s.people} />
        <StatTile label="Need follow-up" icon={AlertTriangle} value={isLoading ? "…" : s.followUps.length}
          tone={s.followUps.length > 0 ? "attention" : "neutral"} note={s.count ? `${s.lowShare}% rated 1 or 2` : undefined} />
      </div>

      {!isLoading && s.count === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
          <p className="text-base font-extrabold text-foreground">No feedback in the {periodLabel}</p>
          <p className="mt-1 text-sm text-muted-foreground">Try a longer period, or check that a survey is switched on in Settings.</p>
        </div>
      ) : (
        <>
          <ChartCard title="Low ratings to follow up" description="Rated 1 or 2. Contact the person or share with the manager."
            aside={s.followUps.length > 0 ? <Button asChild variant="outline" size="sm"><Link to="/reports/feedback-responses?rating=low">See all</Link></Button> : undefined}>
            {s.followUps.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing rated 1 or 2 in the {periodLabel}.</p>
            ) : (
              <ul className="divide-y divide-border">
                {s.followUps.slice(0, 6).map((r) => (
                  <li key={r.id} className="flex items-start gap-3 py-3">
                    <RatingPill rating={r.rating} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-foreground">{r.visitor_name || "Anonymous"} <span className="font-semibold capitalize text-muted-foreground">· {r.visitor_type} · {format(new Date(r.created_at), "EEE d MMM, h:mm a")}</span></p>
                      {question(r.question_id) && <p className="text-[13px] text-muted-foreground">{question(r.question_id)}</p>}
                      <p className="mt-1 text-sm text-foreground">{r.comment ? `“${r.comment}”` : <span className="text-muted-foreground">No comment left</span>}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </ChartCard>

          <div className="grid gap-5 lg:grid-cols-2">
            <ChartCard title="Responses each day">
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={s.byDay} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={16} />
                    <YAxis allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "hsl(var(--muted))" }} />
                    <Bar isAnimationActive={false} dataKey="count" name="Responses" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} maxBarSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
            <ChartCard title="Average rating each day" description="1 is very poor, 5 is very good. Days without feedback are left blank.">
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={s.byDay} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={16} />
                    <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={axisTick} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Line isAnimationActive={false} type="linear" dataKey="average" name="Average rating" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <ChartCard title="How people rated" description="Every answer in the period">
              <ul className="space-y-2.5">
                {s.byRating.map((b) => (
                  <li key={b.rating} className="grid grid-cols-[6.5rem_1fr_2.5rem] items-center gap-3 text-sm">
                    <span className="font-bold text-foreground">{b.rating} · {b.label}</span>
                    <span className="h-2.5 rounded-full bg-muted" aria-hidden><span className="block h-full rounded-full bg-[hsl(var(--chart-1))]" style={{ width: `${(b.count / maxRating) * 100}%` }} /></span>
                    <span className="text-right tabular-nums font-semibold text-foreground">{b.count}</span>
                  </li>
                ))}
              </ul>
            </ChartCard>
            <ChartCard title="By survey">
              {s.bySurvey.length === 0 ? <p className="text-sm text-muted-foreground">No survey answers in this period.</p> : (
                <ul className="divide-y divide-border">
                  {s.bySurvey.map((x) => (
                    <li key={x.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                      <span className="min-w-0 truncate font-bold text-foreground">{x.title}</span>
                      <span className="shrink-0 text-right"><span className="font-extrabold tabular-nums text-foreground">{x.average} / 5</span>
                        <span className="block text-xs text-muted-foreground">{x.count} {x.count === 1 ? "answer" : "answers"}</span></span>
                    </li>
                  ))}
                </ul>
              )}
            </ChartCard>
          </div>
        </>
      )}
    </div>
  );
}

export { PERIODS as FEEDBACK_PERIODS };
export type { Period as FeedbackPeriod };

/** Header controls for the feedback summary page. */
export function FeedbackReportsActions({ period }: { period: Period }) {
  const { toast } = useToast();
  const { currentSiteId, currentSite } = useSite();
  const { data: questions = [] } = useFeedbackQuestions();
  const { data: responses = [] } = useFeedbackResponses(1000);
  const { data: surveys = [] } = useFeedbackSurveys();
  const download = async () => {
    const from = startOfDay(subDays(new Date(), Number(period) - 1));
    const rows = responses.filter((r) => new Date(r.created_at) >= from);
    await exportCsvAudited(
      ["Date", "Name", "Type", "Survey", "Question", "Rating", "Comment"],
      rows.map((r) => [format(new Date(r.created_at), "yyyy-MM-dd HH:mm"), r.visitor_name, r.visitor_type,
        surveys.find((s) => s.id === r.survey_id)?.title ?? "", questions.find((q) => q.id === r.question_id)?.question ?? "", r.rating, r.comment ?? ""]),
      { filenamePrefix: "feedback", auditAction: "feedback_export", siteId: currentSiteId, siteName: currentSite?.name ?? null, scopeNote: `Last ${period} days` },
    );
    toast({ title: "Download ready", description: "This download is recorded in the audit trail." });
  };
  return <Button variant="outline" onClick={download} disabled={responses.length === 0}><Download className="h-4 w-4" />Download</Button>;
}

export function FeedbackPeriodChips({ period, onPeriod }: { period: Period; onPeriod: (p: Period) => void }) {
  return <ChoiceChips label="Period" options={PERIODS} value={period} onChange={(v) => onPeriod(v as Period)} />;
}
