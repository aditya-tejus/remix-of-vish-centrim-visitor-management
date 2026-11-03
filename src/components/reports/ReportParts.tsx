import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Series colours follow the person type, never the rank, so a filter never repaints them. */
export const TYPE_COLOR: Record<string, string> = {
  visitor: "hsl(var(--chart-1))",
  contractor: "hsl(var(--chart-2))",
  volunteer: "hsl(var(--chart-3))",
  staff: "hsl(var(--chart-4))",
  other: "hsl(var(--chart-6))",
};

export const axisTick = { fill: "hsl(var(--muted-foreground))", fontSize: 12 };
export const tooltipStyle = {
  backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12,
  fontSize: 13, boxShadow: "0 6px 16px -4px rgba(16,24,40,.1)",
};

/** A titled card for one chart or list in a report. */
export function ChartCard({ title, description, children, className, aside }: {
  title: string; description?: ReactNode; children: ReactNode; className?: string; aside?: ReactNode;
}) {
  return (
    <section className={cn("rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5", className)}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-extrabold leading-6 text-foreground">{title}</h2>
          {description && <p className="text-[13px] text-muted-foreground">{description}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  if (items.length < 2) return null;
  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-muted-foreground">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ background: i.color }} />{i.label}
        </li>
      ))}
    </ul>
  );
}

/** Chips for picking a period or a filter value. */
export function ChoiceChips<T extends string>({ label, options, value, onChange }: {
  label: string; options: { id: T; label: string }[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={o.id} type="button" aria-pressed={value === o.id} onClick={() => onChange(o.id)}
          className={cn("min-h-11 rounded-full border px-4 text-sm font-bold transition-colors",
            value === o.id ? "border-primary bg-accent text-accent-foreground" : "border-input bg-card text-foreground hover:border-primary/60")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
