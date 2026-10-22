import { describe, it, expect } from "vitest";
import { kioskScreeningOutcome, kioskMustSeeStaff, kioskCheckoutMatches, maskSurname, returningVisitorDetails } from "@/lib/kioskPrivacy";

describe("kiosk screening outcome", () => {
  it("outbreak plus a flagged answer refers to staff, it does not block", () => {
    expect(kioskScreeningOutcome({ ruleBlocked: false, flagged: true, outbreakMode: true })).toBe("refer_to_staff");
  });
  it("only a configured blocking rule blocks", () => {
    expect(kioskScreeningOutcome({ ruleBlocked: true, flagged: true, outbreakMode: false })).toBe("blocked");
  });
  it("flagged without outbreak lets the person continue", () => {
    const o = kioskScreeningOutcome({ ruleBlocked: false, flagged: true, outbreakMode: false });
    expect(o).toBe("flagged");
    expect(kioskMustSeeStaff(o)).toBe(false);
  });
  it("clear answers during an outbreak are not stopped", () => {
    expect(kioskScreeningOutcome({ ruleBlocked: false, flagged: false, outbreakMode: true })).toBe("clear");
  });
});

describe("kiosk sign-out list", () => {
  const people = [
    { firstName: "Mary", surname: "Jones" },
    { firstName: "Marcus", surname: "Lee" },
    { firstName: "Ann", surname: "Martin" },
  ];
  it("lists nobody until two letters are typed", () => {
    expect(kioskCheckoutMatches(people, "")).toEqual([]);
    expect(kioskCheckoutMatches(people, "m")).toEqual([]);
  });
  it("matches on first name or surname start", () => {
    expect(kioskCheckoutMatches(people, "ma").length).toBe(3);
    expect(kioskCheckoutMatches(people, "jon")).toEqual([people[0]]);
  });
  it("shows surname as an initial", () => {
    expect(maskSurname("Mary", "Jones")).toBe("Mary J.");
  });
});

describe("returning visitor privacy", () => {
  const record = { first_name: "Mary", surname: "Jones", email: "mary@example.invalid", mobile: "0400000000", address: "Private address", whom_to_visit: "Resident", visited_resident_ids: ["resident-id"], person_qr: "ABC123DEF456", last_visit: "2026-10-22" };
  it("does not populate private details for name-only results", () => {
    const result = returningVisitorDetails({ ...record, identity_verified: false });
    expect([result.email, result.mobile, result.address, result.whomToVisit]).toEqual(["", "", "", ""]);
    expect([result.personQr, result.lastResidentId, result.lastVisit]).toEqual([null, null, null]);
  });
  it("requires an explicit server-verified match", () => {
    expect(returningVisitorDetails(record).personQr).toBeNull();
  });
  it("retains saved details after a matching mobile or card", () => {
    const result = returningVisitorDetails({ ...record, identity_verified: true });
    expect(result.email).toBe("mary@example.invalid");
    expect(result.personQr).toBe("ABC123DEF456");
    expect(result.lastResidentId).toBe("resident-id");
  });
});
