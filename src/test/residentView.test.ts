import { describe, it, expect } from "vitest";
import { humanise, placeLabel, wingCounts, matchesResident, inView, sortResidents, movementLabel } from "@/lib/residentView";
import type { Resident } from "@/hooks/useResidents";

const r = (p: Partial<Resident>): Resident => ({
  id: p.visitorId ?? "x", visitorId: "x", firstName: "A", surname: "B", name: "A B", room: "Room 1", wing: "Wattle", wingId: null,
  careLevel: "standard", keyWorker: null, photoUrl: null, emergencyContactName: null, emergencyContactPhone: null, mobilityLevel: "",
  dolsLpsFlag: false, riskAssessmentLevel: "standard", medicationNotes: null, mobilityAids: [], notes: null, email: "", mobile: "", ...p,
});

const tz = "Australia/Sydney";
const now = new Date("2026-11-02T05:00:00Z"); // 4:00 PM in Sydney

describe("residents page rules", () => {
  it("writes stored values as plain words", () => {
    expect(humanise("needs_two_carers")).toBe("Needs two carers");
    expect(humanise("WALKING FRAME")).toBe("Walking frame");
    expect(humanise(null)).toBe("");
    expect(placeLabel("Room W05", "Villa")).toBe("Villa W05");
    expect(placeLabel("", "Room")).toBe("Room not recorded");
  });

  it("counts wings and searches name, room, wing and key worker", () => {
    expect(wingCounts([r({ wing: "Wattle" }), r({ wing: "Banksia" }), r({ wing: "Wattle" }), r({ wing: "" })]))
      .toEqual([{ wing: "Banksia", count: 1 }, { wing: "Wattle", count: 2 }]);
    expect(matchesResident(r({ name: "Ruth Ng", keyWorker: "Noah Chen" }), "noah")).toBe(true);
    expect(matchesResident(r({ name: "Ruth Ng" }), "zz")).toBe(false);
  });

  it("puts residents in the right view, overdue returns counted as due back", () => {
    const overdue = r({ visitorId: "o", name: "O", savedStatus: "checked-out", expectedReturnDate: new Date("2026-11-01T08:00:00Z") });
    const today = r({ visitorId: "t", name: "T", savedStatus: "checked-out", expectedReturnDate: new Date("2026-11-02T08:00:00Z") });
    const later = r({ visitorId: "l", name: "L", savedStatus: "checked-out", expectedReturnDate: new Date("2026-11-04T08:00:00Z") });
    const home = r({ visitorId: "h", name: "H", savedStatus: "checked-in" });
    const all = [later, home, today, overdue];
    expect(all.filter((x) => inView(x, "away", now, tz)).map((x) => x.visitorId)).toEqual(["l", "t", "o"]);
    expect(all.filter((x) => inView(x, "expected", now, tz)).map((x) => x.visitorId)).toEqual(["t", "o"]);
    expect(all.filter((x) => inView(x, "no-absence", now, tz)).map((x) => x.visitorId)).toEqual(["h"]);
    expect(sortResidents(all, now).map((x) => x.visitorId)).toEqual(["o", "t", "l", "h"]);
  });

  it("shows times in the site's zone, with the day only when it is not today", () => {
    expect(movementLabel(new Date("2026-11-02T08:00:00Z"), tz, now)).toBe("7:00 PM");
    expect(movementLabel(new Date("2026-11-01T08:00:00Z"), tz, now)).toBe("Sun 1 Nov, 7:00 PM");
  });
});
