/**
 * Configurable check-in question outcomes.
 *
 * Each question may carry an expected answer, one or more warning answers, a
 * severity, a staff-facing message and an action. Questions without rules keep
 * today's behaviour, so existing configuration is unaffected.
 */

export type ScreeningSeverity = "info" | "warning" | "critical";
export type ScreeningAction = "none" | "flag" | "block";
export type ScreeningOutcome = "clear" | "flagged" | "blocked";

export interface ScreeningRuleQuestion {
  id: string;
  question: string;
  type: string;
  expectedAnswer?: string | null;
  warningAnswers?: string[] | null;
  severity?: ScreeningSeverity | null;
  staffMessage?: string | null;
  outcomeAction?: ScreeningAction | null;
}

export interface ScreeningFlag {
  questionId: string;
  severity: ScreeningSeverity;
  action: Exclude<ScreeningAction, "none">;
  /** Short staff-facing wording; never the raw answer. */
  message: string;
}

export interface ScreeningEvaluation {
  outcome: ScreeningOutcome;
  flags: ScreeningFlag[];
  blocked: boolean;
  flagged: boolean;
}

const norm = (v: unknown): string => {
  if (v === true) return "yes";
  if (v === false) return "no";
  if (v === null || v === undefined) return "";
  return String(v).trim().toLowerCase();
};

/** A question has rules when an expected answer or warning answers are set. */
export function hasRules(q: ScreeningRuleQuestion): boolean {
  return !!(q.expectedAnswer && q.expectedAnswer.trim()) || (q.warningAnswers?.length ?? 0) > 0;
}

/**
 * Legacy behaviour for questions with no rules: a "yes" on a yes/no question is
 * treated as a concern for staff, exactly as before.
 */
function legacyConcern(q: ScreeningRuleQuestion, answer: unknown): boolean {
  return q.type === "yesno" && norm(answer) === "yes";
}

export function evaluateScreening(
  questions: ScreeningRuleQuestion[],
  answers: Record<string, unknown>,
  opts: { bodyTemperature?: number | null; temperatureThreshold?: number } = {}
): ScreeningEvaluation {
  const flags: ScreeningFlag[] = [];

  for (const q of questions) {
    const answer = answers?.[q.id];
    const value = norm(answer);
    const action: ScreeningAction = q.outcomeAction || "none";
    const severity: ScreeningSeverity = q.severity || "info";

    if (!hasRules(q)) {
      if (legacyConcern(q, answer)) {
        flags.push({
          questionId: q.id,
          severity: "warning",
          action: "flag",
          message: q.staffMessage?.trim() || q.question,
        });
      }
      continue;
    }

    if (value === "") continue; // unanswered questions are handled by requiredness

    const warnings = (q.warningAnswers || []).map(norm).filter(Boolean);
    const expected = norm(q.expectedAnswer);
    const isWarning = warnings.length > 0
      ? warnings.includes(value)
      : expected !== "" && value !== expected;

    if (!isWarning || action === "none") continue;

    flags.push({
      questionId: q.id,
      severity,
      action,
      message: q.staffMessage?.trim() || q.question,
    });
  }

  // The site's temperature threshold is unchanged and still applies.
  const threshold = opts.temperatureThreshold ?? 37.8;
  if (typeof opts.bodyTemperature === "number" && opts.bodyTemperature > threshold) {
    flags.push({
      questionId: "body_temperature",
      severity: "warning",
      action: "flag",
      message: `Temperature above ${threshold}\u00b0C`,
    });
  }

  const blocked = flags.some((f) => f.action === "block");
  const flagged = flags.length > 0;
  return {
    outcome: blocked ? "blocked" : flagged ? "flagged" : "clear",
    flags,
    blocked,
    flagged,
  };
}

export const outcomeLabel: Record<ScreeningOutcome, string> = {
  clear: "No concerns recorded",
  flagged: "Needs staff attention",
  blocked: "Sign-in blocked",
};
