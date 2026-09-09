import { supabase } from "@/integrations/supabase/client";

/**
 * Minimal offline queue for roll-call outcomes.
 *
 * Privacy rule: only identifiers and the chosen status are ever written to the
 * browser. No names, phone numbers, room numbers, clinical or assistance notes.
 */
export interface QueuedOutcome {
  attendanceId: string;
  drillId: string;
  status: string;
  markedAt: string;
}

const KEY = "centrim.emergency.queue.v1";

export function readQueue(): QueuedOutcome[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((q) => q && typeof q.attendanceId === "string" && typeof q.drillId === "string" && typeof q.status === "string")
      .map((q) => ({ attendanceId: q.attendanceId, drillId: q.drillId, status: q.status, markedAt: q.markedAt || new Date().toISOString() }));
  } catch {
    return [];
  }
}

function writeQueue(items: QueuedOutcome[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* storage unavailable — the outcome simply is not queued */
  }
}

/** One pending entry per person per event, so a retry never duplicates a line. */
export function enqueueOutcome(item: QueuedOutcome) {
  const items = readQueue().filter((q) => q.attendanceId !== item.attendanceId);
  items.push(item);
  writeQueue(items);
}

export function clearQueueFor(drillId: string) {
  writeQueue(readQueue().filter((q) => q.drillId !== drillId));
}

/**
 * Re-sends queued outcomes. Returns how many are still pending afterwards.
 * A closed event rejects the write in the database; those entries are dropped
 * so a resolved roll call is never silently reopened.
 */
export async function flushQueue(drillId?: string): Promise<{ sent: number; pending: number }> {
  const all = readQueue();
  const target = drillId ? all.filter((q) => q.drillId === drillId) : all;
  let sent = 0;
  const failed: QueuedOutcome[] = [];

  for (const item of target) {
    const { error } = await supabase
      .from("evacuation_attendance" as any)
      .update({
        status: item.status,
        marked_safe_at: item.status === "unaccounted" ? null : item.markedAt,
      } as any)
      .eq("id", item.attendanceId);

    if (!error) sent += 1;
    else if (/closed/i.test(error.message)) sent += 0; // dropped: event is closed
    else failed.push(item);
  }

  const untouched = all.filter((q) => !target.includes(q));
  writeQueue([...untouched, ...failed]);
  return { sent, pending: failed.length + untouched.length };
}
