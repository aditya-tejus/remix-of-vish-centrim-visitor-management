import { isOverstayedSync } from "@/hooks/useOverstayPolicy";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useVisitors } from "@/hooks/useVisitors";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users, TrendingUp, Clock, UserCheck, AlertTriangle,
  BarChart3, PieChart as PieChartIcon, Activity, CalendarDays,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend, Area, AreaChart,
} from "recharts";
import {
  format, subDays, isSameDay, startOfWeek, endOfWeek,
  eachDayOfInterval, differenceInMinutes, startOfDay,
} from "date-fns";

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--success))",
  "hsl(var(--warning))",
  "hsl(var(--destructive))",
  "hsl(var(--muted-foreground))",
];

export default function ReportsPage() {
  const { visitors } = useVisitors();

  // ── Derived data ──
  const today = new Date();

  const todayVisitors = useMemo(
    () => visitors.filter((v) => isSameDay(v.checkInTime, today)),
    [visitors]
  );

  const last7 = useMemo(
    () => visitors.filter((v) => v.checkInTime >= subDays(today, 7)),
    [visitors]
  );

  const last30 = useMemo(
    () => visitors.filter((v) => v.checkInTime >= subDays(today, 30)),
    [visitors]
  );

  // ── Stats cards ──
  const checkedInNow = visitors.filter((v) => v.status === "checked-in").length;
  const todayTotal = todayVisitors.length;
  const avgDuration = useMemo(() => {
    const completed = last30.filter((v) => v.checkOutTime);
    if (completed.length === 0) return 0;
    const total = completed.reduce(
      (acc, v) => acc + differenceInMinutes(v.checkOutTime!, v.checkInTime),
      0
    );
    return Math.round(total / completed.length);
  }, [last30]);
  const overstayedCount = visitors.filter(
    isOverstayedSync
  ).length;

  // ── Daily visits chart (last 7 days) ──
  const dailyData = useMemo(() => {
    const days = eachDayOfInterval({ start: subDays(today, 6), end: today });
    return days.map((day) => {
      const dayVisitors = visitors.filter((v) => isSameDay(v.checkInTime, day));
      return {
        date: format(day, "EEE"),
        fullDate: format(day, "dd MMM"),
        visitors: dayVisitors.filter((v) => v.type === "visitor").length,
        residents: dayVisitors.filter((v) => v.type === "resident").length,
        contractors: dayVisitors.filter((v) => v.type === "contractor").length,
        staff: dayVisitors.filter((v) => v.type === "staff").length,
        total: dayVisitors.length,
      };
    });
  }, [visitors]);

  // ── Type breakdown (pie) ──
  const typeBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    last30.forEach((v) => {
      counts[v.type] = (counts[v.type] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [last30]);

  // ── Peak hours (last 30 days) ──
  const peakHours = useMemo(() => {
    const hourCounts = new Array(24).fill(0);
    last30.forEach((v) => {
      const hour = v.checkInTime.getHours();
      hourCounts[hour]++;
    });
    return hourCounts.map((count, hour) => ({
      hour: `${hour.toString().padStart(2, "0")}:00`,
      visits: count,
    }));
  }, [last30]);

  // ── Average duration by type ──
  const durationByType = useMemo(() => {
    const types = ["visitor", "resident", "contractor", "staff"];
    return types.map((type) => {
      const completed = last30.filter((v) => v.type === type && v.checkOutTime);
      const avg =
        completed.length > 0
          ? Math.round(
              completed.reduce(
                (acc, v) => acc + differenceInMinutes(v.checkOutTime!, v.checkInTime),
                0
              ) / completed.length
            )
          : 0;
      return { type: type.charAt(0).toUpperCase() + type.slice(1), avgMinutes: avg };
    });
  }, [last30]);

  // ── Weekly trend (last 4 weeks) ──
  const weeklyTrend = useMemo(() => {
    const weeks: { week: string; total: number }[] = [];
    for (let i = 3; i >= 0; i--) {
      const weekStart = startOfWeek(subDays(today, i * 7), { weekStartsOn: 1 });
      const weekEnd = endOfWeek(subDays(today, i * 7), { weekStartsOn: 1 });
      const count = visitors.filter(
        (v) => v.checkInTime >= weekStart && v.checkInTime <= weekEnd
      ).length;
      weeks.push({
        week: `${format(weekStart, "dd MMM")} – ${format(weekEnd, "dd MMM")}`,
        total: count,
      });
    }
    return weeks;
  }, [visitors]);

  // ── Top visited people ──
  const topVisited = useMemo(() => {
    const counts: Record<string, number> = {};
    last30
      .filter((v) => v.whomToVisit)
      .forEach((v) => {
        counts[v.whomToVisit] = (counts[v.whomToVisit] || 0) + 1;
      });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, visits]) => ({ name, visits }));
  }, [last30]);

  // ── Health declaration compliance ──
  const healthCompliance = useMemo(() => {
    const declared = last30.filter((v) => v.healthDeclaration).length;
    const notDeclared = last30.length - declared;
    return [
      { name: "Completed", value: declared },
      { name: "Incomplete", value: notDeclared },
    ];
  }, [last30]);

  const formatDuration = (mins: number) => {
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  return (
    <AppShell
      title="Reports & Analytics"
      subtitle="Visitor insights and compliance metrics"
      mainClassName="p-6 space-y-6"
    >
            {/* Summary Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "On-Site Now", value: checkedInNow, icon: UserCheck, color: "border-l-primary", iconCls: "bg-primary/10 text-primary" },
                { label: "Today's Visits", value: todayTotal, icon: Users, color: "border-l-warning", iconCls: "bg-warning/10 text-warning" },
                { label: "Avg Duration", value: formatDuration(avgDuration), icon: Clock, color: "border-l-success", iconCls: "bg-success/10 text-success" },
                { label: "Overstayed", value: overstayedCount, icon: AlertTriangle, color: "border-l-destructive", iconCls: "bg-destructive/10 text-destructive" },
              ].map((s) => (
                <div key={s.label} className={`rounded-xl border border-border bg-card p-5 border-l-4 ${s.color}`}>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{s.label}</p>
                      <p className="text-3xl font-bold tracking-tight text-foreground">{s.value}</p>
                    </div>
                    <div className={`rounded-xl p-2.5 ${s.iconCls}`}>
                      <s.icon className="h-5 w-5" />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Charts Tabs */}
            <Tabs defaultValue="overview" className="space-y-4">
              <TabsList className="bg-muted/50 p-1 rounded-xl h-auto flex-wrap">
                <TabsTrigger value="overview" className="gap-1.5 rounded-lg text-xs data-[state=active]:shadow-sm">
                  <BarChart3 className="h-3.5 w-3.5" />
                  Overview
                </TabsTrigger>
                <TabsTrigger value="trends" className="gap-1.5 rounded-lg text-xs data-[state=active]:shadow-sm">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Trends
                </TabsTrigger>
                <TabsTrigger value="breakdown" className="gap-1.5 rounded-lg text-xs data-[state=active]:shadow-sm">
                  <PieChartIcon className="h-3.5 w-3.5" />
                  Breakdown
                </TabsTrigger>
                <TabsTrigger value="compliance" className="gap-1.5 rounded-lg text-xs data-[state=active]:shadow-sm">
                  <Activity className="h-3.5 w-3.5" />
                  Compliance
                </TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Daily Visits */}
                  <Card>
                    <CardContent className="p-5">
                      <h3 className="text-sm font-semibold text-foreground mb-4">Daily Visits (Last 7 Days)</h3>
                      <div className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={dailyData}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                            <XAxis dataKey="date" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                            <YAxis className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} allowDecimals={false} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "hsl(var(--card))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: "8px",
                                fontSize: "12px",
                              }}
                            />
                            <Legend wrapperStyle={{ fontSize: "11px" }} />
                            <Bar dataKey="visitors" name="Visitors" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
                            <Bar dataKey="residents" name="Residents" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} />
                            <Bar dataKey="contractors" name="Contractors" fill={CHART_COLORS[2]} radius={[4, 4, 0, 0]} />
                            <Bar dataKey="staff" name="Staff" fill={CHART_COLORS[4]} radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Peak Hours */}
                  <Card>
                    <CardContent className="p-5">
                      <h3 className="text-sm font-semibold text-foreground mb-4">Peak Hours (Last 30 Days)</h3>
                      <div className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={peakHours}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                            <XAxis dataKey="hour" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} interval={2} />
                            <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} allowDecimals={false} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "hsl(var(--card))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: "8px",
                                fontSize: "12px",
                              }}
                            />
                            <Area type="monotone" dataKey="visits" stroke={CHART_COLORS[0]} fill={CHART_COLORS[0]} fillOpacity={0.15} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Top Visited & Duration */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardContent className="p-5">
                      <h3 className="text-sm font-semibold text-foreground mb-4">Most Visited People</h3>
                      {topVisited.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-8 text-center">No data available</p>
                      ) : (
                        <div className="space-y-3">
                          {topVisited.map((item, i) => (
                            <div key={item.name} className="flex items-center gap-3">
                              <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                                <div className="h-1.5 w-full bg-muted rounded-full mt-1">
                                  <div
                                    className="h-1.5 bg-primary rounded-full"
                                    style={{ width: `${(item.visits / topVisited[0].visits) * 100}%` }}
                                  />
                                </div>
                              </div>
                              <Badge variant="secondary" className="text-[10px]">{item.visits} visits</Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-5">
                      <h3 className="text-sm font-semibold text-foreground mb-4">Average Visit Duration by Type</h3>
                      <div className="h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={durationByType} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                            <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} unit="m" />
                            <YAxis dataKey="type" type="category" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} width={80} />
                            <Tooltip
                              formatter={(value: number) => [`${formatDuration(value)}`, "Avg Duration"]}
                              contentStyle={{
                                backgroundColor: "hsl(var(--card))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: "8px",
                                fontSize: "12px",
                              }}
                            />
                            <Bar dataKey="avgMinutes" fill={CHART_COLORS[1]} radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Trends Tab */}
              <TabsContent value="trends" className="space-y-6">
                <Card>
                  <CardContent className="p-5">
                    <h3 className="text-sm font-semibold text-foreground mb-4">Weekly Trend (Last 4 Weeks)</h3>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={weeklyTrend}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                          <XAxis dataKey="week" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                          <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} allowDecimals={false} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "8px",
                              fontSize: "12px",
                            }}
                          />
                          <Line type="monotone" dataKey="total" stroke={CHART_COLORS[0]} strokeWidth={2} dot={{ r: 4, fill: CHART_COLORS[0] }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-5">
                    <h3 className="text-sm font-semibold text-foreground mb-4">Daily Check-ins vs Check-outs (Last 7 Days)</h3>
                    <div className="h-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dailyData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                          <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                          <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} allowDecimals={false} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "8px",
                              fontSize: "12px",
                            }}
                          />
                          <Legend wrapperStyle={{ fontSize: "11px" }} />
                          <Bar dataKey="total" name="Total Visits" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Breakdown Tab */}
              <TabsContent value="breakdown" className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardContent className="p-5">
                      <h3 className="text-sm font-semibold text-foreground mb-4">Visitor Type Distribution (30 Days)</h3>
                      <div className="h-[300px]">
                        {typeBreakdown.length === 0 ? (
                          <div className="flex items-center justify-center h-full">
                            <p className="text-xs text-muted-foreground">No data available</p>
                          </div>
                        ) : (
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={typeBreakdown}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={100}
                                paddingAngle={4}
                                dataKey="value"
                                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                              >
                                {typeBreakdown.map((_, i) => (
                                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: "hsl(var(--card))",
                                  border: "1px solid hsl(var(--border))",
                                  borderRadius: "8px",
                                  fontSize: "12px",
                                }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-5">
                      <h3 className="text-sm font-semibold text-foreground mb-4">Type Summary</h3>
                      <div className="space-y-4">
                        {typeBreakdown.map((item, i) => {
                          const total = typeBreakdown.reduce((a, b) => a + b.value, 0);
                          const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
                          return (
                            <div key={item.name}>
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                                  <span className="text-sm font-medium text-foreground capitalize">{item.name}</span>
                                </div>
                                <span className="text-xs text-muted-foreground">{item.value} visits ({pct}%)</span>
                              </div>
                              <div className="h-2 w-full bg-muted rounded-full">
                                <div
                                  className="h-2 rounded-full transition-all"
                                  style={{ width: `${pct}%`, backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                                />
                              </div>
                            </div>
                          );
                        })}
                        {typeBreakdown.length === 0 && (
                          <p className="text-xs text-muted-foreground text-center py-8">No data available</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Compliance Tab */}
              <TabsContent value="compliance" className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardContent className="p-5">
                      <h3 className="text-sm font-semibold text-foreground mb-4">Check-in Declaration Compliance (30 Days)</h3>
                      <div className="h-[280px]">
                        {last30.length === 0 ? (
                          <div className="flex items-center justify-center h-full">
                            <p className="text-xs text-muted-foreground">No data available</p>
                          </div>
                        ) : (
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={healthCompliance}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={100}
                                paddingAngle={4}
                                dataKey="value"
                                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                              >
                                <Cell fill={CHART_COLORS[1]} />
                                <Cell fill={CHART_COLORS[3]} />
                              </Pie>
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: "hsl(var(--card))",
                                  border: "1px solid hsl(var(--border))",
                                  borderRadius: "8px",
                                  fontSize: "12px",
                                }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-5 space-y-4">
                      <h3 className="text-sm font-semibold text-foreground">Compliance Summary</h3>
                      <div className="space-y-3">
                        {[
                          {
                            label: "Declaration Compliance Rate",
                            value: last30.length > 0 ? `${Math.round((last30.filter((v) => v.healthDeclaration).length / last30.length) * 100)}%` : "N/A",
                            status: last30.length > 0 && last30.filter((v) => v.healthDeclaration).length / last30.length >= 0.9 ? "good" : "warn",
                          },
                          {
                            label: "Privacy Acknowledgement",
                            value: last30.length > 0 ? `${Math.round((last30.filter((v) => v.acknowledgedPrivacy).length / last30.length) * 100)}%` : "N/A",
                            status: last30.length > 0 && last30.filter((v) => v.acknowledgedPrivacy).length / last30.length >= 0.9 ? "good" : "warn",
                          },
                          {
                            label: "Overstayed Visitors Today",
                            value: `${overstayedCount}`,
                            status: overstayedCount === 0 ? "good" : "warn",
                          },
                          {
                            label: "Total Visits (30 Days)",
                            value: `${last30.length}`,
                            status: "good",
                          },
                        ].map((item) => (
                          <div key={item.label} className="flex items-center justify-between rounded-lg border border-border p-3">
                            <span className="text-sm text-foreground">{item.label}</span>
                            <Badge variant={item.status === "good" ? "secondary" : "destructive"} className="text-xs">
                              {item.value}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
    </AppShell>
  );
}