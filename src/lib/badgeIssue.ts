import { supabase } from "@/integrations/supabase/client";
import { siteScopedKey } from "@/lib/settingsScope";
import { printBadgeAuto, type BadgeData } from "./printBadge";

/**
 * Badge lifecycle.
 *
 * There is one badge model: the visit itself. A badge is not a separate record —
 * `visitors.print_status` carries where the badge is in its life (issued,
 * reprinted, voided) and every print is written to the audit trail.
 *
 * Printing goes through the browser print dialog only. There is no hardware
 * printer integration and none is implied.
 */
export type BadgeEvent = "issued" | "reprinted" | "voided";

const DESTINATION_KEY = "badge_show_destination";

/** Whether this site allows the resident/area to appear on a printed badge. */
export async function fetchBadgeDestinationAllowed(siteId: string | null): Promise<boolean> {
  const keys = [DESTINATION_KEY, ...(siteId ? [siteScopedKey(DESTINATION_KEY, siteId)] : [])];
  const { data } = await supabase.from("settings").select("key, value").in("key", keys);
  const map: Record<string, string> = {};
  (data || []).forEach((r) => { map[r.key] = r.value; });
  const scoped = siteId ? map[siteScopedKey(DESTINATION_KEY, siteId)] : undefined;
  const value = scoped ?? map[DESTINATION_KEY];
  return value !== "false"; // default: allowed
}

async function recordBadgeEvent(
  event: BadgeEvent,
  opts: { visitorId?: string | null; siteId?: string | null; name: string; personType?: string }
) {
  const { data: auth } = await supabase.auth.getUser();
  const performedBy = auth.user?.email || "Staff";

  if (opts.visitorId) {
    await supabase.from("visitors").update({ print_status: event }).eq("id", opts.visitorId);
  }

  await supabase.from("audit_log").insert({
    action: `badge_${event}`,
    performed_by: performedBy,
    user_id: auth.user?.id ?? null,
    records_affected: 1,
    details: {
      visitor_id: opts.visitorId ?? null,
      person_name: opts.name,
      person_type: opts.personType ?? null,
      site_id: opts.siteId ?? null,
      at: new Date().toISOString(),
    } as any,
  });
}

export interface IssueBadgeOptions {
  visitorId?: string | null;
  siteId?: string | null;
  /** Site/host name printed on the badge footer line. */
  siteName?: string | null;
  /** True when the badge has already been printed for this visit. */
  reprint?: boolean;
}

/**
 * Prints a badge and records it. The resident/room lines are dropped when the
 * site's privacy rule says the destination must not appear on a printed badge.
 */
export async function issueBadge(data: BadgeData, opts: IssueBadgeOptions = {}) {
  const allowDestination = await fetchBadgeDestinationAllowed(opts.siteId ?? null);
  const payload: BadgeData = allowDestination
    ? data
    : { ...data, visiting: undefined, room: undefined };

  await printBadgeAuto(payload);
  await recordBadgeEvent(opts.reprint ? "reprinted" : "issued", {
    visitorId: opts.visitorId,
    siteId: opts.siteId,
    name: data.name,
    personType: data.type,
  });
}

/** Marks a badge as no longer valid (lost, spoiled, wrong details). */
export async function voidBadge(opts: { visitorId: string; siteId?: string | null; name: string }) {
  await recordBadgeEvent("voided", opts);
}
