import { describe, it, expect } from "vitest";
import {
  buildDirectory, personKey, inTab, matchesSearch, sortEntries, lastVisitLabel, needsAttention,
  type DirectoryFlags,
} from "@/lib/visitorDirectory";
import type { Visitor } from "@/types/visitor";

const NOW = new Date("2026-11-02T12:00:00");
let n = 0;
function v(p: Partial<Visitor>): Visitor {
  n += 1;
  return {
    id: `v${n}`, firstName: "Ana", surname: "Marsh", email: "", mobile: "", type: "visitor",
    checkInTime: new Date("2026-11-01T10:00:00"), checkOutTime: new Date("2026-11-01T11:00:00"),
    whomToVisit: "", address: "", status: "checked-out", healthDeclaration: false, additionalVisitors: 0,
    comments: "", retentionExpiry: new Date(), acknowledgedPrivacy: true, ...p,
  } as Visitor;
}
const noFlags: DirectoryFlags = { watchlist: false, overdue: false, screening: null, keysHeld: 0 };

describe("visitor profiles directory", () => {
  it("merges visits only on a personal code or real contact detail, never on name alone", () => {
    const list = buildDirectory([
      v({ email: "ana@example.com" }), v({ email: "ANA@example.com " }),
      v({ firstName: "Jane", surname: "Smith" }), v({ firstName: "Jane", surname: "Smith" }),
      v({ mobile: "0412 345 678" }), v({ mobile: "0412345678" }),
    ]);
    expect(list.length).toBe(4); // one email person, two separate Janes, one mobile person
    expect(personKey({ id: "x", personQr: "VIS-1", email: "a@b.c", mobile: "" })).toBe("qr:VIS-1");
    expect(personKey({ id: "x", email: "", mobile: "123" })).toBe("record:x"); // too short to identify
  });

  it("leaves residents out (they have their own section)", () => {
    expect(buildDirectory([v({ type: "resident" }), v({ email: "a@x.com" })]).length).toBe(1);
  });

  it("uses the newest visit, counts visits and knows when someone is on site", () => {
    const [e] = buildDirectory([
      v({ email: "a@x.com", checkInTime: new Date("2026-10-20T09:00:00") }),
      v({ email: "a@x.com", checkInTime: new Date("2026-11-02T10:15:00"), status: "checked-in", checkOutTime: null }),
    ]);
    expect(e.visitCount).toBe(2);
    expect(e.onSite).toBe(true);
    expect(e.onSiteSince?.getHours()).toBe(10);
    expect(e.lastVisit.getDate()).toBe(2);
  });

  it("picks the destination visited most often, ties going to the most recent", () => {
    const [e] = buildDirectory([
      v({ email: "a@x.com", whomToVisit: "Beryl", checkInTime: new Date("2026-10-01") }),
      v({ email: "a@x.com", whomToVisit: "Ronald", checkInTime: new Date("2026-10-10") }),
      v({ email: "a@x.com", whomToVisit: "Beryl", checkInTime: new Date("2026-10-05") }),
    ]);
    expect(e.usuallyVisits).toBe("Beryl");
    const [t] = buildDirectory([
      v({ email: "b@x.com", whomToVisit: "Beryl", checkInTime: new Date("2026-10-01") }),
      v({ email: "b@x.com", whomToVisit: "Ronald", checkInTime: new Date("2026-10-10") }),
    ]);
    expect(t.usuallyVisits).toBe("Ronald");
  });

  it("filters tabs: on site, last 30 days and needs attention", () => {
    const [onSite, old] = buildDirectory([
      v({ email: "a@x.com", status: "checked-in", checkOutTime: null, checkInTime: new Date("2026-11-02T09:00:00") }),
      v({ email: "b@x.com", checkInTime: new Date("2026-08-01T09:00:00") }),
    ]);
    expect(inTab(onSite, "on_site", noFlags, NOW)).toBe(true);
    expect(inTab(old, "on_site", noFlags, NOW)).toBe(false);
    expect(inTab(onSite, "recent", noFlags, NOW)).toBe(true);
    expect(inTab(old, "recent", noFlags, NOW)).toBe(false);
    expect(inTab(old, "attention", { ...noFlags, watchlist: true }, NOW)).toBe(true);
    expect(needsAttention(noFlags)).toBe(false);
    expect(needsAttention({ ...noFlags, keysHeld: 1 })).toBe(true);
    expect(needsAttention({ ...noFlags, screening: "flagged" })).toBe(true);
  });

  it("searches name, email, phone digits and usual destination", () => {
    const [e] = buildDirectory([v({ email: "ana@example.com", mobile: "0412 345 678", whomToVisit: "Beryl Nguyen" })]);
    expect(matchesSearch(e, "marsh")).toBe(true);
    expect(matchesSearch(e, "example.com")).toBe(true);
    expect(matchesSearch(e, "345 678")).toBe(true);
    expect(matchesSearch(e, "beryl")).toBe(true);
    expect(matchesSearch(e, "zz")).toBe(false);
    expect(matchesSearch(e, "  ")).toBe(true);
  });

  it("sorts on-site people first then by last visit, or by surname", () => {
    const list = buildDirectory([
      v({ email: "a@x.com", surname: "Young", checkInTime: new Date("2026-11-01") }),
      v({ email: "b@x.com", surname: "Abbott", checkInTime: new Date("2026-10-01") }),
      v({ email: "c@x.com", surname: "Moore", checkInTime: new Date("2026-09-01"), status: "checked-in", checkOutTime: null }),
    ]);
    expect(sortEntries(list, "last_visit").map((e) => e.latest.surname)).toEqual(["Moore", "Young", "Abbott"]);
    expect(sortEntries(list, "name").map((e) => e.latest.surname)).toEqual(["Abbott", "Moore", "Young"]);
  });

  it("describes the last visit in plain words", () => {
    expect(lastVisitLabel(new Date("2026-11-02T08:00:00"), NOW)).toBe("Today");
    expect(lastVisitLabel(new Date("2026-11-01T20:00:00"), NOW)).toBe("Yesterday");
    expect(lastVisitLabel(new Date("2026-10-29T20:00:00"), NOW)).toBe("4 days ago");
    expect(lastVisitLabel(new Date("2026-10-24T20:00:00"), NOW)).toBe("Last week");
    expect(lastVisitLabel(new Date("2026-10-05T20:00:00"), NOW)).toBe("4 weeks ago");
    expect(lastVisitLabel(new Date("2026-07-01T20:00:00"), NOW)).toBe("4 months ago");
  });
});
