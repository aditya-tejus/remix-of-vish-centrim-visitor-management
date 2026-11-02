import { describe, it, expect } from "vitest";
import { indexByDay, summariseMonth, busyLevel, durationLabel, dayKey } from "@/lib/visitCalendar";
import type { Visitor } from "@/types/visitor";

let n = 0;
const v = (at: string, type: Visitor["type"] = "visitor"): Visitor => ({
  id: `v${++n}`, firstName: "A", surname: "B", email: "", mobile: "", type,
  checkInTime: new Date(at), checkOutTime: null, whomToVisit: "", address: "", status: "checked-out",
  healthDeclaration: false, additionalVisitors: 0, comments: "", retentionExpiry: new Date(), acknowledgedPrivacy: true,
} as Visitor);

describe("visit calendar", () => {
  const visits = [
    v("2026-11-02T14:00:00"), v("2026-11-02T09:00:00"), v("2026-11-02T10:00:00", "contractor"),
    v("2026-11-03T10:00:00"), v("2026-10-31T10:00:00"), v("2026-11-02T08:00:00", "resident"),
  ];

  it("groups by day in time order and leaves residents out", () => {
    const idx = indexByDay(visits);
    const day = idx.get("2026-11-02")!;
    expect(day.length).toBe(3);
    expect(day.map((x) => x.checkInTime.getHours())).toEqual([9, 10, 14]);
  });

  it("filters by person type", () => {
    expect(indexByDay(visits, "contractor").get("2026-11-02")!.length).toBe(1);
    expect(indexByDay(visits, "volunteer").size).toBe(0);
  });

  it("summarises only the shown month", () => {
    const s = summariseMonth(indexByDay(visits), new Date("2026-11-15"));
    expect(s.total).toBe(4);
    expect(s.daysWithVisits).toBe(2);
    expect(s.busiest && dayKey(s.busiest.date)).toBe("2026-11-02");
    expect(s.max).toBe(3);
  });

  it("scales busyness relative to the busiest day", () => {
    expect(busyLevel(0, 10)).toBe(0);
    expect(busyLevel(1, 10)).toBe(1);
    expect(busyLevel(4, 10)).toBe(2);
    expect(busyLevel(7, 10)).toBe(3);
    expect(busyLevel(10, 10)).toBe(4);
    expect(busyLevel(3, 0)).toBe(0);
  });

  it("describes visit length plainly", () => {
    const a = new Date("2026-11-02T09:00:00");
    expect(durationLabel(a, new Date("2026-11-02T09:45:00"))).toBe("45 min");
    expect(durationLabel(a, new Date("2026-11-02T11:00:00"))).toBe("2 h");
    expect(durationLabel(a, new Date("2026-11-02T10:20:00"))).toBe("1 h 20 min");
  });
});
