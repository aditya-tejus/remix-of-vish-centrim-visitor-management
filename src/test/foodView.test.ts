import { describe, it, expect } from "vitest";
import { foodTotals, groupByDay, periodRange, safeSearch } from "@/lib/foodView";
import type { FoodRecord } from "@/lib/foodRegister";

const rec = (at: string, p: Partial<FoodRecord> = {}): FoodRecord => ({
  id: at, residentVisitorId: "r", residentName: "Ruth", visitorId: null, broughtByName: "Sam",
  foodDescription: "Cake", foodType: "packaged", sharedWithOthers: false, sharedResidentIds: [], sharedResidentNames: [],
  notes: null, recordedAt: new Date(at), source: "manual", createdBy: null, ...p,
});
const now = new Date("2026-11-03T10:00:00");

describe("food register page rules", () => {
  it("turns presets into date ranges", () => {
    expect(periodRange("today", now)).toEqual({ from: "2026-11-03", to: "2026-11-03" });
    expect(periodRange("7d", now)).toEqual({ from: "2026-10-28", to: "2026-11-03" });
    expect(periodRange("all", now)).toEqual({ from: "", to: "" });
    expect(periodRange("custom", now, { from: "2026-10-01", to: "" })).toEqual({ from: "2026-10-01", to: "" });
  });

  it("groups by day, newest first, with plain day names", () => {
    const g = groupByDay([rec("2026-11-01T09:00:00"), rec("2026-11-03T08:00:00"), rec("2026-11-02T12:00:00"), rec("2026-11-03T09:30:00")], now);
    expect(g.map((x) => x.label)).toEqual(["Today", "Yesterday", "Sunday 1 November"]);
    expect(g[0].items.map((x) => x.id)).toEqual(["2026-11-03T09:30:00", "2026-11-03T08:00:00"]);
  });

  it("counts what is on screen", () => {
    const t = foodTotals([
      rec("2026-11-03T08:00:00", { foodType: "homemade" }),
      rec("2026-10-30T08:00:00", { sharedWithOthers: true, residentVisitorId: "q" }),
      rec("2026-10-20T08:00:00", { foodType: "homemade", sharedWithOthers: true }),
    ]);
    expect(t).toEqual({ total: 3, homemade: 2, shared: 2, residents: 2 });
  });

  it("keeps searches to plain words", () => {
    expect(safeSearch("cake,notes.ilike.%x%)")).toBe("cake notes.ilike. x");
  });
});
