/**
 * Phase 7F — DataTableShell.
 *
 * Shared frame for registers and reports: a toolbar row (search, filters,
 * clear), an announced result count, and one place for the table body.
 * It does not own data, sorting, filtering or any workflow — callers keep
 * their existing logic and pass results in.
 */
import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { FilterX } from "lucide-react";

export interface DataTableShellProps {
  /** Search field, filter chips and other controls. */
  toolbar?: React.ReactNode;
  /** Number of rows currently shown. Announced politely when it changes. */
  resultCount?: number;
  /** Word used in the count, e.g. "visit", "key", "record". */
  resultNoun?: string;
  /** Shown only when filters are active. Must reset search, chips and dates together. */
  onClearFilters?: () => void;
  filtersActive?: boolean;
  /** Quiet text on the right of the toolbar, e.g. "Updated 09:14 am". */
  meta?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

function pluralise(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

export function DataTableShell({
  toolbar,
  resultCount,
  resultNoun = "result",
  onClearFilters,
  filtersActive = false,
  meta,
  children,
  className,
}: DataTableShellProps) {
  return (
    <section className={cn("space-y-3", className)}>
      {(toolbar || onClearFilters || meta) && (
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-2">{toolbar}</div>
          <div className="flex shrink-0 items-center gap-2">
            {meta && <span className="text-xs text-muted-foreground">{meta}</span>}
            {onClearFilters && filtersActive && (
              <Button variant="outline" size="sm" onClick={onClearFilters} className="gap-1.5">
                <FilterX aria-hidden="true" className="h-4 w-4" />
                <span>Clear filters</span>
              </Button>
            )}
          </div>
        </div>
      )}

      {typeof resultCount === "number" && (
        <p aria-live="polite" className="text-xs text-muted-foreground">
          {pluralise(resultCount, resultNoun)} shown
          {filtersActive ? " with the current filters" : ""}.
        </p>
      )}

      <div className="min-w-0">{children}</div>
    </section>
  );
}

export default DataTableShell;
