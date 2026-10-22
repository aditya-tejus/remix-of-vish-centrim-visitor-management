/**
 * Phase 9A — kiosk safety and privacy rules, kept pure so they can be tested.
 *
 * - Outbreak mode is decision support, not a blanket denial: a flagged answer
 *   during an outbreak refers the person to staff, who decide case by case.
 *   Only an explicit configured blocking rule produces "blocked".
 * - The foyer sign-out list never shows everyone on site: the person must type
 *   at least two letters of their own name, and surnames are shown as an initial.
 */

export type KioskScreeningOutcome = "clear" | "flagged" | "refer_to_staff" | "blocked";

export function kioskScreeningOutcome(opts: {
  ruleBlocked: boolean;
  flagged: boolean;
  outbreakMode: boolean;
}): KioskScreeningOutcome {
  if (opts.ruleBlocked) return "blocked";
  if (opts.flagged && opts.outbreakMode) return "refer_to_staff";
  if (opts.flagged) return "flagged";
  return "clear";
}

/** Whether the kiosk must stop and send the person to reception. */
export const kioskMustSeeStaff = (o: KioskScreeningOutcome) => o === "blocked" || o === "refer_to_staff";

export const KIOSK_CHECKOUT_MIN_CHARS = 2;

export function maskSurname(firstName: string, surname: string): string {
  const first = (firstName || "").trim();
  const initial = (surname || "").trim().charAt(0).toUpperCase();
  return initial ? `${first} ${initial}.` : first;
}

/** Search-first sign-out list: nothing is listed until the person types enough of their name. */
export function kioskCheckoutMatches<T extends { firstName: string; surname: string }>(
  people: T[],
  query: string,
): T[] {
  const q = query.trim().toLowerCase();
  if (q.length < KIOSK_CHECKOUT_MIN_CHARS) return [];
  return people.filter((p) => {
    const full = `${p.firstName} ${p.surname}`.toLowerCase();
    return full.startsWith(q) || (p.surname || "").toLowerCase().startsWith(q) || full.includes(` ${q}`);
  });
}
