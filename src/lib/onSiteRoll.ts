/**
 * Who is on site — the live roll. Residents live here and are not on the roll.
 * Grouped by person type, alphabetical inside each group so a fire check or a
 * handover can be read top to bottom. Also builds the print page.
 */
import { format, isSameDay } from "date-fns";
import type { Visitor } from "@/types/visitor";
import { HANDOVER_TYPES, escapeHtml, handoverType, type HandoverType } from "@/lib/handover";
import { stayLabel } from "@/lib/presence";

export interface RollEntry {
  visit: Visitor;
  name: string;
  type: HandoverType;
  stay: string;
  pastExpected: boolean;
  fromEarlierDay: boolean;
}
export interface RollGroup { type: HandoverType; label: string; entries: RollEntry[] }

export function onSiteRoll(all: Visitor[], opts: { now?: Date; isPastExpected: (v: Visitor) => boolean; onlyPastExpected?: boolean; search?: string }) {
  const now = opts.now ?? new Date();
  const q = (opts.search ?? "").trim().toLowerCase();
  const entries: RollEntry[] = all
    .filter((v) => v.type !== "resident" && v.status === "checked-in")
    .map((v) => ({
      visit: v,
      name: `${v.firstName} ${v.surname}`.trim(),
      type: handoverType(v.type),
      stay: stayLabel(v.checkInTime, null, now),
      pastExpected: opts.isPastExpected(v),
      fromEarlierDay: !isSameDay(v.checkInTime, now),
    }));
  const pastExpected = entries.filter((e) => e.pastExpected).length;
  const shown = entries
    .filter((e) => !opts.onlyPastExpected || e.pastExpected)
    .filter((e) => !q || [e.name, e.visit.whomToVisit].some((s) => (s ?? "").toLowerCase().includes(q)));
  const groups: RollGroup[] = HANDOVER_TYPES
    .map((t) => ({
      type: t.id, label: t.plural,
      entries: shown.filter((e) => e.type === t.id).sort((a, b) => a.visit.surname.localeCompare(b.visit.surname) || a.name.localeCompare(b.name)),
    }))
    .filter((g) => g.entries.length > 0);
  return { total: entries.length, pastExpected, shown: shown.length, groups };
}

/** Self-contained print page with a tick column for a fire check. Every value is escaped. */
export function rollPrintHtml(groups: RollGroup[], meta: { siteName: string; now: Date }): string {
  const e = escapeHtml;
  const total = groups.reduce((n, g) => n + g.entries.length, 0);
  const body = groups.map((g) => `
    <h2>${e(g.label)} <span>(${g.entries.length})</span></h2>
    <table><thead><tr><th class="tick">Seen</th><th>Name</th><th>Arrived</th><th>Here for</th><th>Visiting or working with</th><th>Notes</th></tr></thead><tbody>
    ${g.entries.map((x) => `<tr><td class="tick">☐</td><td><strong>${e(x.name)}</strong></td>
      <td>${e(format(x.visit.checkInTime, x.fromEarlierDay ? "h:mm a, d MMM" : "h:mm a"))}</td><td>${e(x.stay)}</td><td>${e(x.visit.whomToVisit || "—")}</td>
      <td>${x.pastExpected ? "Past expected time" : ""}</td></tr>`).join("")}
    </tbody></table>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Who is on site</title><style>
    body{font-family:Nunito,Arial,sans-serif;color:#101828;margin:24px;font-size:12px}
    h1{font-size:20px;margin:0}p.meta{color:#475467;margin:4px 0 16px}
    h2{font-size:14px;margin:18px 0 6px}h2 span{color:#475467;font-weight:600}
    table{width:100%;border-collapse:collapse}th,td{border:1px solid #d0d5dd;padding:6px 8px;text-align:left;vertical-align:top}
    th{background:#f2f4f7;font-size:11px}td.tick,th.tick{width:40px;text-align:center;font-size:16px}
  </style></head><body>
    <h1>Who is on site</h1>
    <p class="meta">${e(meta.siteName)} · Printed ${e(format(meta.now, "h:mm a, EEEE d MMMM yyyy"))} · ${total} ${total === 1 ? "person" : "people"} (residents not included)</p>
    ${body || "<p>Nobody is signed in.</p>"}
  </body></html>`;
}

export { printHtml } from "@/lib/printHtml";
