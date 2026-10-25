/**
 * Phase 7F — PageHeader.
 *
 * One heading treatment for staff screens: exactly one <h1> per page, an
 * optional plain-language description, optional site context and an actions
 * slot. Presentation only.
 */
import * as React from "react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export interface PageHeaderProps {
  title: string;
  /** Plain-language sentence under the title. Avoid jargon. */
  description?: string;
  /** Decorative icon shown next to the title. */
  icon?: LucideIcon;
  iconClassName?: string;
  /** Current site or scope, shown as quiet context text. */
  context?: React.ReactNode;
  /** Primary and secondary actions. Critical actions must carry visible text. */
  actions?: React.ReactNode;
  /** Heading level for the title element. Defaults to h1 (one per page). */
  as?: "h1" | "h2";
  className?: string;
  id?: string;
}

export function PageHeader({
  title,
  description,
  icon: Icon,
  iconClassName,
  context,
  actions,
  as: Heading = "h1",
  className,
  id,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 md:flex-row md:items-start md:justify-between",
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        <Heading
          id={id}
          tabIndex={-1}
          className="flex items-center gap-2 text-2xl font-semibold text-foreground"
        >
          {Icon && <Icon aria-hidden="true" className={cn("h-5 w-5 shrink-0 text-muted-foreground", iconClassName)} />}
          <span className="break-words">{title}</span>
        </Heading>
        {description && <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>}
        {context && <p className="text-sm text-muted-foreground">{context}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 md:justify-end">{actions}</div>}
    </div>
  );
}

export default PageHeader;
