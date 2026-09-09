import { describe, it, expect } from "vitest";
import { evaluateScreening, type ScreeningRuleQuestion } from "@/lib/screeningOutcome";
import { resolveScreeningPolicy, screeningStepApplies, OFF_POLICY } from "@/lib/screeningPolicy";

const q = (over: Partial<ScreeningRuleQuestion>): ScreeningRuleQuestion => ({
  id: "q1",
  question: "Any symptoms?",
  type: "yesno",
  ...over,
});

describe("screening policy", () => {
  it("keeps vaccination off when questions are off", () => {
    expect(
      resolveScreeningPolicy({ screeningApplies: false, vaccinationApplies: true, privacyApplies: true })
    ).toEqual({ screeningEnabled: false, vaccinationEnabled: false, privacyRequired: true });
  });

  it("falls back to everything off with no configuration", () => {
    expect(resolveScreeningPolicy(null)).toEqual(OFF_POLICY);
  });

  it("skips the screening step when nothing is configured", () => {
    const policy = resolveScreeningPolicy({ screeningApplies: true, vaccinationApplies: true, privacyApplies: false });
    expect(screeningStepApplies(policy, { questionCount: 0, vaccinationFieldCount: 0 })).toBe(false);
    expect(screeningStepApplies(policy, { questionCount: 0, vaccinationFieldCount: 2 })).toBe(true);
    expect(screeningStepApplies(OFF_POLICY, { questionCount: 5, vaccinationFieldCount: 5 })).toBe(false);
    expect(screeningStepApplies(OFF_POLICY, { questionCount: 0, vaccinationFieldCount: 0, isContractor: true })).toBe(true);
  });
});

describe("screening outcomes", () => {
  it("is clear when nothing is answered as a concern", () => {
    const r = evaluateScreening([q({})], { q1: false });
    expect(r.outcome).toBe("clear");
    expect(r.flags).toHaveLength(0);
  });

  it("keeps legacy behaviour for questions without rules", () => {
    const r = evaluateScreening([q({})], { q1: true });
    expect(r.outcome).toBe("flagged");
    expect(r.flags[0]).toMatchObject({ questionId: "q1", severity: "warning", action: "flag" });
  });

  it("flags a warning answer with the configured message", () => {
    const r = evaluateScreening(
      [q({ warningAnswers: ["yes"], severity: "warning", outcomeAction: "flag", staffMessage: "Ask them to mask" })],
      { q1: "Yes" }
    );
    expect(r.flagged).toBe(true);
    expect(r.blocked).toBe(false);
    expect(r.flags[0].message).toBe("Ask them to mask");
  });

  it("blocks on a critical rule", () => {
    const r = evaluateScreening(
      [q({ expectedAnswer: "no", severity: "critical", outcomeAction: "block" })],
      { q1: true }
    );
    expect(r.outcome).toBe("blocked");
    expect(r.blocked).toBe(true);
  });

  it("combines several questions and keeps the strongest outcome", () => {
    const r = evaluateScreening(
      [
        q({ id: "a", warningAnswers: ["yes"], outcomeAction: "flag", severity: "warning" }),
        q({ id: "b", expectedAnswer: "no", outcomeAction: "block", severity: "critical" }),
      ],
      { a: true, b: true }
    );
    expect(r.flags).toHaveLength(2);
    expect(r.outcome).toBe("blocked");
  });

  it("ignores unanswered rule questions", () => {
    const r = evaluateScreening([q({ expectedAnswer: "no", outcomeAction: "block" })], {});
    expect(r.outcome).toBe("clear");
  });

  it("records no rule effect when the action is none", () => {
    const r = evaluateScreening([q({ expectedAnswer: "no", outcomeAction: "none" })], { q1: true });
    expect(r.outcome).toBe("clear");
  });

  it("still applies the site temperature threshold", () => {
    const r = evaluateScreening([], {}, { bodyTemperature: 38.4 });
    expect(r.outcome).toBe("flagged");
    expect(r.flags[0].questionId).toBe("body_temperature");
    const ok = evaluateScreening([], {}, { bodyTemperature: 36.9 });
    expect(ok.outcome).toBe("clear");
  });
});
