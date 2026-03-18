import { useEffect, useRef, useState } from "react";
import { Users, LogIn, LogOut, AlertTriangle } from "lucide-react";

interface StatCard {
  label: string;
  value: number;
  accent: string;
  icon: React.ReactNode;
  pulse?: boolean;
  filterKey: string;
}

interface SummaryStripProps {
  totalToday: number;
  currentlyInside: number;
  checkedOut: number;
  overstayed: number;
  onFilter: (key: string) => void;
  activeFilter?: string | null;
}

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<number>();

  useEffect(() => {
    const start = 0;
    const duration = 400;
    const startTime = performance.now();
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + (value - start) * eased));
      if (progress < 1) ref.current = requestAnimationFrame(animate);
    };
    ref.current = requestAnimationFrame(animate);
    return () => { if (ref.current) cancelAnimationFrame(ref.current); };
  }, [value]);

  return <>{display}</>;
}

export function SummaryStrip({
  totalToday, currentlyInside, checkedOut, overstayed,
  onFilter, activeFilter,
}: SummaryStripProps) {
  const cards: StatCard[] = [
    { label: "Total Today", value: totalToday, accent: "border-l-info", icon: <Users className="h-4 w-4 text-info" />, filterKey: "all" },
    { label: "Inside", value: currentlyInside, accent: "border-l-success", icon: <LogIn className="h-4 w-4 text-success" />, filterKey: "checked-in" },
    { label: "Checked Out", value: checkedOut, accent: "border-l-muted-foreground", icon: <LogOut className="h-4 w-4 text-muted-foreground" />, filterKey: "checked-out" },
    { label: "Overstayed", value: overstayed, accent: "border-l-destructive", icon: <AlertTriangle className="h-4 w-4 text-destructive" />, pulse: overstayed > 0, filterKey: "overstayed" },
  ];

  return (
    <div className="px-6 py-4 bg-background">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((card, i) => (
          <button
            key={card.filterKey}
            onClick={() => onFilter(card.filterKey)}
            className={`bg-card border border-border rounded-[10px] p-3.5 text-left transition-all duration-150 hover:-translate-y-0.5 hover:shadow-card-hover border-l-[3px] ${card.accent} ${
              activeFilter === card.filterKey ? "ring-2 ring-primary/30 shadow-card-hover" : "shadow-card"
            }`}
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">{card.label}</span>
              {card.icon}
            </div>
            <div className="flex items-center gap-1.5">
              {card.pulse && card.value > 0 && (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive"></span>
                </span>
              )}
              <span className={`text-2xl font-bold ${card.pulse && card.value > 0 ? "text-destructive" : "text-foreground"}`}>
                <AnimatedNumber value={card.value} />
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
