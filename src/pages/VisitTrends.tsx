import { useMemo } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { useVisitors } from "@/hooks/useVisitors";
import { format, subDays, isSameDay, eachDayOfInterval, startOfWeek, endOfWeek } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from "recharts";
import { TrendingUp, BarChart3 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const CHART_COLORS = ["hsl(var(--primary))", "hsl(var(--success))", "hsl(var(--warning))", "hsl(var(--destructive))", "hsl(var(--muted-foreground))"];

export default function VisitTrends() {
  const { visitors, loading } = useVisitors();
  const today = new Date();

  const dailyData = useMemo(() => {
    const days = eachDayOfInterval({ start: subDays(today, 13), end: today });
    return days.map((day) => {
      const dayVisitors = visitors.filter((v) => isSameDay(v.checkInTime, day));
      return {
        date: format(day, "dd MMM"),
        visitors: dayVisitors.filter((v) => v.type === "visitor").length,
        contractors: dayVisitors.filter((v) => v.type === "contractor").length,
        volunteers: dayVisitors.filter((v) => v.type === "volunteer").length,
        staff: dayVisitors.filter((v) => v.type === "staff").length,
        total: dayVisitors.length,
      };
    });
  }, [visitors]);

  const weeklyData = useMemo(() => {
    const weeks: { week: string; total: number; visitors: number; contractors: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const ws = startOfWeek(subDays(today, i * 7), { weekStartsOn: 1 });
      const we = endOfWeek(subDays(today, i * 7), { weekStartsOn: 1 });
      const wv = visitors.filter((v) => v.checkInTime >= ws && v.checkInTime <= we);
      weeks.push({
        week: format(ws, "dd MMM"),
        total: wv.length,
        visitors: wv.filter((v) => v.type === "visitor").length,
        contractors: wv.filter((v) => v.type === "contractor").length,
      });
    }
    return weeks;
  }, [visitors]);

  const tooltipStyle = {
    backgroundColor: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "8px",
    fontSize: "12px",
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex-1">
          <header className="sticky top-0 z-10 bg-card border-b border-border">
            <div className="flex items-center gap-4 px-6 h-14">
              <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
              <div>
                <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" /> Visit Trends
                </h1>
                <p className="text-[13px] text-muted-foreground">Daily and weekly visit patterns by person type</p>
              </div>
            </div>
          </header>

          <main className="p-6 space-y-6">
            {loading ? (
              <div className="space-y-6">
                <Skeleton className="h-[350px] w-full" />
                <Skeleton className="h-[350px] w-full" />
              </div>
            ) : (
              <>
                <Card>
                  <CardContent className="p-5">
                    <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-primary" /> Daily Check-Ins (Last 14 Days)
                    </h3>
                    <div className="h-[320px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dailyData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                          <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                          <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} allowDecimals={false} />
                          <Tooltip contentStyle={tooltipStyle} />
                          <Legend wrapperStyle={{ fontSize: "11px" }} />
                          <Bar dataKey="visitors" name="Visitors" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
                          <Bar dataKey="contractors" name="Contractors" fill={CHART_COLORS[2]} radius={[4, 4, 0, 0]} />
                          <Bar dataKey="volunteers" name="Volunteers" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} />
                          <Bar dataKey="staff" name="Staff" fill={CHART_COLORS[4]} radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-5">
                    <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-primary" /> Weekly Trend (Last 6 Weeks)
                    </h3>
                    <div className="h-[320px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={weeklyData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                          <XAxis dataKey="week" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                          <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} allowDecimals={false} />
                          <Tooltip contentStyle={tooltipStyle} />
                          <Legend wrapperStyle={{ fontSize: "11px" }} />
                          <Line type="monotone" dataKey="total" name="Total" stroke={CHART_COLORS[0]} strokeWidth={2} dot={{ r: 4 }} />
                          <Line type="monotone" dataKey="visitors" name="Visitors" stroke={CHART_COLORS[1]} strokeWidth={1.5} />
                          <Line type="monotone" dataKey="contractors" name="Contractors" stroke={CHART_COLORS[2]} strokeWidth={1.5} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
