/**
 * PageHeader — the Centrim Life "page header card".
 *
 * An overline eyebrow in primary, a large title (the page's only h1), a
 * one-line description and an actions slot, with optional content underneath
 * (tabs, totals). The Centrim Life app header does not carry the page name, so
 * every staff page names itself here, in the body. Presentation only.
 */
import * as React from "react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export interface PageHeaderProps {
  title: string;
  /** Plain-language sentence under the title. Avoid jargon. */
  description?: React.ReactNode;
  /** Overline above the title: the section this page belongs to. */
  eyebrow?: string;
  /** Kept for older callers; the design system header carries no icon. */
  icon?: LucideIcon;
  iconClassName?: string;
  /** Current site or scope, shown as quiet context text. */
  context?: React.ReactNode;
  /** Primary and secondary actions. One solid primary button at most. */
  actions?: React.ReactNode;
  /** Tabs, totals or filters that belong to the header card. */
  children?: React.ReactNode;
  /** Heading level for the title element. Defaults to h1 (one per page). */
  as?: "h1" | "h2";
  /** "card" is the design system pattern; "plain" drops the card chrome. */
  variant?: "card" | "plain";
  /** Emergency pages use the error tone for the eyebrow. */
  tone?: "default" | "emergency";
  className?: string;
  id?: string;
}

export function PageHeader({
  title,
  description,
  eyebrow,
  context,
  actions,
  children,
  as: Heading = "h1",
  variant = "card",
  tone = "default",
  className,
  id,
}: PageHeaderProps) {
  return (
    <section
      aria-labelledby={id}
      className={cn(
        variant === "card" && "rounded-[20px] border border-border bg-card p-4 shadow-sm sm:p-6",
        className,
      )}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          {eyebrow && (
            <p className={cn(
              "text-[11px] font-extrabold uppercase leading-4 tracking-[0.06em]",
              tone === "emergency" ? "text-destructive-strong" : "text-primary",
            )}>
              {eyebrow}
            </p>
          )}
          <Heading id={id} tabIndex={-1} className="mt-1 break-words text-[28px] font-extrabold leading-9 text-foreground focus:outline-none">
            {title}
          </Heading>
          {description && <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p>}
          {context && <p className="mt-0.5 text-sm font-semibold text-foreground">{context}</p>}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2 lg:shrink-0 lg:justify-end [&>*]:flex-1 sm:[&>*]:flex-none">
            {actions}
          </div>
        )}
      </div>
      {children && <div className="mt-5">{children}</div>}
    </section>
  );
}

export default PageHeader;
