import { describe, it, expect } from "vitest";
import { buildHandover, escapeHtml, handoverPrintHtml, handoverType, type HandoverType } from "@/lib/handover";
import type { Visitor } from "@/types/visitor";

let n = 0;
const v = (p: Partial<Visitor>): Visitor => ({
  id: `v${++n}`, firstName: "A", surname: "B", email: "", mobile: "", type: "visitor",
  checkInTime: new Date("2026-11-02T09:00:00"), checkOutTime: null, whomToVisit: "", address: "", status: "checked-in",
  healthDeclaration: false, additionalVisitors: 0, comments: "", retentionExpiry: new Date(), acknowledgedPrivacy: true, ...p,
} as Visitor);

const now = new Date("2026-11-02T15:00:00");
const all = new Set<HandoverType>(["visitor", "contractor", "volunteer", "staff", "other"]);

describe("shift handover", () => {
  const people = [
    v({ id: "late", checkInTime: new Date("2026-11-02T13:00:00") }),
    v({ id: "early", checkInTime: new Date("2026-11-02T08:00:00"), type: "contractor" }),
    v({ id: "yday", checkInTime: new Date("2026-11-01T18:00:00"), type: "volunteer" }),
    v({ id: "custom", type: "hairdresser" as Visitor["type"] }),
    v({ id: "gone", status: "checked-out", checkOutTime: new Date("2026-11-02T10:00:00") }),
    v({ id: "res", type: "resident" }),
  ];
  const base = { people, date: now, residents: [], keys: [], types: all, includeSignedOut: true, isPastExpected: () => false, now };

  it("lists everyone still on site, longest first, including earlier days, volunteers and custom types", () => {
    const h = buildHandover(base);
    expect(h.onSite.map((x) => x.visit.id)).toEqual(["yday", "early", "custom", "late"]);
    expect(h.onSite.find((x) => x.visit.id === "yday")!.fromEarlierDay).toBe(true);
    expect(handoverType("hairdresser")).toBe("other");
    expect(h.counts).toEqual({ visitor: 1, contractor: 1, volunteer: 1, staff: 0, other: 1 });
    expect(h.signedOut.map((x) => x.id)).toEqual(["gone"]);
  });

  it("filters by type but keeps the full counts for the chips", () => {
    const h = buildHandover({ ...base, types: new Set<HandoverType>(["contractor"]), includeSignedOut: false });
    expect(h.onSite.map((x) => x.visit.id)).toEqual(["early"]);
    expect(h.signedOut).toEqual([]);
    expect(h.counts.visitor).toBe(1);
  });

  it("flags residents overdue back and attaches keys to the person holding them", () => {
    const h = buildHandover({
      ...base,
      residents: [
        { visitorId: "r1", name: "Ruth Ng", room: "Room 4", savedStatus: "checked-out", expectedReturnDate: new Date("2026-11-02T17:00:00") },
        { visitorId: "r2", name: "Ida Fox", room: "Room 9", savedStatus: "checked-out", expectedReturnDate: new Date("2026-11-02T14:00:00") },
        { visitorId: "r3", name: "Al Day", room: "Room 2", savedStatus: "checked-in" },
      ],
      keys: [
        { id: "k1", keyLabel: "Plant room", issuedToName: "A B", visitorId: "early", issuedAt: new Date("2026-11-02T08:05:00"), overdue: false },
        { id: "k2", keyLabel: "Room 4 fob", issuedToName: "Ruth Ng", visitorId: "r1", issuedAt: new Date("2026-09-01T10:00:00"), overdue: false, isPermanent: true },
      ],
    });
    expect(h.residentsOut.map((r) => [r.name, r.overdue])).toEqual([["Ida Fox", true], ["Ruth Ng", false]]);
    expect(h.onSite.find((x) => x.visit.id === "early")!.keys).toEqual(["Plant room"]);
    expect(h.keysOut).toHaveLength(1);
  });

  it("escapes names and notes in the printed page", () => {
    expect(escapeHtml(`<img src=x onerror="a">`)).toBe("&lt;img src=x onerror=&quot;a&quot;&gt;");
    const h = buildHandover({ ...base, people: [v({ firstName: "<script>alert(1)</script>" })] });
    const html = handoverPrintHtml(h, { siteName: "Site", date: now, now, notes: "<b>hi</b>", includeSignedOut: true });
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;b&gt;hi&lt;/b&gt;");
  });
});
