import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { useVisitors } from "@/hooks/useVisitors";
import { Visitor, VisitorType } from "@/types/visitor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CalendarDays, ChevronLeft, ChevronRight, Users, Clock,
  LogIn, LogOut, X, Filter,
} from "lucide-react";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay,
  isSameMonth, addMonths, subMonths, startOfWeek, endOfWeek, isToday,
} from "date-fns";

const TYPE_COLORS: Record<string, string> = {
  visitor: "bg-primary/10 text-primary",
  resident: "bg-success/10 text-success",
  contractor: "bg-warning/10 text-warning",
  staff: "bg-muted text-muted-foreground",
};

export default function CalendarPage() {
  const navigate = useNavigate();
  const { visitors } = useVisitors();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("all");

  // Build lookup: date string -> visitors
  const visitsByDate = useMemo(() => {
    const map = new Map<string, Visitor[]>();
    visitors.forEach((v) => {
      const key = format(v.checkInTime, "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(v);
    });
    return map;
  }, [visitors]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calStart, end: calEnd });

  const selectedVisitors = useMemo(() => {
    if (!selectedDate) return [];
    const key = format(selectedDate, "yyyy-MM-dd");
    const dayVisitors = visitsByDate.get(key) || [];
    if (typeFilter === "all") return dayVisitors;
    return dayVisitors.filter((v) => v.type === typeFilter);
  }, [selectedDate, visitsByDate, typeFilter]);

  const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <AppShell
      title="Visit Calendar"
      subtitle="Daily visit overview — select a date to see details"
      mainClassName="p-6 flex flex-col lg:flex-row gap-6"
    >
            {/* Calendar Grid */}
            <div className="flex-1 min-w-0">
              {/* Month Navigation */}
              <div className="flex items-center justify-between mb-4">
                <Button variant="ghost" size="icon" onClick={() => setCurrentMonth((m) => subMonths(m, 1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <h2 className="text-lg font-bold text-foreground">
                  {format(currentMonth, "MMMM yyyy")}
                </h2>
                <Button variant="ghost" size="icon" onClick={() => setCurrentMonth((m) => addMonths(m, 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {/* Week day headers */}
              <div className="grid grid-cols-7 gap-1 mb-1">
                {weekDays.map((d) => (
                  <div key={d} className="text-center text-[11px] font-semibold text-muted-foreground uppercase tracking-wider py-2">
                    {d}
                  </div>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day) => {
                  const key = format(day, "yyyy-MM-dd");
                  const dayVisitors = visitsByDate.get(key) || [];
                  const isCurrentMonth = isSameMonth(day, currentMonth);
                  const isSelected = selectedDate && isSameDay(day, selectedDate);
                  const isCurrentDay = isToday(day);

                  // Count by type
                  const counts: Record<string, number> = {};
                  dayVisitors.forEach((v) => {
                    counts[v.type] = (counts[v.type] || 0) + 1;
                  });

                  return (
                    <button
                      key={key}
                      onClick={() => setSelectedDate(day)}
                      className={`
                        relative min-h-[80px] sm:min-h-[90px] rounded-lg border p-1.5 text-left transition-all
                        ${isCurrentMonth ? "bg-card" : "bg-muted/30 opacity-50"}
                        ${isSelected ? "border-primary ring-1 ring-primary/30 shadow-sm" : "border-border hover:border-primary/40"}
                        ${isCurrentDay && !isSelected ? "border-primary/50" : ""}
                      `}
                    >
                      <span className={`text-xs font-semibold ${isCurrentDay ? "bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center" : "text-foreground"}`}>
                        {format(day, "d")}
                      </span>

                      {dayVisitors.length > 0 && (
                        <div className="mt-1 space-y-0.5">
                          {Object.entries(counts).slice(0, 3).map(([type, count]) => (
                            <div key={type} className={`flex items-center gap-1 rounded px-1 py-0.5 ${TYPE_COLORS[type] || "bg-muted text-muted-foreground"}`}>
                              <span className="text-[9px] font-semibold truncate">{count} {type}</span>
                            </div>
                          ))}
                          {Object.keys(counts).length > 3 && (
                            <span className="text-[9px] text-muted-foreground">+{Object.keys(counts).length - 3} more</span>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Detail Panel */}
            <div className={`w-full lg:w-[380px] shrink-0 transition-all ${selectedDate ? "block" : "hidden lg:block"}`}>
              {selectedDate ? (
                <div className="rounded-xl border border-border bg-card shadow-soft sticky top-24">
                  <div className="flex items-center justify-between p-4 border-b border-border">
                    <div>
                      <h3 className="text-sm font-bold text-foreground">
                        {format(selectedDate, "EEEE, d MMMM yyyy")}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {selectedVisitors.length} visit{selectedVisitors.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedDate(null)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {/* Type Filter */}
                  <div className="px-4 py-3 border-b border-border">
                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                      <SelectTrigger className="h-8 text-xs">
                        <Filter className="h-3 w-3 mr-1.5 text-muted-foreground" />
                        <SelectValue placeholder="Filter by type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="visitor">Visitors</SelectItem>
                        <SelectItem value="resident">Residents</SelectItem>
                        <SelectItem value="contractor">Contractors</SelectItem>
                        <SelectItem value="staff">Staff</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Visitor List */}
                  <div className="max-h-[calc(100vh-300px)] overflow-y-auto divide-y divide-border">
                    {selectedVisitors.length === 0 ? (
                      <div className="p-8 text-center">
                        <CalendarDays className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                        <p className="text-xs text-muted-foreground">No visits on this day</p>
                      </div>
                    ) : (
                      selectedVisitors.map((v) => (
                        <div key={v.id} className="px-4 py-3 hover:bg-muted/30 transition-colors">
                          <div className="flex items-start gap-3">
                            <Avatar className="h-8 w-8 mt-0.5">
                              <AvatarFallback className={`text-[10px] font-bold ${TYPE_COLORS[v.type] || "bg-muted text-muted-foreground"}`}>
                                {v.firstName[0]}{v.surname[0]}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => navigate(`/visitors/${v.id}`)}
                                  className="text-sm font-semibold text-primary hover:underline truncate text-left"
                                >
                                  {v.firstName} {v.surname}
                                </button>
                                <Badge variant="secondary" className="text-[9px] uppercase shrink-0">
                                  {v.type}
                                </Badge>
                              </div>
                              {v.whomToVisit && (
                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                  Visiting: {v.whomToVisit}
                                </p>
                              )}
                              <div className="flex items-center gap-3 mt-1.5">
                                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                  <LogIn className="h-3 w-3 text-success" />
                                  {format(v.checkInTime, "HH:mm")}
                                </div>
                                {v.checkOutTime ? (
                                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                    <LogOut className="h-3 w-3 text-destructive" />
                                    {format(v.checkOutTime, "HH:mm")}
                                  </div>
                                ) : (
                                  <Badge variant="outline" className="text-[9px] h-4 border-success/40 text-success">
                                    On-site
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-card p-8 text-center">
                  <CalendarDays className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">Select a date</p>
                  <p className="text-xs text-muted-foreground mt-1">Click on any day to view visit details</p>
                </div>
              )}
            </div>
    </AppShell>
  );
}