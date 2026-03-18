import { useMemo } from "react";
import { Visitor } from "@/types/visitor";
import { format, isToday, isYesterday, startOfDay } from "date-fns";
import { LogIn, LogOut, Clock } from "lucide-react";

interface DayGroupedHistoryProps {
  visitors: Visitor[];
}

interface HistoryEvent {
  id: string;
  visitor: Visitor;
  type: "check-in" | "check-out";
  time: Date;
}

export function DayGroupedHistory({ visitors }: DayGroupedHistoryProps) {
  const grouped = useMemo(() => {
    // Build events from visitors
    const events: HistoryEvent[] = [];
    visitors.forEach((v) => {
      events.push({ id: `${v.id}-in`, visitor: v, type: "check-in", time: v.checkInTime });
      if (v.checkOutTime) {
        events.push({ id: `${v.id}-out`, visitor: v, type: "check-out", time: v.checkOutTime });
      }
    });

    // Sort by most recent first
    events.sort((a, b) => b.time.getTime() - a.time.getTime());

    // Group by day
    const groups: { date: Date; label: string; events: HistoryEvent[] }[] = [];
    const dayMap = new Map<string, HistoryEvent[]>();

    events.forEach((e) => {
      const key = startOfDay(e.time).toISOString();
      if (!dayMap.has(key)) dayMap.set(key, []);
      dayMap.get(key)!.push(e);
    });

    dayMap.forEach((evts, key) => {
      const date = new Date(key);
      let label: string;
      if (isToday(date)) label = "Today";
      else if (isYesterday(date)) label = "Yesterday";
      else label = format(date, "EEEE, dd MMM");
      groups.push({ date, label, events: evts });
    });

    groups.sort((a, b) => b.date.getTime() - a.date.getTime());
    return groups.slice(0, 5); // Show last 5 days
  }, [visitors]);

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-[15px] font-semibold text-foreground">Recent Activity</h2>
      </div>

      {grouped.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <p className="text-sm font-medium">No activity yet</p>
        </div>
      ) : (
        <div className="max-h-[520px] overflow-y-auto">
          {grouped.map((group) => (
            <div key={group.label}>
              {/* Date card */}
              <div className="sticky top-0 bg-muted/80 backdrop-blur-sm px-5 py-1.5 border-b border-border">
                <span className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider">{group.label}</span>
              </div>
              <div className="divide-y divide-border">
                {group.events.slice(0, 10).map((event) => (
                  <div key={event.id} className="flex items-center gap-3 px-5 py-2.5">
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                      event.type === "check-in" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
                    }`}>
                      {event.type === "check-in" ? <LogIn className="h-3.5 w-3.5" /> : <LogOut className="h-3.5 w-3.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-foreground truncate">
                        {event.visitor.firstName} {event.visitor.surname}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {event.type === "check-in" ? "Checked in" : "Checked out"} · {format(event.time, "HH:mm")}
                      </p>
                    </div>
                  </div>
                ))}
                {group.events.length > 10 && (
                  <div className="px-5 py-2 text-[12px] text-muted-foreground">
                    +{group.events.length - 10} more events
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
