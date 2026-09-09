import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { StatusBadge } from "@/components/ui/status-badge";
import { PageHeader } from "@/components/ui/page-header";
import { DataTableShell } from "@/components/ui/data-table-shell";
import { getStatusPresentation } from "@/lib/statusPresentation";

describe("phase 7f primitives", () => {
  it("status badge shows a word, not colour alone", () => {
    render(<StatusBadge status="overdue" />);
    expect(screen.getByText("Overdue")).toBeTruthy();
  });
  it("unknown status falls back safely", () => {
    expect(getStatusPresentation("nope").label).toBe("Unknown");
    expect(getStatusPresentation("On_Site").label).toBe("On site");
  });
  it("page header renders one h1", () => {
    render(<PageHeader title="Visit list" description="Today" context="Riverstone" />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("Visit list");
  });
  it("table shell announces counts and clears filters", () => {
    render(<DataTableShell resultCount={1} resultNoun="visit" filtersActive onClearFilters={() => {}}><div /></DataTableShell>);
    expect(screen.getByText(/1 visit shown/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Clear filters/ })).toBeTruthy();
  });
});
