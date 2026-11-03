/**
 * Staff check-in — how the one-page form is split into sections, and which
 * section each readiness issue belongs to, so the desk can jump straight to
 * what is missing. Presentation only: the issues themselves come from
 * staffCheckInRules and are never changed here.
 */
export type CheckInSectionId = "who" | "visit" | "checks" | "agree";

export const CHECK_IN_SECTIONS: { id: CheckInSectionId; title: string; short: string }[] = [
  { id: "who", title: "Who is arriving", short: "Who" },
  { id: "visit", title: "Their visit", short: "Visit" },
  { id: "checks", title: "Checks and questions", short: "Checks" },
  { id: "agree", title: "Agree and check in", short: "Agree" },
];

/** null = not tied to one section (loading, site changed). */
export function sectionForIssue(issue: string): CheckInSectionId | null {
  if (/^Loading check-in|could not be loaded|^Select a site|site changed/i.test(issue)) return null;
  if (/^Answer: /.test(issue)) return "checks";
  if (/ is required$/.test(issue)) return "who";
  if (/destination|host|companion|food|visit reason/i.test(issue)) return "visit";
  if (/terms|privacy/i.test(issue)) return "agree";
  return "checks";
}

export function issuesBySection(issues: string[]): Record<CheckInSectionId, string[]> & { general: string[] } {
  const out = { who: [], visit: [], checks: [], agree: [], general: [] } as Record<CheckInSectionId | "general", string[]>;
  for (const issue of issues) out[sectionForIssue(issue) ?? "general"].push(issue);
  return out;
}

/** "First name" from "First name is required", so the footer can say what is left in few words. */
export function shortIssue(issue: string): string {
  return issue
    .replace(/ is required$/, "")
    .replace(/^Select a destination or host$/, "Who they are visiting")
    .replace(/^Complete required companion details$/, "Companion details")
    .replace(/^Complete the food declaration$/, "Food declaration")
    .replace(/^Confirm the terms and privacy acknowledgement$/, "Terms and privacy")
    .replace(/^Answer: /, "")
    .replace(/^Enter a staff reason of at least 10 characters$/, "Staff reason")
    .replace(/^Supervisor approval is required for this check-in$/, "Supervisor approval")
    .replace(/^Return the outstanding key or enter a reason of at least 3 characters$/, "Outstanding key")
    .replace(/^Enter a visit reason of at least 3 characters$/, "Visit reason");
}
