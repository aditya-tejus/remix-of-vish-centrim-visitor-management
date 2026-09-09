import { describe, it, expect } from "vitest";
import {
  buildAttentionItems,
  splitDetails,
  describeRelationship,
  summariseCredentials,
  keysForPerson,
  foodForPerson,
  historyPage,
} from "@/lib/profileSections";
import { buildAccountableRows } from "@/lib/accountablePeople";
import type { Visitor } from "@/types/visitor";
import type { CheckInFieldSpec } from "@/lib/checkInFields";

function visitor(over: Partial<Visitor> = {}): Visitor {
  return {
    id: "v1",
    firstName: "Adam",
    surname: "John",
    email: "",
    mobile: "",
    type: "visitor",
    checkInTime: new Date("2026-09-09T09:00:00Z"),
    checkOutTime: null,
    whomToVisit: "Mary Smith",
    address: "",
    status: "checked-in",
    healthDeclaration: true,
    additionalVisitors: 0,
    comments: "",
    retentionExpiry: new Date("2026-12-09T09:00:00Z"),
    acknowledgedPrivacy: true,
    ...over,
  } as Visitor;
}

function spec(over: Partial<CheckInFieldSpec>): CheckInFieldSpec {
  return {
    id: over.valueKey || "f",
    fieldKey: over.fieldKey || "mobile",
    valueKey: over.valueKey || "mobile",
    label: over.label || "Mobile",
    type: "text",
    required: false,
    editable: true,
    help: null,
    core: false,
    sortOrder: 1,
    ...over,
  } as CheckInFieldSpec;
}

describe("attention strip", () => {
  it("says nothing when nothing needs attention", () => {
    expect(buildAttentionItems({})).toEqual([]);
  });

  it("shows a screening warning in words", () => {
    const items = buildAttentionItems({ screeningOutcome: "flagged", screeningFlagCount: 2 });
    expect(items[0].label).toBe("Warning");
    expect(items[0].tone).toBe("warning");
    expect(items[0].detail).toContain("2 concerns");
  });

  it("shows a screening block as critical and labelled Blocked", () => {
    const items = buildAttentionItems({ screeningOutcome: "blocked" });
    expect(items[0]).toMatchObject({ label: "Blocked", tone: "critical" });
  });

  it("raises restricted access above a soft watchlist note", () => {
    const hard = buildAttentionItems({ watchlist: { alert_type: "hard", reason: "Barred" } });
    expect(hard[0]).toMatchObject({ label: "Access restricted", tone: "critical" });
    const soft = buildAttentionItems({ watchlist: { alert_type: "soft", reason: "Check first" } });
    expect(soft[0]).toMatchObject({ label: "Watchlist", tone: "warning" });
  });

  it("flags overdue keys and outstanding contractor documents", () => {
    const items = buildAttentionItems({
      keys: [{ id: "k1", keyLabel: "Fob 12", propertyLabel: "Villa 3", overdue: true }],
      outstandingCredentials: ["Insurance"],
    });
    expect(items.map((i) => i.label)).toEqual(["Key overdue", "Documents outstanding"]);
    expect(items[1].detail).toContain("Insurance");
  });
});

describe("details follow field configuration", () => {
  it("shows only configured fields and hides values for switched-off fields", () => {
    const v = visitor({ mobile: "0400 000 000", address: "12 Long Road", email: "a@b.co" });
    const specs = [spec({ valueKey: "mobile", label: "Mobile" })];
    const { active, historic } = splitDetails(v, specs);
    expect(active.map((a) => a.valueKey)).toEqual(["mobile"]);
    expect(historic.map((h) => h.valueKey).sort()).toEqual(["address", "email"]);
  });

  it("keeps blank values out of both lists", () => {
    const v = visitor();
    const { active, historic } = splitDetails(v, [spec({ valueKey: "mobile" })]);
    expect(active).toEqual([]);
    expect(historic).toEqual([]);
  });
});

