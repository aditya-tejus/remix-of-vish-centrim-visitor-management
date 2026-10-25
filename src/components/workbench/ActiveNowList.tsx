import { isOverstayedSync } from "@/hooks/useOverstayPolicy";
import { Visitor } from "@/types/visitor";
import { format, formatDistanceToNowStrict } from "date-fns";
import { Button } from "@/components/ui/button";
import { LogOut, ArrowRight, User, Briefcase, Heart, Users } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";

const typeConfig: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  visitor: { label: "Visitor", icon: User, className: "bg-info/10 text-info-strong border-info/20" },
  contractor: { label: "Contractor", icon: Briefcase, className: "bg-warning/10 text-warning-strong border-warning/20" },
  volunteer: { label: "Volunteer", icon: Heart, className: "bg-success/10 text-success-strong border-success/20" },
  staff: { label: "Staff", icon: Users, className: "bg-primary/10 text-primary border-primary/20" },
  resident: { label: "Resident", icon: User, className: "bg-accent text-accent-foreground border-border" },
};

interface ActiveNowListProps {
  visitors: Visitor[];
  onCheckOut: (id: string) => void;
  onViewAll: () => void;
}

export function ActiveNowList({ visitors, onCheckOut, onViewAll }: ActiveNowListProps) {
  const sorted = [...visitors].sort((a, b) => b.checkInTime.getTime() - a.checkInTime.getTime());
  const displayed = sorted.slice(0, 15);

  return (
    <div className="border-y border-border bg-card">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" aria-hidden />
          <h2 className="text-lg font-semibold text-foreground">On site now</h2>
          <span className="text-sm text-muted-foreground">({visitors.length})</span>
        </div>
        <Button variant="ghost" size="sm" className="text-sm gap-1 text-muted-foreground hover:text-foreground" onClick={onViewAll}>
          View All <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>

      {displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-7 text-muted-foreground">
          <Users className="h-8 w-8 mb-2 opacity-40" />
          <p className="text-sm font-medium">No one on-site</p>
          <p className="text-sm">Check someone in to see them here</p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {displayed.map((v) => {
            const cfg = typeConfig[v.type] || typeConfig.visitor;
            const Icon = cfg.icon;
            const duration = formatDistanceToNowStrict(v.checkInTime, { addSuffix: false });
            const isOverstayed = isOverstayedSync(v);

            return (
              <div key={v.id} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${cfg.className}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-medium text-foreground truncate">
                    {v.firstName} {v.surname}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
                    <span>{cfg.label}</span>
                    <span>·</span>
                    <span>In {format(v.checkInTime, "hh:mm a")}</span>
                    {v.whomToVisit && (
                      <>
                        <span>·</span>
                        <span className="truncate">Visiting {v.whomToVisit}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  {isOverstayed && (
                    <StatusBadge status="overdue" />
                  )}
                  <span className="text-sm text-muted-foreground tabular-nums hidden sm:inline text-right">{duration}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-touch text-sm gap-1 border-border"
                    onClick={() => onCheckOut(v.id)}
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Check Out
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {visitors.length > 15 && (
        <div className="px-5 py-2.5 border-t border-border">
          <Button variant="ghost" size="sm" className="w-full text-sm text-muted-foreground" onClick={onViewAll}>
            +{visitors.length - 15} more — view all
          </Button>
        </div>
      )}
    </div>
  );
}
