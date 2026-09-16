import { describe, it, expect } from "vitest";
import {
  AutoCheckoutRule,
  describeRule,
  formatClock,
  isDueForAutoCheckout,
  reasonForRule,
  supportsAutoCheckout,
  defaultRule,
} from "@/lib/autoCheckout";

const base: AutoCheckoutRule = {
  branchId: "site-1",
  personType: "visitor",
  enabled: true,
  mode: "hours",
  hours: 12,
  endOfDayTime: "22:00",
};

const SYD = "Australia/Sydney";
const LON = "Europe/London";

describe("automatic sign-out rules", () => {
  it("never signs anyone out when the rule is off", () => {
    const rule = { ...base, enabled: false };
    const decision = isDueForAutoCheckout({
      rule,
      checkInTime: new Date("2026-09-15T00:00:00Z"),
      now: new Date("2026-09-16T00:00:00Z"),
      timeZone: SYD,
    });
    expect(decision.due).toBe(false);
  });

  it("signs out after the set number of hours", () => {
    const decision = isDueForAutoCheckout({
      rule: base,
      checkInTime: new Date("2026-09-16T00:00:00Z"),
      now: new Date("2026-09-16T12:30:00Z"),
      timeZone: SYD,
    });
    expect(decision).toEqual({ due: true, trigger: "hours" });
  });

  it("leaves a recent arrival alone", () => {
    const decision = isDueForAutoCheckout({
      rule: base,
      checkInTime: new Date("2026-09-16T09:00:00Z"),
      now: new Date("2026-09-16T11:00:00Z"),
      timeZone: SYD,
    });
    expect(decision.due).toBe(false);
  });

  it("uses the site's own clock for end of day", () => {
    const rule: AutoCheckoutRule = { ...base, mode: "end_of_day", endOfDayTime: "22:00" };
    // 13:00 UTC is 23:00 in Sydney (past cutoff) but 14:00 in London (before).
    const now = new Date("2026-09-15T13:00:00Z");
    const checkIn = new Date("2026-09-15T02:00:00Z");
    expect(isDueForAutoCheckout({ rule, checkInTime: checkIn, now, timeZone: SYD }).due).toBe(true);
    expect(isDueForAutoCheckout({ rule, checkInTime: checkIn, now, timeZone: LON }).due).toBe(false);
  });

  it("closes off anyone left over from an earlier day", () => {
    const rule: AutoCheckoutRule = { ...base, mode: "end_of_day" };
    const decision = isDueForAutoCheckout({
      rule,
      checkInTime: new Date("2026-09-14T03:00:00Z"),
      now: new Date("2026-09-16T01:00:00Z"),
      timeZone: LON,
    });
    expect(decision).toEqual({ due: true, trigger: "end_of_day" });
  });

  it("does not sign out someone who arrived after the end-of-day time", () => {
    const rule: AutoCheckoutRule = { ...base, mode: "end_of_day", endOfDayTime: "22:00" };
    // 22:30 London arrival, checked 30 minutes later the same local day.
    const decision = isDueForAutoCheckout({
      rule,
      checkInTime: new Date("2026-01-15T22:30:00Z"),
      now: new Date("2026-01-15T23:00:00Z"),
      timeZone: LON,
    });
    expect(decision.due).toBe(false);
  });

  it("whichever comes first uses the hours rule when it trips earlier", () => {
    const rule: AutoCheckoutRule = { ...base, mode: "either", hours: 4, endOfDayTime: "22:00" };
    const decision = isDueForAutoCheckout({
      rule,
      checkInTime: new Date("2026-01-15T08:00:00Z"),
      now: new Date("2026-01-15T13:00:00Z"),
      timeZone: LON,
    });
    expect(decision).toEqual({ due: true, trigger: "hours" });
  });

  it("excludes residents from having a rule at all", () => {
    expect(supportsAutoCheckout("resident")).toBe(false);
    expect(supportsAutoCheckout("visitor")).toBe(true);
    expect(supportsAutoCheckout("contractor")).toBe(true);
  });

  it("is off by default", () => {
    expect(defaultRule("site-1", "staff").enabled).toBe(false);
  });

  it("writes an honest note on the record", () => {
    expect(reasonForRule(base, "hours")).toBe("Signed out automatically after 12 hours");
    expect(reasonForRule(base, "end_of_day")).toBe(
      "Signed out automatically at end of day (10:00 pm)"
    );
  });

  it("describes the rule in plain language", () => {
    expect(describeRule({ ...base, mode: "either", personType: "contractor" })).toContain(
      "whichever comes first"
    );
    expect(describeRule({ ...base, enabled: false })).toContain("never signed out automatically");
    expect(formatClock("09:05")).toBe("9:05 am");
  });
});
