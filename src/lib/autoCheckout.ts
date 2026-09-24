/**
 * Automatic sign-out rules (pure logic, no data access).
 *
 * A site chooses one closing time. Anyone of that person type still signed in
 * at that time, in the site's own local clock, is signed out. Residents are
 * never included — living on site is not an overstay.
 */

/** Kept for the stored column; only one rule shape is offered now. */
export type AutoCheckoutMode = "end_of_day";

/** Person types a rule may be set for. Residents are deliberately absent. */
export const AUTO_CHECKOUT_PERSON_TYPES = ["visitor", "contractor", "volunteer", "staff"] as const;
export type AutoCheckoutPersonType = (typeof AUTO_CHECKOUT_PERSON_TYPES)[number];

export interface AutoCheckoutRule {
  branchId: string;
  personType: AutoCheckoutPersonType;
  enabled: boolean;
  /** "HH:MM" on the hour, in the site's own local time. */
  endOfDayTime: string;
}

/** Whole-hour closing times, so the hourly check acts within minutes. */
export const END_OF_DAY_CHOICES = [
  "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00", "23:00",
] as const;

/** Rounds any stored time down to the hour. */
export function toWholeHour(hhmm: string): string {
  const h = parseInt((hhmm || "").split(":")[0], 10);
  if (Number.isNaN(h)) return "22:00";
  return `${String(Math.min(Math.max(h, 0), 23)).padStart(2, "0")}:00`;
}

export function defaultRule(branchId: string, personType: AutoCheckoutPersonType): AutoCheckoutRule {
  return { branchId, personType, enabled: false, endOfDayTime: "22:00" };
}

export function supportsAutoCheckout(personType: string): personType is AutoCheckoutPersonType {
  return (AUTO_CHECKOUT_PERSON_TYPES as readonly string[]).includes(personType);
}

/** "22:00" -> "10:00 pm", for plain-language summaries. */
export function formatClock(hhmm: string): string {
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const suffix = h >= 12 ? "pm" : "am";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
}

const PLURAL: Record<AutoCheckoutPersonType, string> = {
  visitor: "Visitors",
  contractor: "Contractors",
  volunteer: "Volunteers",
  staff: "Staff",
};

/** One sentence describing exactly what the rule will do. */
export function describeRule(rule: AutoCheckoutRule): string {
  const who = PLURAL[rule.personType];
  if (!rule.enabled) return `${who} are never signed out automatically. Reception signs everyone out.`;
  return `${who} still signed in at ${formatClock(rule.endOfDayTime)} are signed out automatically.`;
}

/** Short note stored on the record so staff can see which rule closed the visit. */
export function reasonForRule(rule: AutoCheckoutRule): string {
  return `Signed out automatically at end of day (${formatClock(rule.endOfDayTime)})`;
}

/** Local wall-clock time at a site, as minutes past midnight. */
export function siteMinutesOfDay(now: Date, timeZone: string): number {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(now);
    const h = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
    const m = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
    return h * 60 + m;
  } catch {
    return now.getUTCHours() * 60 + now.getUTCMinutes();
  }
}

function clockMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10));
  return (Number.isNaN(h) ? 22 : h) * 60 + (Number.isNaN(m) ? 0 : m);
}

export interface DueDecision {
  due: boolean;
}

/**
 * Decides whether someone still signed in should now be signed out.
 *
 * The comparison uses the site's own local clock, so an Australian and a UK
 * site each close off at their own closing time.
 */
export function isDueForAutoCheckout(params: {
  rule: AutoCheckoutRule;
  checkInTime: Date;
  now: Date;
  timeZone: string;
}): DueDecision {
  const { rule, checkInTime, now, timeZone } = params;
  if (!rule.enabled) return { due: false };

  const nowMinutes = siteMinutesOfDay(now, timeZone);
  const cutoff = clockMinutes(rule.endOfDayTime);
  const checkInMinutes = siteMinutesOfDay(checkInTime, timeZone);
  const sameLocalDay = siteDateKey(checkInTime, timeZone) === siteDateKey(now, timeZone);

  // Past the closing time today, and they arrived before it (or on an earlier day).
  if (nowMinutes >= cutoff && (!sameLocalDay || checkInMinutes < cutoff)) return { due: true };
  // Left over from an earlier local day — that day's closing time has passed.
  if (!sameLocalDay) return { due: true };

  return { due: false };
}

/** "YYYY-MM-DD" at the site's own local date. */
export function siteDateKey(at: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(at);
  } catch {
    return at.toISOString().slice(0, 10);
  }
}
