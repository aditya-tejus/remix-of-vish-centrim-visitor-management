/**
 * Automatic sign-out rules — pure logic shared in spirit with src/lib/autoCheckout.ts.
 * Kept as its own copy because edge functions cannot import from the app source.
 */

export type AutoCheckoutMode = "hours" | "end_of_day" | "either";

export interface AutoCheckoutRule {
  branchId: string;
  personType: string;
  enabled: boolean;
  mode: AutoCheckoutMode;
  hours: number;
  /** "HH:MM" in the site's own local time. */
  endOfDayTime: string;
}

export function formatClock(hhmm: string): string {
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const suffix = h >= 12 ? "pm" : "am";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function reasonForRule(rule: AutoCheckoutRule, trigger: "hours" | "end_of_day"): string {
  return trigger === "hours"
    ? `Signed out automatically after ${rule.hours} hours`
    : `Signed out automatically at end of day (${formatClock(rule.endOfDayTime)})`;
}

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

function clockMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10));
  return (Number.isNaN(h) ? 22 : h) * 60 + (Number.isNaN(m) ? 0 : m);
}

export function isDueForAutoCheckout(params: {
  rule: AutoCheckoutRule;
  checkInTime: Date;
  now: Date;
  timeZone: string;
}): { due: boolean; trigger?: "hours" | "end_of_day" } {
  const { rule, checkInTime, now, timeZone } = params;
  if (!rule.enabled) return { due: false };

  const hoursOnSite = (now.getTime() - checkInTime.getTime()) / 3_600_000;
  if ((rule.mode === "hours" || rule.mode === "either") && hoursOnSite >= rule.hours) {
    return { due: true, trigger: "hours" };
  }

  if (rule.mode === "end_of_day" || rule.mode === "either") {
    const nowMinutes = siteMinutesOfDay(now, timeZone);
    const cutoff = clockMinutes(rule.endOfDayTime);
    const checkInMinutes = siteMinutesOfDay(checkInTime, timeZone);
    const sameLocalDay = siteDateKey(checkInTime, timeZone) === siteDateKey(now, timeZone);
    if (nowMinutes >= cutoff && (!sameLocalDay || checkInMinutes < cutoff)) {
      return { due: true, trigger: "end_of_day" };
    }
    if (!sameLocalDay) return { due: true, trigger: "end_of_day" };
  }

  return { due: false };
}
