import { describe, it, expect } from "vitest";
import { kioskScreeningOutcome, kioskMustSeeStaff, kioskCheckoutMatches, maskSurname } from "@/lib/kioskPrivacy";

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