describe("relationship", () => {
  it("labels a companion with who they arrived with", () => {
    expect(describeRelationship({ role: "companion", withPrimaryName: "Adam John" })).toBe("With Adam John");
    expect(describeRelationship({ role: "primary", withPrimaryName: null })).toBeNull();
  });
});

describe("profile shapes from canonical attendance", () => {
  const parties = [
    {
      id: "p1", visitId: "vis1", legacyVisitorId: "v1", personId: "per1", displayName: "Adam John",
      relationship: null, isPrimary: true, companionIndex: 0, nameStatus: "named",
      checkInTime: new Date("2026-09-09T09:00:00Z"), checkOutTime: null, branchId: "site-a",
    },
    {
      id: "p2", visitId: "vis1", legacyVisitorId: "v1", personId: null, displayName: "",
      relationship: "Daughter", isPrimary: false, companionIndex: 1, nameStatus: "unresolved",
      checkInTime: new Date("2026-09-09T09:00:00Z"), checkOutTime: new Date("2026-09-09T10:00:00Z"),
      branchId: "site-a",
    },
  ];

  it("gives a visitor and a companion their own profile rows", () => {
    const rows = buildAccountableRows([visitor()], parties, { siteId: "site-a" });
    expect(rows).toHaveLength(2);
    expect(describeRelationship(rows[1])).toBe("With Adam John");
    expect(rows[0].status).toBe("checked-in");
    expect(rows[1].status).toBe("checked-out");
    expect(rows[1].nameKnown).toBe(false);
  });

  it("never shows another site's people", () => {
    expect(buildAccountableRows([visitor()], parties, { siteId: "site-b" })).toHaveLength(0);
  });

  it("marks a record with no attendance as legacy", () => {
    const rows = buildAccountableRows([visitor({ additionalVisitors: 1 })], [], { siteId: null });
    expect(rows.every((r) => r.source === "legacy")).toBe(true);
    expect(rows).toHaveLength(2);
  });

  it("keeps two people with no contact details apart", () => {
    const a = visitor({ id: "a", firstName: "Pat", surname: "Ng" });
    const b = visitor({ id: "b", firstName: "Pat", surname: "Ng" });
    expect(buildAccountableRows([a, b], [], {})).toHaveLength(2);
  });
});

describe("contractor credentials, read only", () => {
  it("describes each state in words and lists what is outstanding", () => {
    const { lines, outstanding } = summariseCredentials([
      { key: "dbs", label: "DBS", state: "valid" },
      { key: "ins", label: "Insurance", state: "expired" },
      { key: "swms", label: "SWMS", state: "missing" },
      { key: "pol", label: "Police check", state: "pending" },
    ]);
    expect(lines.map((l) => l.statusText)).toEqual([
      "Current", "Expired", "Not on file", "Awaiting confirmation",
    ]);
    expect(outstanding).toEqual(["Insurance", "SWMS", "Police check"]);
  });

  it("returns nothing outstanding when documents are current", () => {
    const { outstanding } = summariseCredentials([{ key: "dbs", label: "DBS", state: "valid" }]);
    expect(outstanding).toEqual([]);
  });
});

describe("keys and food context", () => {
  it("only counts keys tied to this person's own arrivals", () => {
    const issues = [{ visitorId: "v1" }, { visitorId: "other" }, { visitorId: null }];
    expect(keysForPerson(issues, new Set(["v1"]))).toEqual([{ visitorId: "v1" }]);
  });

  it("matches food brought in by this person and food recorded for them", () => {
    const records = [
      { id: "f1", broughtByName: "Adam John" },
      { id: "f2", residentVisitorId: "v1" },
      { id: "f3", broughtByName: "Someone Else" },
    ];
    const hits = foodForPerson(records, { visitorId: "v1", fullName: "Adam John" });
    expect(hits.map((h) => h.id)).toEqual(["f1", "f2"]);
  });
});

describe("history paging", () => {
  it("shows a page and reports what is left", () => {
    const entries = Array.from({ length: 25 }, (_, i) => i);
    const { rows, remaining } = historyPage(entries, 20);
    expect(rows).toHaveLength(20);
    expect(remaining).toBe(5);
  });
});
