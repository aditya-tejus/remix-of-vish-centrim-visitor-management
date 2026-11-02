/**
 * Shift handover — pure rules for what the next shift needs to know:
 * who is still on site (any arrival day), residents who are out, keys not
 * returned, and who signed out on the chosen day. Also builds the print page.
 */
import { format, isSameDay } from "date-fns";
import type { Visitor } from "@/types/visitor";

export type HandoverType = "visitor" | "contractor" | "volunteer" | "staff" | "other";
export const HANDOVER_TYPES: { id: HandoverType; label: string; plural: string }[] = [
  { id: "visitor", label: "Visitor", plural: "Visitors" },
  { id: "contractor", label: "Contractor", plural: "Contractors" },
  { id: "volunteer", label: "Volunteer", plural: "Volunteers" },
  { id: "staff", label: "Staff", plural: "Staff" },
  { id: "other", label: "Other", plural: "Other" },
];

/** Unknown or custom person types fall into "other" so nobody drops off the handover. */
export const handoverType = (t: string): HandoverType =>
  (["visitor", "contractor", "volunteer", "staff"].includes(t) ? t : "other") as HandoverType;

export interface ResidentOut {
  id: string;
  name: string;
  room: string;
  leaveType?: string;
  accompaniedBy?: string;
  leftAt: Date | null;
  expectedBack: Date | null;
  overdue: boolean;
}

export interface KeyOut {
  id: string;
  label: string;
  issuedTo: string;
  issuedAt: Date;
  overdue: boolean;
}

export interface OnSiteEntry {
  visit: Visitor;
  type: HandoverType;
  pastExpected: boolean;
  fromEarlierDay: boolean;
  keys: string[];
}

export interface Handover {
  onSite: OnSiteEntry[];
  signedOut: Visitor[];
  residentsOut: ResidentOut[];
  keysOut: KeyOut[];
  counts: Record<HandoverType, number>;
}

export function buildHandover(input: {
  /** Everyone not a resident (any arrival day); on-site is worked out here. */
  people: Visitor[];
  date: Date;
  residents: { visitorId: string; name: string; room: string; savedStatus?: string; checkOutTime?: Date | null; expectedReturnDate?: Date; leaveType?: string; accompaniedByName?: string }[];
  keys: { id: string; keyLabel: string; issuedToName: string; visitorId: string | null; issuedAt: Date; overdue: boolean; isPermanent?: boolean }[];
  types: Set<HandoverType>;
  includeSignedOut: boolean;
  isPastExpected: (v: Visitor) => boolean;
  now?: Date;
}): Handover {
  const now = input.now ?? new Date();
  const counts = { visitor: 0, contractor: 0, volunteer: 0, staff: 0, other: 0 } as Record<HandoverType, number>;
  const keysByVisit = new Map<string, string[]>();
  // Permanent issues (a resident's own room fob) are not a handover item.
  const keys = input.keys.filter((k) => !k.isPermanent);
  for (const k of keys) {
    if (!k.visitorId) continue;
    const list = keysByVisit.get(k.visitorId);
    if (list) list.push(k.keyLabel); else keysByVisit.set(k.visitorId, [k.keyLabel]);
  }

  const onSite: OnSiteEntry[] = [];
  const signedOut: Visitor[] = [];
  for (const v of input.people) {
    if (v.type === "resident") continue;
    const type = handoverType(v.type);
    const here = v.status === "checked-in" && !v.checkOutTime;
    if (here) counts[type] += 1;
    if (!input.types.has(type)) continue;
    if (here) {
      onSite.push({
        visit: v, type,
        pastExpected: input.isPastExpected(v),
        fromEarlierDay: !isSameDay(v.checkInTime, now),
        keys: keysByVisit.get(v.id) ?? [],
      });
    } else if (input.includeSignedOut && isSameDay(v.checkInTime, input.date)) {
      signedOut.push(v);
    }
  }
  // Longest on site first: those are the people the next shift should check on.
  onSite.sort((a, b) => a.visit.checkInTime.getTime() - b.visit.checkInTime.getTime());
  signedOut.sort((a, b) => (b.checkOutTime?.getTime() ?? 0) - (a.checkOutTime?.getTime() ?? 0));

  const residentsOut = input.residents
    .filter((r) => r.savedStatus === "checked-out")
    .map((r) => ({
      id: r.visitorId,
      name: r.name,
      room: r.room,
      leaveType: r.leaveType,
      accompaniedBy: r.accompaniedByName,
      leftAt: r.checkOutTime ?? null,
      expectedBack: r.expectedReturnDate ?? null,
      overdue: !!(r.expectedReturnDate && r.expectedReturnDate.getTime() < now.getTime()),
    }))
    .sort((a, b) => Number(b.overdue) - Number(a.overdue) || (a.expectedBack?.getTime() ?? Infinity) - (b.expectedBack?.getTime() ?? Infinity));

  const keysOut = keys
    .map((k) => ({ id: k.id, label: k.keyLabel, issuedTo: k.issuedToName, issuedAt: k.issuedAt, overdue: k.overdue }))
    .sort((a, b) => Number(b.overdue) - Number(a.overdue) || a.issuedAt.getTime() - b.issuedAt.getTime());

  return { onSite, signedOut, residentsOut, keysOut, counts };
}

