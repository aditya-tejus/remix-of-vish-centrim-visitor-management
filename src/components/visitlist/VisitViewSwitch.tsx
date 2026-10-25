import { AlertTriangle, CalendarClock, History, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { VisitViewDef, VisitViewKey } from "@/hooks/useVisitViews";

const iconFor: Record<VisitViewKey, React.ElementType> = {
  "on-site": LogIn,
  overdue: AlertTriangle,
  recent: History,
  scheduled: CalendarClock,
};

interface Props {
  views: VisitViewDef[];
  active: VisitViewKey;
  onChange: (key: VisitViewKey) => void;
}

/** One control decides what the list shows. Counts live on the control itself. */
export function VisitViewSwitch({ views, active, onChange }: Props) {
  return (
    <div
      role="group"
      aria-label="Visit list views"
      className="flex flex-wrap gap-2 px-4 sm:px-6 pt-3 pb-1"
    >
      {views.map((view) => {
        const Icon = iconFor[view.key];
        const isActive = view.key === active;
        const alert = view.key === "overdue" && view.count > 0;
        return (
          <Button variant="ghost"
            key={view.key}
            aria-pressed={isActive}
            onClick={() => onChange(view.key)}
            className={`flex min-h-[44px] shrink-0 items-center gap-2 rounded-control border px-4 py-2 text-left transition-all duration-150 active:scale-[0.99] ${
              isActive
                ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
                : "border-border bg-card hover:shadow-sm"
            }`}
          >
            <Icon
              className={`h-4 w-4 ${
                alert ? "text-warning-strong" : isActive ? "text-primary" : "text-muted-foreground"
              }`}
              aria-hidden
            />
            <span
              className={`text-sm font-medium ${
                isActive ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {view.label}
            </span>
            <span
              className={`text-base font-bold tabular-nums ${
                alert ? "text-warning-strong" : "text-foreground"
              }`}
            >
              {view.count}
            </span>
          </Button>
        );
      })}
    </div>
  );
}
