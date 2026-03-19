import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useFeedbackQuestions, useFeedbackResponses, useFeedbackSurveys } from "@/hooks/useFeedback";
import { useToast } from "@/hooks/use-toast";
import { format, subDays, isWithinInterval, startOfDay, endOfDay, eachDayOfInterval, isSameDay } from "date-fns";
import { CalendarDays, Download, BarChart3 } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line,
} from "recharts";

const emojis = ["😞", "😕", "😐", "🙂", "😊"];
const COLORS = ["hsl(var(--primary))", "hsl(var(--success))", "hsl(var(--warning))", "hsl(var(--destructive))", "hsl(var(--muted-foreground))"];

export function FeedbackReports() {
  const { toast } = useToast();
  const { data: questions = [] } = useFeedbackQuestions();
  const { data: responses = [] } = useFeedbackResponses(1000);
  const { data: surveys = [] } = useFeedbackSurveys();
  const [dateRange, setDateRange] = useState({ from: subDays(new Date(), 30), to: new Date() });

  const filtered = useMemo(() =>
    responses.filter((r) => isWithinInterval(new Date(r.created_at), { start: startOfDay(dateRange.from), end: endOfDay(dateRange.to) })),
    [responses, dateRange]
  );

  const overallAvg = useMemo(() => filtered.length ? +(filtered.reduce((s, r) => s + r.rating, 0) / filtered.length).toFixed(1) : 0, [filtered]);
  const uniqueVisitors = useMemo(() => new Set(filtered.map((r) => r.visitor_name)).size, [filtered]);

  const ratingDist = useMemo(() => {
    const d = [0, 0, 0, 0, 0];
    filtered.forEach((r) => { if (r.rating >= 1 && r.rating <= 5) d[r.rating - 1]++; });
    return d.map((count, i) => ({ rating: `${emojis[i]} ${i + 1}`, count }));
  }, [filtered]);

  const dailyTrend = useMemo(() => {
    const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to }).slice(-30);
    return days.map((day) => {
      const dr = filtered.filter((r) => isSameDay(new Date(r.created_at), day));
      return { date: format(day, "dd MMM"), responses: dr.length, avg: dr.length ? +(dr.reduce((s, r) => s + r.rating, 0) / dr.length).toFixed(1) : 0 };
    });
  }, [filtered, dateRange]);

  const surveyBreakdown = useMemo(() => {
    return surveys.map((s) => {
      const sr = filtered.filter((r) => r.survey_id === s.id);
      return { name: s.title, count: sr.length, avg: sr.length ? +(sr.reduce((a, r) => a + r.rating, 0) / sr.length).toFixed(1) : 0 };
    }).filter((s) => s.count > 0);
  }, [filtered, surveys]);

  const exportCSV = () => {
    const activeQs = questions.filter((q) => q.is_active);
    const headers = ["Visitor", "Type", "Date", "Survey", "Rating", "Question", "Comment"];
    const rows = filtered.map((r) => {
      const q = questions.find((qq) => qq.id === r.question_id);
      const s = surveys.find((ss) => ss.id === r.survey_id);
      return [r.visitor_name, r.visitor_type, format(new Date(r.created_at), "dd/MM/yyyy"), s?.title || "—", String(r.rating), q?.question || "—", r.comment || ""];
    });
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `feedback-${format(new Date(), "yyyy-MM-dd")}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Report exported" });
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center gap-2 justify-between">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
              <CalendarDays className="h-3.5 w-3.5" />
              {format(dateRange.from, "dd MMM")} – {format(dateRange.to, "dd MMM")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <div className="p-3 space-y-2">
              <div className="flex gap-2">
                {[7, 14, 30, 90].map((d) => (
                  <Button key={d} variant="outline" size="sm" className="text-xs h-7" onClick={() => setDateRange({ from: subDays(new Date(), d), to: new Date() })}>{d}d</Button>
                ))}
              </div>
              <Calendar mode="range" selected={{ from: dateRange.from, to: dateRange.to }} onSelect={(r) => { if (r?.from) setDateRange({ from: r.from, to: r.to || r.from }); }} />
            </div>
          </PopoverContent>
        </Popover>
        <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5 h-8">
          <Download className="h-3.5 w-3.5" /> Export CSV
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-card p-4 border-l-4 border-l-primary">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Overall Rating</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-2xl font-bold text-foreground">{overallAvg}</span>
            <span className="text-xl">{emojis[Math.round(overallAvg) - 1] || "—"}</span>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 border-l-4 border-l-success">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Total Responses</p>
          <p className="text-2xl font-bold text-foreground mt-1">{filtered.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 border-l-4 border-l-warning">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Unique People</p>
          <p className="text-2xl font-bold text-foreground mt-1">{uniqueVisitors}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 border-l-4 border-l-destructive">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Active Surveys</p>
          <p className="text-2xl font-bold text-foreground mt-1">{surveys.filter((s) => s.is_active).length}</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">Rating Distribution</h3>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ratingDist}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="rating" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                  <Bar dataKey="count" fill={COLORS[0]} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">Daily Trend</h3>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                  <Line type="monotone" dataKey="responses" stroke={COLORS[0]} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="avg" stroke={COLORS[1]} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {surveyBreakdown.length > 0 && (
          <Card className="lg:col-span-2">
            <CardContent className="p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">By Survey</h3>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={surveyBreakdown} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                    <YAxis dataKey="name" type="category" width={150} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                    <Bar dataKey="count" name="Responses" fill={COLORS[0]} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
