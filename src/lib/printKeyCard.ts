import { format } from "date-fns";
import { getBadgeConfig, BadgeConfig } from "@/lib/printBadge";

/**
 * Printable key/fob holder card.
 *
 * Uses the same browser print-dialog approach as visitor badges: an A4-centred
 * card by default, or an exact-size label page for the Brother QL series when
 * label printing is configured under Settings > Printing.
 */
export interface KeyCardData {
  keyLabel: string;
  keyTypeLabel: string;
  copyNumber?: number | null;
  propertyLabel?: string | null;
  residentName?: string | null;
  holderName: string;
  holderType?: string | null;
  issuedBy?: string | null;
  issuedAt: Date;
  dueBack: Date | null;
  isPermanent: boolean;
  overdue?: boolean;
  reference: string;
}

const LABEL_DIMENSIONS: Record<string, { w: number; h: number }> = {
  "62mm": { w: 62, h: 100 },
  "62x100mm": { w: 62, h: 100 },
  "62x29mm": { w: 62, h: 29 },
  "29mm": { w: 29, h: 90 },
};

const statusColor = (d: KeyCardData) =>
  d.isPermanent ? "#475569" : d.overdue ? "#dc2626" : "#2563eb";

const dueText = (d: KeyCardData) =>
  d.isPermanent ? "Permanent" : d.dueBack ? format(d.dueBack, "hh:mm a dd MMM yyyy") : "No date set";

const rows = (d: KeyCardData) =>
  [
    ["Type", d.keyTypeLabel + (d.copyNumber ? ` · copy ${d.copyNumber}` : "")],
    ["Property", d.propertyLabel || "—"],
    ["Resident", d.residentName || "—"],
    ["Issued", format(d.issuedAt, "hh:mm a dd MMM yyyy")],
    ["Issued by", d.issuedBy || "—"],
    ["Due back", dueText(d)],
    ["Ref", d.reference],
  ]
    .map(([l, v]) => `<div class="row"><span class="label">${l}</span><span class="value">${v}</span></div>`)
    .join("");

function cardMarkup(d: KeyCardData) {
  return `
    <div class="card">
      <div class="strip"></div>
      <div class="head">
        <div class="type">Key holder card</div>
        <div class="name">${d.keyLabel}</div>
        <div class="holder">${d.holderName}${d.holderType ? ` · ${d.holderType}` : ""}</div>
      </div>
      <div class="body">${rows(d)}</div>
      <div class="foot">Centrim Life · return to reception</div>
    </div>`;
}

function standardHtml(d: KeyCardData, color: string) {
  return `<!DOCTYPE html><html><head><title>Key card — ${d.keyLabel}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: Inter, system-ui, sans-serif; background:#f8fafc; display:flex; align-items:center; justify-content:center; min-height:100vh; }
    .card { width: 330px; border-radius: 18px; overflow:hidden; background:#fff; border:2px solid #e2e8f0; }
    .strip { height: 10px; background:${color}; }
    .head { padding: 20px 20px 14px; text-align:center; }
    .type { display:inline-block; padding:4px 12px; border-radius:999px; background:${color}1a; color:${color}; font-size:11px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; }
    .name { font-size:22px; font-weight:800; color:#0f172a; margin-top:10px; line-height:1.15; }
    .holder { font-size:13px; color:#475569; margin-top:4px; }
    .body { padding: 0 20px 16px; }
    .row { display:flex; justify-content:space-between; gap:12px; font-size:12.5px; padding:7px 0; border-top:1px solid #f1f5f9; }
    .label { color:#64748b; }
    .value { color:#0f172a; font-weight:600; text-align:right; }
    .foot { text-align:center; font-size:10px; color:#94a3b8; padding:8px 0 14px; letter-spacing:.06em; text-transform:uppercase; }
    @media print { body { background:#fff; } .card { border:1px solid #cbd5e1; } }
  </style></head><body>
    ${cardMarkup(d)}
    <script>window.onload = function(){ window.print(); }<\/script>
  </body></html>`;
}

function labelHtml(d: KeyCardData, color: string, size: string) {
  const dim = LABEL_DIMENSIONS[size] || LABEL_DIMENSIONS["62mm"];
  const compact = dim.h <= 40;
  return `<!DOCTYPE html><html><head><title>Key card — ${d.keyLabel}</title>
  <style>
    @page { size: ${dim.w}mm ${dim.h}mm; margin: 2mm; }
    * { margin:0; padding:0; box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    html, body { width:${dim.w}mm; }
    body { font-family: Inter, system-ui, sans-serif; background:#fff; }
    .card { width:100%; border:0.4mm solid ${color}; border-radius:2mm; overflow:hidden; }
    .strip { height:2.5mm; background:${color}; }
    .head { padding:${compact ? "1.5mm 2mm 1mm" : "3mm 3mm 2mm"}; text-align:center; }
    .type { font-size:6pt; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:${color}; }
    .name { font-size:${compact ? 10 : 13}pt; font-weight:800; color:#0f172a; margin-top:0.8mm; line-height:1.1; }
    .holder { font-size:${compact ? 7 : 8.5}pt; color:#475569; margin-top:0.6mm; }
    .body { padding:0 3mm ${compact ? "1mm" : "2mm"}; ${compact ? "display:none;" : ""} }
    .row { display:flex; justify-content:space-between; gap:2mm; font-size:7.5pt; padding:0.7mm 0; border-top:0.2mm solid #e2e8f0; }
    .label { color:#64748b; }
    .value { color:#0f172a; font-weight:600; text-align:right; }
    .foot { text-align:center; font-size:6pt; color:#94a3b8; padding:${compact ? "0.5mm" : "1.5mm"} 0 1.5mm; letter-spacing:.06em; text-transform:uppercase; }
  </style></head><body>
    ${cardMarkup(d)}
    <script>window.onload = function(){ window.print(); }<\/script>
  </body></html>`;
}

export function printKeyCard(data: KeyCardData, config?: Partial<BadgeConfig>) {
  const color = statusColor(data);
  const mode = config?.mode || "standard";
  const size = config?.labelSize || "62mm";
  const dim = LABEL_DIMENSIONS[size] || LABEL_DIMENSIONS["62mm"];

  const win =
    mode === "label"
      ? window.open("", "_blank", `width=${Math.round(dim.w * 4)},height=${Math.round(dim.h * 4) + 120}`)
      : window.open("", "_blank", "width=470,height=680");
  if (!win) return;

  win.document.write(mode === "label" ? labelHtml(data, color, size) : standardHtml(data, color));
  win.document.close();
}

/** Reads the configured printer mode and prints accordingly. */
export async function printKeyCardAuto(data: KeyCardData) {
  const config = await getBadgeConfig();
  printKeyCard(data, config);
}
