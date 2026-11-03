import { describe, it, expect } from "vitest";
import { onSiteRoll, rollPrintHtml } from "@/lib/onSiteRoll";
import type { Visitor } from "@/types/visitor";

let n = 0;
const v = (p: Partial<Visitor>): Visitor => ({
  id: `v${++n}`, firstName: "A", surname: `B${n}`, email: "", mobile: "", type: "visitor",
  checkInTime: new Date("2026-11-03T09:00:00"), checkOutTime: null, whomToVisit: "", address: "", status: "checked-in",
  healthDeclaration: false, additionalVisitors: 0, comments: "", retentionExpiry: new Date(), acknowledgedPrivacy: true, ...p,
} as Visitor);
const now = new Date("2026-11-03T11:30:00");

describe("on-site roll", () => {
  const all = [
    v({ firstName: "Zed", surname: "Young" }),
    v({ firstName: "Amy", surname: "Ash", whomToVisit: "Ruth Ng" }),
    v({ firstName: "Bo", surname: "Cole", type: "contractor", whomToVisit: "Maintenance", checkInTime: new Date("2026-11-02T08:00:00") }),
    v({ firstName: "Ruth", surname: "Ng", type: "resident" }),
    v({ firstName: "Gone", surname: "Home", status: "checked-out" }),
  ];
  const past = (x: Visitor) => x.type === "contractor";

  it("leaves residents and people who left off the roll, grouped and alphabetical", () => {
    const r = onSiteRoll(all, { now, isPastExpected: past });
    expect(r.total).toBe(3);
    expect(r.groups.map((g) => g.label)).toEqual(["Visitors", "Contractors"]);
    expect(r.groups[0].entries.map((e) => e.name)).toEqual(["Amy Ash", "Zed Young"]);
    expect(r.groups[0].entries[0].stay).toBe("2 h 30 min");
    expect(r.groups[1].entries[0]).toMatchObject({ pastExpected: true, fromEarlierDay: true });
  });

  it("filters to people past their expected time and by search", () => {
    expect(onSiteRoll(all, { now, isPastExpected: past, onlyPastExpected: true }).shown).toBe(1);
    expect(onSiteRoll(all, { now, isPastExpected: past, search: "mainten" }).groups[0].entries[0].name).toBe("Bo Cole");
    expect(onSiteRoll(all, { now, isPastExpected: past, search: "ruth" }).shown).toBe(1);
  });

  it("escapes names on the print page", () => {
    const r = onSiteRoll([v({ firstName: "<b>x</b>", surname: "Q" })], { now, isPastExpected: () => false });
    const html = rollPrintHtml(r.groups, { siteName: "Oak & Ash", now });
    expect(html).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(html).toContain("Oak &amp; Ash");
    expect(html).toContain("residents not included");
  });
});
