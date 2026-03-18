import { useMemo } from "react";
import { Visitor } from "@/types/visitor";
import { Users, LogIn, LogOut, AlertTriangle, ShieldCheck, Clock, Home, DoorOpen } from "lucide-react";
import { isPast, isToday } from "date-fns";

interface StatDef {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent: string;
  filterKey?: string;
}

interface TabContextStatsProps {
  tab: string;
  visitors: Visitor[];
  allVisitors: Visitor[];
  onFilter?: (key: string) => void;
  activeFilter?: string | null;
}

function getStats(tab: string, visitors: Visitor[], allVisitors: Visitor[]): StatDef[] {
  const onSite = visitors.filter(v => v.status === "checked-in").length;
  const checkedOut = visitors.filter(v => v.status === "checked-out").length;
  const overstayed = visitors.filter(v => v.status === "checked-in" && Date.now() - v.checkInTime.getTime() > 8 * 3600000).length;

  switch (tab) {
    case "all":
      return [
        { label: "On-site", value: onSite, icon: <LogIn className="h-3.5 w-3.5" />, accent: "text-success", filterKey: "checked-in" },
        { label: "Checked Out", value: checkedOut, icon: <LogOut className="h-3.5 w-3.5" />, accent: "text-muted-foreground", filterKey: "checked-out" },
        { label: "Overstayed", value: overstayed, icon: <AlertTriangle className="h-3.5 w-3.5" />, accent: "text-destructive", filterKey: "overstayed" },
      ];

    case "visitor":
      return [
        { label: "On-site", value: onSite, icon: <LogIn className="h-3.5 w-3.5" />, accent: "text-success", filterKey: "checked-in" },
        { label: "Checked Out", value: checkedOut, icon: <LogOut className="h-3.5 w-3.5" />, accent: "text-muted-foreground", filterKey: "checked-out" },
        { label: "Overstayed", value: overstayed, icon: <AlertTriangle className="h-3.5 w-3.5" />, accent: "text-destructive", filterKey: "overstayed" },
      ];

    case "contractor": {
      const pendingDBS = visitors.filter(v => {
        const screening = v.healthAnswers as Record<string, any> | undefined;
        return v.status === "checked-in" && (!screening || !screening.dbsCheck);
      }).length;
      return [
        { label: "On-site", value: onSite, icon: <LogIn className="h-3.5 w-3.5" />, accent: "text-success", filterKey: "checked-in" },
        { label: "Pending DBS", value: pendingDBS, icon: <ShieldCheck className="h-3.5 w-3.5" />, accent: "text-warning", filterKey: "pending-dbs" },
        { label: "Overstayed", value: overstayed, icon: <AlertTriangle className="h-3.5 w-3.5" />, accent: "text-destructive", filterKey: "overstayed" },
      ];
    }

    case "volunteer":
      return [
        { label: "On-site", value: onSite, icon: <LogIn className="h-3.5 w-3.5" />, accent: "text-success", filterKey: "checked-in" },
        { label: "Checked Out", value: checkedOut, icon: <LogOut className="h-3.5 w-3.5" />, accent: "text-muted-foreground", filterKey: "checked-out" },
        { label: "Overstayed", value: overstayed, icon: <AlertTriangle className="h-3.5 w-3.5" />, accent: "text-destructive", filterKey: "overstayed" },
      ];

    case "staff":
      return [
        { label: "On-site", value: onSite, icon: <LogIn className="h-3.5 w-3.5" />, accent: "text-success", filterKey: "checked-in" },
        { label: "On Shift", value: onSite, icon: <Clock className="h-3.5 w-3.5" />, accent: "text-info" },
      ];

    default:
      return [];
  }
}

export function TabContextStats({ tab, visitors, allVisitors, onFilter, activeFilter }: TabContextStatsProps) {
  const stats = useMemo(() => getStats(tab, visitors, allVisitors), [tab, visitors, allVisitors]);

  if (stats.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 px-4 py-2 border-b border-border bg-muted/30">
      {stats.map((stat, i) => (
        <button
          key={stat.label}
          onClick={() => stat.filterKey && onFilter?.(stat.filterKey)}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all duration-150 hover:bg-card hover:shadow-sm ${
            activeFilter === stat.filterKey
              ? "bg-card shadow-sm ring-1 ring-primary/20"
              : "bg-transparent"
          }`}
        >
          <span className={stat.accent}>{stat.icon}</span>
          <span className="text-muted-foreground">{stat.label}</span>
          <span className={`font-bold tabular-nums ${stat.value > 0 && stat.accent.includes("destructive") ? "text-destructive" : "text-foreground"}`}>
            {stat.value}
          </span>
          {stat.label === "Overstayed" && stat.value > 0 && (
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-destructive" />
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
