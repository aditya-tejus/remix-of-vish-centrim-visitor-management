import { describe, it, expect } from "vitest";
import { residentLocation, sameLocalDay, residentLocalInstant, movementTimeZone, independentAbsenceAllowed, absenceReady, assertSavedMovement } from "@/lib/residentMovement";

describe("resident movement evidence and independence", () => {
  it.each(["checked-in", undefined, "unknown"])("legacy %s never establishes presence", savedStatus => expect(residentLocation({savedStatus})).toBe("no-absence"));
  it("retains multi-day absence irrespective of arrival date", () => expect(residentLocation({savedStatus:"checked-out",leaveType:"Holiday"})).toBe("on-leave"));
  it("distinguishes past expected return from unspecified return", () => {
    expect(residentLocation({savedStatus:"checked-out",expectedReturnDate:new Date("2026-10-26T22:00Z")},new Date("2026-10-27T01:00Z"))).toBe("overdue");
    expect(residentLocation({savedStatus:"checked-out"})).toBe("away");
  });
  it("independent AU village report needs no escort, reason or expected return", () => {
    expect(independentAbsenceAllowed("au_rv","short")).toBe(true);
    expect(absenceReady(true,"resident-1","","")).toBe(true);
    expect(absenceReady(true,undefined,"","")).toBe(false);
  });
  it.each(["au_rac","uk_care"])("%s keeps supported leave validations", pack => {
    expect(independentAbsenceAllowed(pack,"short")).toBe(false);
    expect(absenceReady(false,"resident-1","","")).toBe(false);
    expect(absenceReady(false,"resident-1","Appointment","family")).toBe(true);
  });
  it("AU village complex planned support remains separate", () => expect(independentAbsenceAllowed("au_rv","planned")).toBe(false));
  it("uses site dates across midnight, not the browser date", () => {
    expect(sameLocalDay(new Date("2026-10-27T14:00Z"),new Date("2026-10-27T01:00Z"),"Australia/Sydney")).toBe(false);
    expect(sameLocalDay(new Date("2026-10-27T23:30Z"),new Date("2026-10-27T01:00Z"),"Europe/London")).toBe(true);
  });
  it("converts overnight local expected returns precisely", () => expect(residentLocalInstant("2026-10-28T00:30","Australia/Sydney")?.toISOString()).toBe("2026-10-27T13:30:00.000Z"));
  it("rejects nonexistent and ambiguous England clock changes", () => {
    expect(()=>residentLocalInstant("2026-03-29T01:30","Europe/London")).toThrow();
    expect(()=>residentLocalInstant("2026-10-25T01:30","Europe/London")).toThrow();
  });
  it("uses explicit country fallback and accepts optional return", () => {
    expect(movementTimeZone(null,"AU")).toBe("Australia/Sydney");
    expect(movementTimeZone("invalid","UK")).toBe("Europe/London");
    expect(residentLocalInstant("","Australia/Sydney")).toBeUndefined();
  });
  it("rejects false success, other identity, other site and mismatched action", () => {
    const result={saved:true,resident_id:"r",branch_id:"s",movement:"return",status:"checked-in",recorded_time:"2026-10-27T01:00Z"};
    expect(()=>assertSavedMovement(result,"r","s","return")).not.toThrow();
    for(const value of [{...result,saved:false},{...result,resident_id:"other"},{...result,branch_id:"other"},{...result,movement:"leave"},null]) expect(()=>assertSavedMovement(value,"r","s","return")).toThrow();
  });
});