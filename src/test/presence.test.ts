import { describe, it, expect } from "vitest";
import { destinationFor, residentsDue, shortcutAllowed, stayLabel, expectedOutBy } from "@/lib/presence";
import type { Visitor } from "@/types/visitor";

let n = 0;
const v = (p: Partial<Visitor>): Visitor => ({
  id: `p${++n}`, firstName: "A", surname: "B", email: "", mobile: "", type: "visitor",
  checkInTime: new Date("2026-11-02T09:00:00"), checkOutTime: null, whomToVisit: "", address: "", status: "checked-in",
  healthDeclaration: false, additionalVisitors: 0, comments: "", retentionExpiry: new Date(), acknowledgedPrivacy: true, ...p,
} as Visitor);

const now = new Date("2026-11-02T15:00:00");

describe("on site and today", () => {
  const residents = [
    v({ id: "late", type: "resident", status: "checked-out", expectedReturnDate: new Date("2026-11-01T13:30:00") }),
    v({ id: "soon", type: "resident", status: "checked-out", expectedReturnDate: new Date("2026-11-02T17:00:00") }),
    v({ id: "tmrw", type: "resident", status: "checked-out", expectedReturnDate: new Date("2026-11-03T10:00:00") }),
    v({ id: "home", type: "resident", status: "checked-in", expectedReturnDate: new Date("2026-11-01T10:00:00") }),
  ];

  it("lists residents due back today, overdue ones from earlier days first", () => {
    expect(residentsDue(residents, now, now).map((r) => r.id)).toEqual(["late", "soon"]);
  });

  it("lists only that day's returns for another day", () => {
    expect(residentsDue(residents, new Date("2026-11-03T08:00:00"), now).map((r) => r.id)).toEqual(["tmrw"]);
  });

  it("never doubles the room label and hides names when the site asks", () => {
    const res = [{ visitorId: "r1", name: "Harold Fraser", room: "Room W03", wing: "Waratah" }];
    expect(destinationFor({ whomToVisit: "harold fraser" }, res, { showDestination: true, areaLabel: "Wing" }))
      .toEqual({ primary: "Harold Fraser", secondary: "Room W03 · Waratah", residentId: "r1" });
    expect(destinationFor({ whomToVisit: "Maintenance" }, res, { showDestination: true, areaLabel: "Wing" }))
      .toEqual({ primary: "Maintenance" });
    expect(destinationFor({ whomToVisit: "", visitedResidentIds: ["r1"] }, res, { showDestination: false, areaLabel: "Wing" })!.primary)
      .toBe("Wing Waratah");
    expect(destinationFor({ whomToVisit: "" }, res, { showDestination: true, areaLabel: "Wing" })).toBeNull();
  });

  it("describes time on site and the expected leaving time", () => {
    expect(stayLabel(new Date("2026-11-02T14:15:00"), null, now)).toBe("45 min");
    expect(stayLabel(new Date("2026-11-02T11:40:00"), null, now)).toBe("3 h 20 min");
    expect(expectedOutBy({ checkInTime: new Date("2026-11-02T09:00:00") }, 8).getHours()).toBe(17);
  });

  it("ignores shortcuts while typing or while a dialog is open", () => {
    const input = document.createElement("input");
    expect(shortcutAllowed(input)).toBe(false);
    expect(shortcutAllowed(document.body)).toBe(true);
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog"); dialog.setAttribute("data-state", "open");
    document.body.appendChild(dialog);
    expect(shortcutAllowed(document.body)).toBe(false);
    dialog.remove();
  });
});
