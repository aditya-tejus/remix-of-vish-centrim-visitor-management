import { describe, it, expect } from "vitest";
import {
  buildAccountableRows,
  companionRowsForVisitor,
  primaryRowForVisitor,
  type PartyLike,
} from "@/lib/accountablePeople";
import type { Visitor } from "@/types/visitor";

const baseVisitor = (over: Partial<Visitor>): Visitor =>
  ({
    id: "v1",
    firstName: "Ann",
    surname: "Lee",
    email: "",
    mobile: "",
    type: "visitor",
    checkInTime: new Date("2026-01-05T09:00:00Z"),
    checkOutTime: null,
    status: "checked-in",
    additionalVisitors: 0,
    companionDetails: [],
    retentionExpiry: new Date("2027-01-05T09:00:00Z"),
    ...over,
  }) as unknown as Visitor;

const party = (over: Partial<PartyLike>): PartyLike => ({
  id: "p1",
  visitId: "vis1",
  legacyVisitorId: "v1",
  personId: "per1",
  displayName: "Ann Lee",
  relationship: null,
  isPrimary: true,
  companionIndex: 0,
  nameStatus: "named",
  checkInTime: new Date("2026-01-05T09:00:00Z"),
  checkOutTime: null,
  branchId: "siteA",
  ...over,
});

describe("accountable people", () => {
  it("keeps two blank-contact arrivals as two separate rows", () => {
    const a = baseVisitor({ id: "v1", firstName: "Jo", surname: "Smith" });
    const b = baseVisitor({ id: "v2", firstName: "Jo", surname: "Smith" });
    const rows = buildAccountableRows([a, b], []);
    expect(rows).toHaveLength(2);
    expect(rows[0].visitorId).toBe("v1");
    expect(rows[1].visitorId).toBe("v2");
  });

  it("lists a primary plus each companion from attendance records", () => {
    const v = baseVisitor({ additionalVisitors: 2 });
    const parties = [
      party({ id: "p1", isPrimary: true, companionIndex: 0 }),
      party({ id: "p2", isPrimary: false, companionIndex: 1, displayName: "Bob Lee" }),
      party({ id: "p3", isPrimary: false, companionIndex: 2, nameStatus: "unresolved", displayName: "" }),
    ];
    const rows = buildAccountableRows([v], parties);
    expect(rows.map((r) => r.role)).toEqual(["primary", "companion", "companion"]);
    expect(rows[1].name).toBe("Bob Lee");
    expect(rows[1].withPrimaryName).toBe("Ann Lee");
    expect(rows[2].nameKnown).toBe(false);
    expect(rows.every((r) => r.source === "canonical")).toBe(true);
  });

  it("treats a companion sign-out on its own, leaving the primary on site", () => {
    const v = baseVisitor({ additionalVisitors: 1 });
    const parties = [
      party({ id: "p1", isPrimary: true }),
      party({
        id: "p2",
        isPrimary: false,
        companionIndex: 1,
        displayName: "Bob Lee",
        checkOutTime: new Date("2026-01-05T10:00:00Z"),
      }),
    ];
    const rows = buildAccountableRows([v], parties);
    expect(rows[0].status).toBe("checked-in");
    expect(rows[1].status).toBe("checked-out");
  });

  it("falls back to the saved record only when there is no attendance record", () => {
    const legacy = baseVisitor({
      id: "v9",
      additionalVisitors: 2,
      companionDetails: [{ name: "Kim Tan" }],
    });
    const rows = buildAccountableRows([legacy], []);
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.source === "legacy")).toBe(true);
    expect(rows[1].name).toBe("Kim Tan");
    expect(rows[2].nameKnown).toBe(false);
  });

  it("keeps sites apart", () => {
    const v = baseVisitor({});
    const parties = [party({ id: "p1", branchId: "siteB" })];
    expect(buildAccountableRows([v], parties, { siteId: "siteA" })).toHaveLength(0);
    expect(buildAccountableRows([v], parties, { siteId: "siteB" })).toHaveLength(1);
  });

  it("counts one export row per accountable person", () => {
    const v = baseVisitor({ additionalVisitors: 1 });
    const parties = [
      party({ id: "p1", isPrimary: true }),
      party({ id: "p2", isPrimary: false, companionIndex: 1, displayName: "Bob Lee" }),
    ];
    const primary = primaryRowForVisitor(v, parties);
    const companions = companionRowsForVisitor(v, parties);
    expect([primary, ...companions]).toHaveLength(2);
  });

  it("never merges rows that share a name or phone number", () => {
    const a = baseVisitor({ id: "v1", mobile: "0400 000 000" });
    const b = baseVisitor({ id: "v2", mobile: "0400 000 000" });
    const rows = buildAccountableRows([a, b], []);
    expect(new Set(rows.map((r) => r.key)).size).toBe(2);
  });
});
