import { isOverstayedSync } from "@/hooks/useOverstayPolicy";
import { Clock, RefreshCw, UserX, ClipboardCheck, CalendarCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Visitor } from "@/types/visitor";
import { isPast, formatDistanceToNow, isToday } from "date-fns";

interface AlertCardsProps {
  visitors: Visitor[];
  draftCount: number;
  pendingApprovals: number;
  onFilterOverstayed: () => void;
  onFilterDrafts: () => void;
  onFilterOverdue: () => void;
  onFilterPending: () => void;
  onFilterReturnsToday: () => void;
}

interface AlertCard {
  show: boolean;
  bg: string;
  border: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  cta: string;
  onAction: () => void;
  pulse?: boolean;
}

export function AlertCards({
  visitors, draftCount, pendingApprovals,
  onFilterOverstayed, onFilterDrafts, onFilterOverdue, onFilterPending, onFilterReturnsToday,
}: AlertCardsProps) {
  const overstayed = visitors.filter(
    (v) => v.type !== "resident" && isOverstayedSync(v)
  );

  const overdueResidents = visitors.filter(
    (v) => v.type === "resident" && v.status === "checked-out" && v.expectedReturnDate && isPast(v.expectedReturnDate)
  );

  const returnsToday = visitors.filter(
    (v) => v.type === "resident" && v.status === "checked-out" && v.expectedReturnDate && isToday(v.expectedReturnDate)
  );

  const longestOverstay = overstayed.length > 0
    ? formatDistanceToNow(overstayed.reduce((a, b) => a.checkInTime < b.checkInTime ? a : b).checkInTime)
    : "";

  const mostOverdue = overdueResidents.length > 0
    ? `${overdueResidents[0].firstName} ${overdueResidents[0].surname} — ${formatDistanceToNow(overdueResidents[0].expectedReturnDate!)} overdue`
    : "";

  const cards: AlertCard[] = [
    {
      show: overstayed.length > 0,
      bg: "bg-[hsl(33,100%,97%)]",
      border: "border-l-destructive",
      icon: <Clock className="h-5 w-5 text-destructive" />,
      title: `${overstayed.length} visitor${overstayed.length > 1 ? "s" : ""} overstayed`,
      subtitle: longestOverstay ? `Longest: ${longestOverstay} over` : "",
      cta: "View All",
      onAction: onFilterOverstayed,
    },
    {
      show: draftCount > 0,
      bg: "bg-[hsl(213,100%,97%)]",
      border: "border-l-info",
      icon: <RefreshCw className="h-5 w-5 text-info" />,
      title: `${draftCount} pending import${draftCount > 1 ? "s" : ""} from clinical system`,
      subtitle: "Resident leave entries awaiting review",
      cta: "Review Drafts",
      onAction: onFilterDrafts,
    },
    {
      show: overdueResidents.length > 0,
      bg: "bg-[hsl(0,86%,97%)]",
      border: "border-l-[hsl(0,77%,49%)]",
      icon: <UserX className="h-5 w-5 text-destructive" />,
      title: `${overdueResidents.length} resident${overdueResidents.length > 1 ? "s" : ""} overdue for return`,
      subtitle: mostOverdue,
      cta: "View Residents",
      onAction: onFilterOverdue,
      pulse: true,
    },
    {
      show: pendingApprovals > 0,
      bg: "bg-[hsl(263,80%,97%)]",
      border: "border-l-[hsl(263,70%,58%)]",
      icon: <ClipboardCheck className="h-5 w-5 text-[hsl(263,70%,58%)]" />,
      title: `${pendingApprovals} checkout request${pendingApprovals > 1 ? "s" : ""} pending approval`,
      subtitle: "Awaiting sign-off before resident departs",
      cta: "Review →",
      onAction: onFilterPending,
    },
    {
      show: returnsToday.length > 0,
      bg: "bg-[hsl(167,72%,97%)]",
      border: "border-l-[hsl(174,62%,47%)]",
      icon: <CalendarCheck className="h-5 w-5 text-[hsl(174,62%,47%)]" />,
      title: `${returnsToday.length} resident${returnsToday.length > 1 ? "s" : ""} expected back today`,
      subtitle: returnsToday[0] ? `Next: ${returnsToday[0].firstName} ${returnsToday[0].surname}` : "",
      cta: "View List",
      onAction: onFilterReturnsToday,
    },
  ];

  const visibleCards = cards.filter((c) => c.show);
  if (visibleCards.length === 0) return null;

  return (
    <div className="px-6 pb-3">
      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
        {visibleCards.map((card, i) => (
          <div
            key={i}
            className={`flex-shrink-0 w-[280px] ${card.bg} border border-border rounded-[10px] p-3.5 border-l-[3px] ${card.border} transition-all duration-150 hover:-translate-y-0.5 hover:shadow-card-hover`}
            style={{ animationDelay: `${i * 150}ms` }}
          >
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5">{card.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  {card.pulse && (
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive"></span>
                    </span>
                  )}
                  <h4 className="text-sm font-semibold text-foreground leading-tight">{card.title}</h4>
                </div>
                {card.subtitle && (
                  <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{card.subtitle}</p>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px] font-semibold text-primary hover:text-primary px-0 mt-1"
                  onClick={card.onAction}
                >
                  {card.cta} →
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
