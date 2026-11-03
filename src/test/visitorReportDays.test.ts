import { describe, it, expect } from "vitest";
import { groupRowsByDay, type ReportRow } from "@/lib/weeklyReport";

const row = (iso: string): ReportRow => ({
  key: iso, name: "A", nameKnown: true, personType: "visitor", role: "primary", withPrimaryName: null,
  arrived: new Date(iso), destination: "", left: null, leftState: "left", record: "canonical", screeningStatus: null, visitorId: null,
});

describe("visitor report day groups", () => {
  it("groups newest-first rows by the site's local day", () => {
    const g = groupRowsByDay([row("2026-11-03T10:00:00Z"), row("2026-11-03T08:00:00Z"), row("2026-11-02T23:30:00Z")], "Europe/London");
    expect(g.map((x) => [x.day, x.rows.length])).toEqual([["Tuesday 3 November", 2], ["Monday 2 November", 1]]);
  });
  it("uses the site's zone, not the device's", () => {
    const g = groupRowsByDay([row("2026-11-02T23:30:00Z")], "Australia/Sydney");
    expect(g[0].day).toBe("Tuesday 3 November");
  });
});
