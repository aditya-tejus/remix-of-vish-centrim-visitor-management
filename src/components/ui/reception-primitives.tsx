import type { ReactNode } from "react";
import { ArrowRight, type LucideIcon } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function QuickAction({ icon: Icon, children, className, ...props }: ButtonProps & { icon: LucideIcon }) {
  return <Button className={cn("min-h-touch gap-2", className)} {...props}><Icon aria-hidden />{children}</Button>;
}

export function MetricStrip({ items }: { items: { label: string; value: number; icon: LucideIcon; attention?: boolean }[] }) {
  return <section aria-label="Current activity" className="grid grid-cols-2 sm:grid-cols-4 overflow-hidden rounded-2xl border border-border bg-card shadow-sm divide-x divide-border">
    {items.map(({ label, value, icon: Icon, attention }) => <div key={label} className="px-4 py-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground"><Icon className="h-4 w-4" aria-hidden />{label}</div>
      <p className={cn("mt-1 text-2xl font-semibold tabular-nums", attention ? "text-warning-strong" : "text-foreground")}>{value}</p>
    </div>)}
  </section>;
}

export function AttentionRow({ label, count, onClick }: { label: string; count: number; onClick: () => void }) {
  return <Button variant="ghost" onClick={onClick} className="w-full min-h-touch h-auto justify-between rounded-none whitespace-normal px-0 py-2 text-left">
    <span className="flex items-center gap-3"><span className={cn("min-w-8 text-lg font-extrabold tabular-nums", count > 0 ? "text-warning-strong" : "text-muted-foreground")}>{count}</span><span className="text-sm text-foreground">{label}</span></span>
    <ArrowRight aria-hidden className="text-muted-foreground" />
  </Button>;
}

export function KioskActionTile({ icon: Icon, children, primary, onClick }: { icon: LucideIcon; children: ReactNode; primary?: boolean; onClick: () => void }) {
  return <Button variant={primary ? "default" : "outline"} onClick={onClick} className={cn("h-auto min-h-28 w-full justify-start gap-5 whitespace-normal rounded-card p-6 text-left text-2xl font-semibold active:scale-[0.99] [&_svg]:size-8", !primary && "bg-card border-primary/25 text-primary")}>
    <Icon aria-hidden /><span>{children}</span><ArrowRight className="ml-auto" aria-hidden />
  </Button>;
}

/** Design system stat tile: sentence-case label, large number, optional note. No coloured edge. */
export function StatTile({ label, value, icon: Icon, note, tone = "neutral", className }: {
  label: string; value: ReactNode; icon?: LucideIcon; note?: ReactNode; tone?: "neutral" | "attention"; className?: string;
}) {
  const warn = tone === "attention";
  return (
    <div className={cn("rounded-2xl border bg-card p-4 shadow-sm sm:p-5", warn ? "border-[hsl(var(--warning)/0.45)] bg-warning-subtle/40" : "border-border", className)}>
      <p className="flex items-center gap-1.5 text-[13px] font-bold text-foreground">
        {Icon && <Icon aria-hidden className={cn("h-4 w-4", warn ? "text-warning-strong" : "text-muted-foreground")} />}{label}
      </p>
      <p className={cn("mt-1 text-[28px] font-extrabold leading-8 tabular-nums", warn ? "text-warning-strong" : "text-foreground")}>{value}</p>
      {note && <p className={cn("mt-0.5 text-xs", warn ? "font-bold text-warning-strong" : "text-muted-foreground")}>{note}</p>}
    </div>
  );
}
