import { Users, UserCheck, AlertTriangle, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface VisitorStatsProps {
  checkedIn: number;
  totalToday: number;
  overstayed: number;
}

const stats_config = [
  {
    key: "checkedIn",
    label: "ON-SITE NOW",
    sublabel: "Visitors currently in the building",
    icon: UserCheck,
    borderColor: "border-l-primary",
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
    link: "/visit-list",
  },
  {
    key: "total",
    label: "TODAY'S VISITS",
    sublabel: "Total check-ins recorded today",
    icon: Users,
    borderColor: "border-l-warning",
    iconBg: "bg-warning/10",
    iconColor: "text-warning",
    link: "/visit-list",
  },
  {
    key: "overstayed",
    label: "REQUIRES ACTION",
    sublabel: "Visits exceeding 8-hour limit",
    icon: AlertTriangle,
    borderColor: "border-l-destructive",
    iconBg: "bg-destructive/10",
    iconColor: "text-destructive",
    link: "/visit-list",
  },
  {
    key: "pending",
    label: "AWAITING CHECK-OUT",
    sublabel: "Haven't signed out yet",
    icon: Clock,
    borderColor: "border-l-success",
    iconBg: "bg-success/10",
    iconColor: "text-success",
    link: "/visit-list",
  },
];

export function VisitorStats({ checkedIn, totalToday, overstayed }: VisitorStatsProps) {
  const navigate = useNavigate();
  const values: Record<string, number> = {
    checkedIn,
    total: totalToday,
    overstayed,
    pending: checkedIn,
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats_config.map((stat) => (
        <div
          key={stat.key}
          onClick={() => navigate(stat.link)}
          className={`rounded-xl border border-border bg-card p-5 border-l-4 ${stat.borderColor} transition-all hover:shadow-card-hover cursor-pointer`}
        >
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {stat.label}
              </p>
              <p className="text-3xl font-bold tracking-tight text-foreground">
                {values[stat.key]}
              </p>
              <p className="text-xs text-muted-foreground">{stat.sublabel}</p>
            </div>
            <div className={`${stat.iconBg} rounded-xl p-2.5`}>
              <stat.icon className={`h-5 w-5 ${stat.iconColor}`} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
