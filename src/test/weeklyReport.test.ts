import { describe, it, expect } from "vitest";
import {
  buildReportRows,
  clampRange,
  filterReportRows,
  reportToRows,
  weekWindow,
  formatDateInZone,
  type CanonicalPartyInput,
  type LegacyVisitInput,
} from "@/lib/weeklyReport";
import type { Visitor } from "@/types/visitor";

const SITE = "site-a";
const TZ = "Australia/Sydney";
const NOW = new Date("2026-09-09T02:00:00Z"); // Wed 12:00 Sydney

function party(over: Partial<CanonicalPartyInput> = {}): CanonicalPartyInput {
  return {
    id: "p1",
    visitId: "v1",
    branchId: SITE,
    personType: "visitor",
    destinationLabel: "Mark Stevens",
    displayName: "Adam John",
    nameStatus: "named",
    isPrimary: true,
    companionIndex: 0,
    relationship: null,
    checkInTime: new Date("2026-09-09T01:00:00Z"),
    checkOutTime: null,
    legacyVisitorId: "leg-1",
    screeningOutcome: null,
    ...over,
  };
}

function legacyVisitor(over: Partial<Visitor> = {}, branchId: string | null = SITE): LegacyVisitInput {
  return {
    branchId,
    visitor: {
      id: "leg-9",
      firstName: "Old",
      surname: "Record",
      type: "visitor",
      checkInTime: new Date("2026-09-07T01:00:00Z"),
      checkOutTime: null,
      status: "checked-in",
      whomToVisit: "Rose Cottage",
      additionalVisitors: 0,
      companionDetails: [],
      ...over,
    } as unknown as Visitor,
  };
}

const opts = { siteId: SITE, now: NOW, timeZone: TZ, includeScreening: false };

describe("week windows", () => {
  it("starts on Monday in the site's own time", () => {
    const { start, end } = weekWindow(NOW, TZ);
    expect(formatDateInZone(start, TZ)).toBe("07 Sep 2026");
    expect(formatDateInZone(new Date(end.getTime() - 1000), TZ)).toBe("13 Sep 2026");
  });

  it("moves a whole week back and forward", () => {
    expect(formatDateInZone(weekWindow(NOW, TZ, -1).start, TZ)).toBe("31 Aug 2026");
    expect(formatDateInZone(weekWindow(NOW, TZ, 1).start, TZ)).toBe("14 Sep 2026");
  });

  it("uses the site time zone, not the browser's", () => {
    const uk = weekWindow(NOW, "Europe/London");
    expect(formatDateInZone(uk.start, "Europe/London")).toBe("07 Sep 2026");
  });

  it("caps a custom range at 31 days", () => {
    const { window, capped } = clampRange(new Date("2026-01-01T00:00:00Z"), new Date("2026-06-01T00:00:00Z"));
    expect(capped).toBe(true);
    expect(window.end.getTime() - window.start.getTime()).toBe(31 * 86400000);
  });
});

describe("report rows", () => {
  it("gives a companion its own row with who they came with", () => {
    const rows = buildReportRows(
      [party(), party({ id: "p2", isPrimary: false, companionIndex: 1, displayName: "Madia" })],
      [],
      opts
    );
    const companion = rows.find((r) => r.role === "companion")!;
    expect(companion.name).toBe("Madia");
    expect(companion.withPrimaryName).toBe("Adam John");
  });

  it("separates still on site from a missing sign-out", () => {
    const rows = buildReportRows(
      [
        party({ id: "today" }),
        party({ id: "old", visitId: "v2", checkInTime: new Date("2026-09-07T01:00:00Z"), legacyVisitorId: "leg-2" }),
        party({ id: "done", visitId: "v3", checkOutTime: new Date("2026-09-09T01:30:00Z"), legacyVisitorId: "leg-3" }),
      ],
      [],
      opts
    );
    expect(rows.find((r) => r.key === "today")!.leftState).toBe("on-site");
    expect(rows.find((r) => r.key === "old")!.leftState).toBe("missing");
    expect(rows.find((r) => r.key === "done")!.leftState).toBe("left");
  });

  it("marks records with no attendance record as legacy", () => {
    const rows = buildReportRows([], [legacyVisitor()], opts);
    expect(rows).toHaveLength(1);
    expect(rows[0].record).toBe("legacy");
    expect(rows[0].destination).toBe("Rose Cottage");
  });

  it("does not repeat a visit that already has attendance records", () => {
    const rows = buildReportRows([party()], [legacyVisitor({ id: "leg-1" })], opts);
    expect(rows).toHaveLength(1);
    expect(rows[0].record).toBe("canonical");
  });

  it("keeps unnamed companions as their own row", () => {
    const rows = buildReportRows(
      [party(), party({ id: "p3", isPrimary: false, companionIndex: 1, nameStatus: "unresolved", displayName: "" })],
      [],
      opts
    );
    const unnamed = rows.find((r) => !r.nameKnown)!;
    expect(unnamed.name).toContain("name not recorded");
  });

  it("never shows another site's people", () => {
    const rows = buildReportRows(
      [party({ branchId: "site-b" })],
      [legacyVisitor({}, "site-b")],
      opts
    );
    expect(rows).toEqual([]);
  });

  it("returns nothing for an empty week", () => {
    expect(buildReportRows([], [], opts)).toEqual([]);
  });
});

describe("screening permission", () => {
  it("omits screening status when the reader may not see it", () => {
    const rows = buildReportRows([], [legacyVisitor({ screeningOutcome: "blocked" })], opts);
    expect(rows[0].screeningStatus).toBeNull();
    expect(reportToRows(rows, TZ, false)[0]).not.toContain("Check-in questions");
  });

  it("shows only the status, never an answer, when permitted", () => {
    const rows = buildReportRows([], [legacyVisitor({ screeningOutcome: "blocked" })], {
      ...opts,
      includeScreening: true,
    });
    expect(rows[0].screeningStatus).toBe("Blocked");
    const table = reportToRows(rows, TZ, true);
    expect(table[0]).toContain("Check-in questions");
    expect(table[1]).toContain("Blocked");
  });
});

describe("filters and export shape", () => {
  const rows = buildReportRows(
    [
      party(),
      party({ id: "p2", isPrimary: false, companionIndex: 1, displayName: "Madia" }),
      party({ id: "p4", visitId: "v4", personType: "contractor", displayName: "Sam Fix", destinationLabel: "Boiler room", checkInTime: new Date("2026-09-07T01:00:00Z"), legacyVisitorId: "leg-4" }),
    ],
    [],
    opts
  );

  it("searches by name and destination", () => {
    expect(filterReportRows(rows, { search: "boiler" })).toHaveLength(1);
    expect(filterReportRows(rows, { search: "madia" })).toHaveLength(1);
  });

  it("filters by person type and missing sign-out", () => {
    expect(filterReportRows(rows, { personType: "contractor" })).toHaveLength(1);
    expect(filterReportRows(rows, { missingOnly: true }).every((r) => r.leftState === "missing")).toBe(true);
  });

  it("exports one line per person with a readable sign-out status", () => {
    const table = reportToRows(rows, TZ, false);
    expect(table).toHaveLength(rows.length + 1);
    expect(table[0]).toEqual([
      "Name",
      "Person type",
      "Role",
      "Arrived",
      "Destination",
      "Left",
      "Sign-out status",
      "Record",
    ]);
    expect(table.some((line) => line.includes("With Adam John"))).toBe(true);
    expect(table.some((line) => line.includes("No sign-out recorded"))).toBe(true);
  });
});
