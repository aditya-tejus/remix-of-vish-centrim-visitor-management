import { describe, it, expect } from "vitest";
import { minutesLabel, visitPatterns } from "@/lib/visitPatterns";
import type { Visitor } from "@/types/visitor";

let n = 0;
const v = (inAt: string, outAt: string | null, p: Partial<Visitor> = {}): Visitor => ({
  id: `v${++n}`, firstName: "A", surname: `B${n}`, email: `p${n}@x`, mobile: "", type: "visitor",
  checkInTime: new Date(inAt), checkOutTime: outAt ? new Date(outAt) : null, whomToVisit: "", address: "", status: outAt ? "checked-out" : "checked-in",
  healthDeclaration: false, additionalVisitors: 0, comments: "", retentionExpiry: new Date(), acknowledgedPrivacy: true, ...p,
} as Visitor);

describe("visit patterns", () => {
  const from = new Date("2026-10-28T00:00:00"), to = new Date("2026-11-03T23:59:59");
  const visits = [
    v("2026-11-03T10:00:00", "2026-11-03T11:00:00", { whomToVisit: "Ruth Ng" }),
    v("2026-11-03T10:30:00", null, { type: "contractor" }),
    v("2026-11-02T14:00:00", "2026-11-02T14:30:00", { whomToVisit: "ruth ng" }),
    v("2026-11-02T09:00:00", "2026-11-02T17:00:00", { type: "resident" }), // a resident is never a visit
    v("2026-10-01T10:00:00", "2026-10-01T11:00:00"), // outside the period
  ];
  const p = visitPatterns(visits, from, to, ["Ruth Ng", "Ida Fox"]);

  it("counts visits only, inside the period", () => {
    expect(p.total).toBe(3);
    expect(p.people).toBe(3);
    expect(p.byDay).toHaveLength(7);
    expect(p.byDay[6]).toMatchObject({ total: 2, visitor: 1, contractor: 1 });
    expect(p.busiestDay?.count).toBe(2);
    expect(p.typesPresent).toEqual(["visitor", "contractor"]);
  });

  it("finds the busy hour and average visit length", () => {
    expect(p.peakHour).toBe(10);
    expect(p.averageMinutes).toBe(45);
    expect(p.lengthByType).toEqual([{ type: "visitor", label: "Visitors", minutes: 45, visits: 2 }]);
  });

  it("ranks residents by social visits and names those with none", () => {
    expect(p.topResidents).toEqual([{ name: "Ruth Ng", count: 2 }]);
    expect(p.residentsWithoutVisitors).toEqual(["Ida Fox"]);
  });

  it("averages each weekday over the days in the period", () => {
    expect(p.byWeekday.find((d) => d.day === "Tue")!.average).toBe(2);
    expect(p.byWeekday.find((d) => d.day === "Wed")!.average).toBe(0);
  });

  it("writes lengths plainly", () => {
    expect(minutesLabel(45)).toBe("45 min");
    expect(minutesLabel(80)).toBe("1 h 20 min");
    expect(minutesLabel(null)).toBe("—");
  });
});
