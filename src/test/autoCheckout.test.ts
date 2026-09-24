import { describe, it, expect } from "vitest";
import {
  AutoCheckoutRule,
  describeRule,
  formatClock,
  isDueForAutoCheckout,
  reasonForRule,
  supportsAutoCheckout,
  defaultRule,
  toWholeHour,
} from "@/lib/autoCheckout";

const base: AutoCheckoutRule = {
  branchId: "site-1",
  personType: "visitor",
  enabled: true,
  endOfDayTime: "22:00",
};

const SYD = "Australia/Sydney";
const LON = "Europe/London";

describe("automatic sign-out rules", () => {
  it("never signs anyone out when the rule is off", () => {
    expect(
      isDueForAutoCheckout({
        rule: { ...base, enabled: false },
        checkInTime: new Date("2026-09-15T00:00:00Z"),
        now: new Date("2026-09-16T00:00:00Z"),
        timeZone: SYD,
      }).due
    ).toBe(false);
  });

  it("uses the site's own clock for the closing time", () => {
    // 13:00 UTC is 23:00 in Sydney (past 10 pm) but 14:00 in London (before).
    const now = new Date("2026-09-15T13:00:00Z");
    const checkIn = new Date("2026-09-15T02:00:00Z");
    expect(isDueForAutoCheckout({ rule: base, checkInTime: checkIn, now, timeZone: SYD }).due).toBe(true);
    expect(isDueForAutoCheckout({ rule: base, checkInTime: checkIn, now, timeZone: LON }).due).toBe(false);
  });

  it("leaves someone alone before the closing time", () => {
    expect(
      isDueForAutoCheckout({
        rule: { ...base, endOfDayTime: "20:00" },
        checkInTime: new Date("2026-09-16T09:00:00Z"),
        now: new Date("2026-09-16T11:00:00Z"),
        timeZone: LON,
      }).due
    ).toBe(false);
  });

  it("closes off anyone left over from an earlier day", () => {
    expect(
      isDueForAutoCheckout({
        rule: base,
        checkInTime: new Date("2026-09-14T03:00:00Z"),
        now: new Date("2026-09-16T01:00:00Z"),
        timeZone: LON,
      }).due
    ).toBe(true);
  });

  it("does not sign out someone who arrived after the closing time", () => {
    expect(
      isDueForAutoCheckout({
        rule: base,
        checkInTime: new Date("2026-01-15T22:30:00Z"),
        now: new Date("2026-01-15T23:00:00Z"),
        timeZone: LON,
      }).due
    ).toBe(false);
  });

  it("excludes residents from having a rule at all", () => {
    expect(supportsAutoCheckout("resident")).toBe(false);
    expect(supportsAutoCheckout("visitor")).toBe(true);
    expect(supportsAutoCheckout("contractor")).toBe(true);
  });

  it("is off by default and closes at 10:00 pm", () => {
    expect(defaultRule("site-1", "staff").enabled).toBe(false);
    expect(defaultRule("site-1", "staff").endOfDayTime).toBe("22:00");
  });

  it("rounds any stored time down to the hour", () => {
    expect(toWholeHour("22:45")).toBe("22:00");
    expect(toWholeHour("09:00")).toBe("09:00");
    expect(toWholeHour("")).toBe("22:00");
  });

  it("writes an honest note on the record", () => {
    expect(reasonForRule(base)).toBe("Signed out automatically at end of day (10:00 pm)");
  });

  it("describes the rule in plain language", () => {
    expect(describeRule({ ...base, personType: "contractor" })).toBe(
      "Contractors still signed in at 10:00 pm are signed out automatically."
    );
    expect(describeRule({ ...base, enabled: false })).toContain("never signed out automatically");
    expect(formatClock("09:00")).toBe("9:00 am");
  });
});