export const escapeHtml = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

const t = (d: Date | null | undefined) => (d ? format(d, "h:mm a") : "—");
const typeLabel = (type: HandoverType) => HANDOVER_TYPES.find((x) => x.id === type)!.label;

/** Self-contained print page. Every value is escaped: names and notes are typed by people. */
export function handoverPrintHtml(h: Handover, meta: { siteName: string; date: Date; now: Date; notes: string; includeSignedOut: boolean }): string {
  const e = escapeHtml;
  const flags = (x: OnSiteEntry) => [
    x.pastExpected ? "Past expected time" : "",
    x.fromEarlierDay ? `Since ${format(x.visit.checkInTime, "d MMM")}` : "",
    x.keys.length ? `Key: ${x.keys.join(", ")}` : "",
  ].filter(Boolean).map((f) => `<span class="flag">${e(f)}</span>`).join(" ");

  const section = (title: string, count: number, body: string) =>
    `<section><h2>${e(title)} <span class="count">${count}</span></h2>${count ? body : `<p class="empty">None</p>`}</section>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Handover report – ${e(format(meta.date, "d MMM yyyy"))}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Nunito,"Segoe UI",Arial,sans-serif;color:#050c42;font-size:11px;padding:18px}
header{border-bottom:2px solid #006dea;padding-bottom:10px;margin-bottom:12px}
.eyebrow{font-size:9px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#006dea}
h1{font-size:20px;font-weight:800;margin-top:2px}
.meta{color:#4b5563;margin-top:2px}
.tiles{display:flex;gap:8px;margin-bottom:14px}
.tile{flex:1;border:1px solid #d9dde7;border-radius:8px;padding:6px 8px}
.tile b{display:block;font-size:18px}
section{margin-bottom:14px;break-inside:auto}
h2{font-size:12px;font-weight:800;margin-bottom:4px}
.count{font-weight:600;color:#6b7280}
table{width:100%;border-collapse:collapse;font-size:11px}
th{text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;border-bottom:1px solid #d9dde7;padding:3px 6px 3px 0}
td{border-bottom:1px solid #eef0f4;padding:4px 6px 4px 0;vertical-align:top}
tr{break-inside:avoid}
.name{font-weight:700}
.flag{display:inline-block;border:1px solid #b45309;color:#92400e;border-radius:999px;padding:0 5px;font-size:9px;font-weight:700;margin:1px 2px 1px 0}
.empty{color:#6b7280}
.notes{border:1px solid #d9dde7;border-radius:8px;padding:8px;min-height:60px;white-space:pre-wrap}
footer{margin-top:16px;border-top:1px solid #d9dde7;padding-top:6px;color:#6b7280;font-size:9px;display:flex;justify-content:space-between}
@page{margin:12mm}
</style></head><body>
<header><p class="eyebrow">Shift handover</p><h1>Handover report</h1>
<p class="meta">${e(meta.siteName)} · ${e(format(meta.date, "EEEE d MMMM yyyy"))} · as of ${e(format(meta.now, "h:mm a"))}</p></header>
<div class="tiles">
<div class="tile"><b>${h.onSite.length}</b>Still on site</div>
<div class="tile"><b>${h.onSite.filter((x) => x.pastExpected).length}</b>Past expected time</div>
<div class="tile"><b>${h.residentsOut.length}</b>Residents out</div>
<div class="tile"><b>${h.keysOut.length}</b>Keys not returned</div>
</div>
${section("Still on site", h.onSite.length, `<table><thead><tr><th>Name</th><th>Type</th><th>Visiting</th><th>Signed in</th><th>Phone</th><th>Notes</th></tr></thead><tbody>${h.onSite.map((x) => `<tr><td class="name">${e(x.visit.firstName)} ${e(x.visit.surname)}${x.visit.additionalVisitors > 0 ? ` +${x.visit.additionalVisitors}` : ""}</td><td>${e(typeLabel(x.type))}</td><td>${e(x.visit.whomToVisit || "—")}</td><td>${e(t(x.visit.checkInTime))}</td><td>${e(x.visit.mobile || "—")}</td><td>${flags(x)}</td></tr>`).join("")}</tbody></table>`)}
${section("Residents out", h.residentsOut.length, `<table><thead><tr><th>Resident</th><th>Room</th><th>Reason</th><th>Left</th><th>Expected back</th></tr></thead><tbody>${h.residentsOut.map((r) => `<tr><td class="name">${e(r.name)}</td><td>${e(r.room || "—")}</td><td>${e(r.leaveType || "—")}${r.accompaniedBy ? ` · with ${e(r.accompaniedBy)}` : ""}</td><td>${e(t(r.leftAt))}</td><td>${e(r.expectedBack ? format(r.expectedBack, "d MMM, h:mm a") : "Not set")}${r.overdue ? ` <span class="flag">Overdue</span>` : ""}</td></tr>`).join("")}</tbody></table>`)}
${section("Keys not returned", h.keysOut.length, `<table><thead><tr><th>Key</th><th>With</th><th>Since</th></tr></thead><tbody>${h.keysOut.map((k) => `<tr><td class="name">${e(k.label)}</td><td>${e(k.issuedTo)}</td><td>${e(format(k.issuedAt, "d MMM, h:mm a"))}${k.overdue ? ` <span class="flag">Overdue</span>` : ""}</td></tr>`).join("")}</tbody></table>`)}
${meta.includeSignedOut ? section(`Signed out ${format(meta.date, "d MMM")}`, h.signedOut.length, `<table><thead><tr><th>Name</th><th>Type</th><th>Visiting</th><th>In</th><th>Out</th></tr></thead><tbody>${h.signedOut.map((v) => `<tr><td class="name">${e(v.firstName)} ${e(v.surname)}</td><td>${e(typeLabel(handoverType(v.type)))}</td><td>${e(v.whomToVisit || "—")}</td><td>${e(t(v.checkInTime))}</td><td>${e(t(v.checkOutTime))}</td></tr>`).join("")}</tbody></table>`) : ""}
<section><h2>Notes for the next shift</h2><div class="notes">${e(meta.notes.trim() || " ")}</div></section>
<footer><span>Handed over by ____________________</span><span>Received by ____________________</span><span>Printed ${e(format(meta.now, "d MMM yyyy, h:mm a"))}</span></footer>
</body></html>`;
}
