import type { Resident } from "@/hooks/useResidents";

export type ResidentLocation = "no-absence" | "away" | "on-leave" | "overdue";
/** Administrative movement is never a physical sighting or emergency safety evidence. */
export function residentLocation(resident: Pick<Resident, "savedStatus" | "expectedReturnDate" | "leaveType">, now = new Date()): ResidentLocation {
  if (resident.savedStatus !== "checked-out") return "no-absence";
  if (resident.expectedReturnDate && Number.isFinite(resident.expectedReturnDate.getTime()) && resident.expectedReturnDate < now) return "overdue";
  return resident.leaveType && resident.leaveType !== "Away" ? "on-leave" : "away";
}
export function sameLocalDay(a: Date, b: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  return Number.isFinite(a.getTime()) && formatter.format(a) === formatter.format(b);
}
export function movementTimeZone(zone: string | null | undefined, jurisdiction: string) {
  if (zone) { try { new Intl.DateTimeFormat("en", { timeZone: zone }); return zone; } catch { /* explicit fallback */ } }
  return jurisdiction === "UK" ? "Europe/London" : "Australia/Sydney";
}
export function formatMovementTime(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hour12: true, day: "2-digit", month: "short" }).format(date);
}
/** Reject nonexistent and ambiguous local DST times rather than silently shifting a return. */
export function residentLocalInstant(value: string, timeZone: string): Date | undefined {
  if (!value) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error("Enter a valid date and time.");
  const [year, month, day, hour, minute] = value.split(/[-T:]/).map(Number);
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const matches: Date[] = [];
  for (let offset = -14 * 60; offset <= 14 * 60; offset += 15) {
    const date = new Date(guess + offset * 60000);
    const parts = Object.fromEntries(fmt.formatToParts(date).map(p => [p.type, p.value]));
    if (`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}` === value) matches.push(date);
  }
  if (matches.length !== 1) throw new Error("This local time is ambiguous or unavailable. Choose another time.");
  return matches[0];
}
export function independentAbsenceAllowed(packId: string, mode: "short" | "planned") { return packId === "au_rv" && mode === "short"; }
export function absenceReady(independent: boolean, residentId: string | undefined, reason: string, escort: string) {
  return !!residentId && (independent || (!!reason.trim() && !!escort));
}
export interface MovementResult { saved: boolean; resident_id: string; branch_id: string; movement: string; status: string; recorded_time: string; expected_return: string | null }
export function assertSavedMovement(data: unknown, residentId: string, siteId: string, action: "leave" | "return"): asserts data is MovementResult {
  const result = data as Partial<MovementResult> | null;
  if (result?.saved !== true || result.resident_id !== residentId || result.branch_id !== siteId || result.movement !== action || result.status !== (action === "leave" ? "checked-out" : "checked-in") || !result.recorded_time || !Number.isFinite(Date.parse(result.recorded_time))) throw new Error("The movement was not confirmed. Please retry or refresh.");
}