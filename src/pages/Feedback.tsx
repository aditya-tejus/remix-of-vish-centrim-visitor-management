import { useState, useMemo } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useFeedbackQuestions, useFeedbackResponses, useFeedbackMutations } from "@/hooks/useFeedback";
import { useToast } from "@/hooks/use-toast";
import {
  MessageSquare, Star, Download, BarChart3, TrendingUp, PieChart as PieChartIcon,
  CalendarDays, Filter,
} from "lucide-react";
import { format, subDays, isSameDay, startOfWeek, endOfWeek, eachDayOfInterval, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from "recharts";

const emojis = ["😞", "😕", "😐", "🙂", "😊"];
const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--success))",
  "hsl(var(--warning))",
  "hsl(var(--destructive))",
  "hsl(var(--muted-foreground))",
  "#8b5cf6",
];

export default function Feedback() {
  const { toast } = useToast();
  const { data: questions = [] } = useFeedbackQuestions();
  const { data: responses = [] } = useFeedbackResponses(1000);
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [filterCategory, setFilterCategory] = useState("all");

  // Filtered responses by date range
  const filteredResponses = useMemo(() => {
    return responses.filter((r) =>
      isWithinInterval(new Date(r.created_at), {
        start: startOfDay(dateRange.from),
        end: endOfDay(dateRange.to),
      })
    );
  }, [responses, dateRange]);

  // Stats
  const overallAvg = useMemo(() => {
    if (filteredResponses.length === 0) return 0;
    return filteredResponses.reduce((s, r) => s + r.rating, 0) / filteredResponses.length;
  }, [filteredResponses]);

  const totalResponses = filteredResponses.length;
  const uniqueVisitors = useMemo(() => new Set(filteredResponses.map((r) => r.visitor_name)).size, [filteredResponses]);

  // Per-question avg
  const avgRatings = useMemo(() => {
    const map: Record<string, { sum: number; count: number }> = {};
    filteredResponses.forEach((r) => {
      if (!map[r.question_id]) map[r.question_id] = { sum: 0, count: 0 };
      map[r.question_id].sum += r.rating;
      map[r.question_id].count += 1;
    });
    return Object.fromEntries(Object.entries(map).map(([k, v]) => [k, v.sum / v.count]));
  }, [filteredResponses]);

  // Category breakdown
  const categoryBreakdown = useMemo(() => {
    const cats: Record<string, { count: number; totalRating: number }> = {};
    filteredResponses.forEach((r) => {
      const q = questions.find((qq) => qq.id === r.question_id);
      const cat = q?.category || "general";
      if (!cats[cat]) cats[cat] = { count: 0, totalRating: 0 };
      cats[cat].count++;
      cats[cat].totalRating += r.rating;
    });
    return Object.entries(cats).map(([name, v]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      count: v.count,
      avgRating: v.count > 0 ? +(v.totalRating / v.count).toFixed(1) : 0,
    }));
  }, [filteredResponses, questions]);

  // Daily trend
  const dailyTrend = useMemo(() => {
    const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
    // Limit to last 30 days max for chart readability
    const visibleDays = days.slice(-30);
    return visibleDays.map((day) => {
      const dayResponses = filteredResponses.filter((r) => isSameDay(new Date(r.created_at), day));
      const avg = dayResponses.length > 0
        ? +(dayResponses.reduce((s, r) => s + r.rating, 0) / dayResponses.length).toFixed(1)
        : 0;
      return {
        date: format(day, "dd MMM"),
        responses: dayResponses.length,
        avgRating: avg,
      };
    });
  }, [filteredResponses, dateRange]);

  // Rating distribution
  const ratingDistribution = useMemo(() => {
    const dist = [0, 0, 0, 0, 0];
    filteredResponses.forEach((r) => { if (r.rating >= 1 && r.rating <= 5) dist[r.rating - 1]++; });
    return dist.map((count, i) => ({ rating: `${emojis[i]} ${i + 1}`, count }));
  }, [filteredResponses]);

  // Weekly trend
  const weeklyTrend = useMemo(() => {
    const weeks: { week: string; count: number; avg: number }[] = [];
    for (let i = 3; i >= 0; i--) {
      const ws = startOfWeek(subDays(new Date(), i * 7), { weekStartsOn: 1 });
      const we = endOfWeek(subDays(new Date(), i * 7), { weekStartsOn: 1 });
      const weekResponses = responses.filter((r) =>
        isWithinInterval(new Date(r.created_at), { start: ws, end: we })
      );
      const avg = weekResponses.length > 0
        ? +(weekResponses.reduce((s, r) => s + r.rating, 0) / weekResponses.length).toFixed(1)
        : 0;
      weeks.push({
        week: `${format(ws, "dd MMM")}`,
        count: weekResponses.length,
        avg,
      });
    }
    return weeks;
  }, [responses]);

  const categories = [...new Set(questions.map((q) => q.category))];

  const exportCSV = () => {
    const activeQs = questions.filter((q) => q.is_active).sort((a, b) => a.sort_order - b.sort_order);
    const grouped: Record<string, typeof responses> = {};
    filteredResponses.forEach((r) => {
      const key = `${r.visitor_name}_${r.created_at.slice(0, 10)}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(r);
    });

    const headers = ["Visitor", "Type", "Date", ...activeQs.map((q) => q.question), ...activeQs.map((q) => `${q.question} (Comment)`)];
    const rows = Object.values(grouped).map((group) => {
      const first = group[0];
      const row = [first.visitor_name, first.visitor_type, format(new Date(first.created_at), "dd/MM/yyyy")];
      activeQs.forEach((q) => {
        const match = group.find((r) => r.question_id === q.id);
        row.push(match ? String(match.rating) : "");
      });
      activeQs.forEach((q) => {
        const match = group.find((r) => r.question_id === q.id);
        row.push(match?.comment || "");
      });
      return row;
    });

    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `feedback-report-${format(new Date(), "yyyy-MM-dd")}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Feedback exported" });
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex-1">
          <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur-sm">
            <div className="flex items-center justify-between px-6 py-4">
              <div className="flex items-center gap-4">
                <SidebarTrigger />
                <div>
                  <h1 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-primary" /> Feedback Report
                  </h1>
                  <p className="text-xs text-muted-foreground">Visitor feedback insights, trends, and analysis</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Date range filter */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {format(dateRange.from, "dd MMM")} – {format(dateRange.to, "dd MMM")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <div className="p-3 space-y-2">
                      <div className="flex gap-2">
                        {[7, 14, 30, 90].map((d) => (
                          <Button
                            key={d}
                            variant="outline"
                            size="sm"
                            className="text-xs h-7"
                            onClick={() => setDateRange({ from: subDays(new Date(), d), to: new Date() })}
                          >
                            {d}d
                          </Button>
                        ))}
                      </div>
                      <Calendar
                        mode="range"
                        selected={{ from: dateRange.from, to: dateRange.to }}
                        onSelect={(range) => {
                          if (range?.from) setDateRange({ from: range.from, to: range.to || range.from });
                        }}
                      />
                    </div>
                  </PopoverContent>
                </Popover>
                <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5 h-8">
                  <Download className="h-3.5 w-3.5" /> Export
                </Button>
              </div>
            </div>
          </header>

          <main className="p-6 space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="rounded-xl border border-border bg-card p-4 border-l-4 border-l-primary">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Overall Rating</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-2xl font-bold text-foreground">{overallAvg.toFixed(1)}</span>
                  <span className="text-xl">{emojis[Math.round(overallAvg) - 1] || "—"}</span>
                </div>
              </div>
              <div className="rounded-xl border border-border bg-card p-4 border-l-4 border-l-success">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Total Responses</p>
                <p className="text-2xl font-bold text-foreground mt-1">{totalResponses}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4 border-l-4 border-l-warning">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Unique Visitors</p>
                <p className="text-2xl font-bold text-foreground mt-1">{uniqueVisitors}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4 border-l-4 border-l-destructive">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Questions Active</p>
                <p className="text-2xl font-bold text-foreground mt-1">{questions.filter((q) => q.is_active).length}</p>
              </div>
            </div>

            <Tabs defaultValue="overview" className="space-y-4">
              <TabsList className="bg-muted/50 p-1 rounded-xl h-auto flex-wrap">
                <TabsTrigger value="overview" className="gap-1.5 rounded-lg text-xs data-[state=active]:shadow-sm">
                  <BarChart3 className="h-3.5 w-3.5" /> Overview
                </TabsTrigger>
                <TabsTrigger value="trends" className="gap-1.5 rounded-lg text-xs data-[state=active]:shadow-sm">
                  <TrendingUp className="h-3.5 w-3.5" /> Trends
                </TabsTrigger>
                <TabsTrigger value="categories" className="gap-1.5 rounded-lg text-xs data-[state=active]:shadow-sm">
                  <PieChartIcon className="h-3.5 w-3.5" /> By Category
                </TabsTrigger>
                <TabsTrigger value="responses" className="gap-1.5 rounded-lg text-xs data-[state=active]:shadow-sm">
                  <MessageSquare className="h-3.5 w-3.5" /> Responses
                </TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Per-question ratings */}
                  <Card>
                    <CardContent className="p-5">
                      <h3 className="text-sm font-semibold text-foreground mb-4">Question Ratings</h3>
                      <div className="space-y-3">
                        {questions.filter((q) => q.is_active).sort((a, b) => a.sort_order - b.sort_order).map((q) => {
                          const avg = avgRatings[q.id] || 0;
                          const count = filteredResponses.filter((r) => r.question_id === q.id).length;
                          return (
                            <div key={q.id} className="flex items-center gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-foreground truncate">{q.question}</p>
                                <p className="text-[10px] text-muted-foreground">{count} responses · {q.category}</p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-lg">{emojis[Math.round(avg) - 1] || "—"}</span>
                                <span className="text-sm font-bold text-foreground w-8 text-right">{avg ? avg.toFixed(1) : "—"}</span>
                                <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                                  <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${(avg / 5) * 100}%` }} />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {questions.filter((q) => q.is_active).length === 0 && (
                          <p className="text-xs text-muted-foreground py-4 text-center">No active questions</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Rating distribution */}
                  <Card>
                    <CardContent className="p-5">
                      <h3 className="text-sm font-semibold text-foreground mb-4">Rating Distribution</h3>
                      <div className="h-[220px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={ratingDistribution}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                            <XAxis dataKey="rating" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                            <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} allowDecimals={false} />
                            <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                            <Bar dataKey="count" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Trends Tab */}
              <TabsContent value="trends" className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardContent className="p-5">
                      <h3 className="text-sm font-semibold text-foreground mb-4">Daily Feedback Volume</h3>
                      <div className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={dailyTrend}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                            <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} interval="preserveStartEnd" />
                            <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} allowDecimals={false} />
                            <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                            <Bar dataKey="responses" name="Responses" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-5">
                      <h3 className="text-sm font-semibold text-foreground mb-4">Weekly Avg Rating & Volume</h3>
                      <div className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={weeklyTrend}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                            <XAxis dataKey="week" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                            <YAxis yAxisId="left" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} allowDecimals={false} />
                            <YAxis yAxisId="right" orientation="right" domain={[0, 5]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                            <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                            <Legend wrapperStyle={{ fontSize: "11px" }} />
                            <Bar yAxisId="left" dataKey="count" name="Responses" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} opacity={0.3} />
                            <Line yAxisId="right" type="monotone" dataKey="avg" name="Avg Rating" stroke={CHART_COLORS[1]} strokeWidth={2} dot={{ r: 4, fill: CHART_COLORS[1] }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardContent className="p-5">
                    <h3 className="text-sm font-semibold text-foreground mb-4">Daily Average Rating Trend</h3>
                    <div className="h-[250px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={dailyTrend.filter((d) => d.avgRating > 0)}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                          <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} interval="preserveStartEnd" />
                          <YAxis domain={[0, 5]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                          <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                          <Line type="monotone" dataKey="avgRating" name="Avg Rating" stroke={CHART_COLORS[0]} strokeWidth={2} dot={{ r: 3, fill: CHART_COLORS[0] }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Categories Tab */}
              <TabsContent value="categories" className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardContent className="p-5">
                      <h3 className="text-sm font-semibold text-foreground mb-4">Feedback by Category</h3>
                      <div className="h-[280px]">
                        {categoryBreakdown.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={categoryBreakdown}
                                dataKey="count"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                outerRadius={100}
                                label={({ name, count }) => `${name} (${count})`}
                              >
                                {categoryBreakdown.map((_, i) => (
                                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                            </PieChart>
                          </ResponsiveContainer>
                        ) : (
                          <p className="text-xs text-muted-foreground text-center py-8">No data available</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-5">
                      <h3 className="text-sm font-semibold text-foreground mb-4">Category Avg Ratings</h3>
                      <div className="space-y-3">
                        {categoryBreakdown.map((cat) => (
                          <div key={cat.name} className="flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground">{cat.name}</p>
                              <p className="text-[10px] text-muted-foreground">{cat.count} response{cat.count !== 1 ? "s" : ""}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-lg">{emojis[Math.round(cat.avgRating) - 1] || "—"}</span>
                              <span className="text-sm font-bold text-foreground w-8 text-right">{cat.avgRating}</span>
                              <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-primary rounded-full" style={{ width: `${(cat.avgRating / 5) * 100}%` }} />
                              </div>
                            </div>
                          </div>
                        ))}
                        {categoryBreakdown.length === 0 && (
                          <p className="text-xs text-muted-foreground py-4 text-center">No feedback data</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Individual Responses Tab */}
              <TabsContent value="responses" className="space-y-4">
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                  <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                    <div>
                      <h2 className="font-semibold text-foreground">Individual Responses</h2>
                      <p className="text-xs text-muted-foreground">{filteredResponses.length} feedback entries in selected period</p>
                    </div>
                  </div>
                  <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
                    {filteredResponses.slice(0, 100).map((r) => {
                      const q = questions.find((qq) => qq.id === r.question_id);
                      return (
                        <div key={r.id} className="px-5 py-3 flex items-center gap-3">
                          <span className="text-lg shrink-0">{emojis[r.rating - 1]}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground truncate">{q?.question || "Unknown"}</p>
                            {r.comment && <p className="text-xs text-muted-foreground italic truncate">"{r.comment}"</p>}
                            <div className="flex items-center gap-2 mt-0.5">
                              <Badge variant="outline" className="text-[9px] capitalize">{q?.category || "general"}</Badge>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs font-medium text-foreground">{r.visitor_name}</p>
                            <p className="text-[10px] text-muted-foreground">{format(new Date(r.created_at), "dd MMM HH:mm")}</p>
                            <Badge variant="secondary" className="text-[9px] mt-0.5">{r.visitor_type}</Badge>
                          </div>
                        </div>
                      );
                    })}
                    {filteredResponses.length === 0 && (
                      <div className="py-12 text-center text-sm text-muted-foreground">No feedback in selected period.</div>
                    )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
