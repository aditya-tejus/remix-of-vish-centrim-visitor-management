/**
 * Automatic sign-out rules (pure logic, no data access).
 *
 * A site can decide that people who forget to sign out are closed off either
 * after a set number of hours, at an end-of-day time in the site's own local
 * time, or whichever of the two comes first. Residents are never included —
 * living on site is not an overstay.
 */

export type AutoCheckoutMode = "hours" | "end_of_day" | "either";

/** Person types a rule may be set for. Residents are deliberately absent. */
export const AUTO_CHECKOUT_PERSON_TYPES = ["visitor", "contractor", "volunteer", "staff"] as const;
export type AutoCheckoutPersonType = (typeof AUTO_CHECKOUT_PERSON_TYPES)[number];

export interface AutoCheckoutRule {
  branchId: string;
  personType: AutoCheckoutPersonType;
  enabled: boolean;
  mode: AutoCheckoutMode;
  /** Whole hours on site before an automatic sign-out. */
  hours: number;
  /** "HH:MM" in the site's own local time. */
  endOfDayTime: string;
}

export const HOUR_CHOICES = [4, 8, 12, 24] as const;

export function defaultRule(branchId: string, personType: AutoCheckoutPersonType): AutoCheckoutRule {
  return { branchId, personType, enabled: false, mode: "hours", hours: 12, endOfDayTime: "22:00" };
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
  const hoursPart = `still signed in after ${rule.hours} hours`;
  const dayPart = `at ${formatClock(rule.endOfDayTime)} each day`;
  if (rule.mode === "hours") return `${who} ${hoursPart} are signed out automatically.`;
  if (rule.mode === "end_of_day") return `${who} still signed in ${dayPart} are signed out automatically.`;
  return `${who} ${hoursPart}, or ${dayPart}, are signed out automatically — whichever comes first.`;
}

/** Short note stored on the record so staff can see which rule closed the visit. */
export function reasonForRule(rule: AutoCheckoutRule, trigger: "hours" | "end_of_day"): string {
  return trigger === "hours"
    ? `Signed out automatically after ${rule.hours} hours`
    : `Signed out automatically at end of day (${formatClock(rule.endOfDayTime)})`;
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
  trigger?: "hours" | "end_of_day";
}

/**
 * Decides whether someone still signed in should now be signed out.
 *
 * `checkInTime` is absolute; the end-of-day comparison uses the site's own
 * local clock so an Australian and a UK site each close off at their own time.
 */
export function isDueForAutoCheckout(params: {
  rule: AutoCheckoutRule;
  checkInTime: Date;
  now: Date;
  timeZone: string;
}): DueDecision {
  const { rule, checkInTime, now, timeZone } = params;
  if (!rule.enabled) return { due: false };

  const hoursOnSite = (now.getTime() - checkInTime.getTime()) / 3_600_000;
  const hoursDue = (rule.mode === "hours" || rule.mode === "either") && hoursOnSite >= rule.hours;
  if (hoursDue) return { due: true, trigger: "hours" };

  if (rule.mode === "end_of_day" || rule.mode === "either") {
    const nowMinutes = siteMinutesOfDay(now, timeZone);
    const cutoff = clockMinutes(rule.endOfDayTime);
    const checkInMinutes = siteMinutesOfDay(checkInTime, timeZone);
    const sameLocalDay = siteDateKey(checkInTime, timeZone) === siteDateKey(now, timeZone);
    // Past the end-of-day time today, and they arrived before it (or on an earlier day).
    if (nowMinutes >= cutoff && (!sameLocalDay || checkInMinutes < cutoff)) {
      return { due: true, trigger: "end_of_day" };
    }
    // Arrived on an earlier local day and the cutoff has already passed for that day.
    if (!sameLocalDay) return { due: true, trigger: "end_of_day" };
  }

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
