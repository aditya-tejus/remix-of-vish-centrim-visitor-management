import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

/**
 * Badge printing.
 *
 * Two output modes, both driven through the browser print dialog:
 *  - "standard": an A4-page-centred badge card (default office printer).
 *  - "label":    an exact-size label page (@page size) for Brother QL series
 *                label printers (QL-800/810W/820NWB/710W). Choosing the QL as
 *                the destination in the print dialog produces a correctly sized
 *                label with no manual scaling.
 *
 * NOTE: fully silent/driverless printing (no print dialog) is NOT possible from
 * a browser. That requires a small local print agent on the reception PC that
 * accepts the label payload and forwards it to the printer (Brother b-PAC /
 * raster over TCP 9100). The `printer_ip` setting is stored ready for that
 * follow-up; this file deliberately stops at the print-dialog integration.
 */
export interface BadgeData {
  name: string;
  type: string; // visitor | contractor | staff | volunteer | resident
  visiting?: string;
  date?: Date;
  /** Visitor's own mobile number. */
  mobile?: string;
  /** Room / villa (and wing) of the resident being visited. */
  room?: string;
  /** Value encoded in the badge QR code — the person's stable personal code. */
  qrValue?: string;
}


export type BadgeMode = "standard" | "label";

export interface BadgeConfig {
  mode: BadgeMode;
  /** 62mm | 62x29mm | 62x100mm | 29mm */
  labelSize: string;
  printerModel?: string;
}

const TYPE_COLORS: Record<string, string> = {
  visitor: "#2563eb",
  contractor: "#ea580c",
  staff: "#7c3aed",
  volunteer: "#059669",
  resident: "#0891b2",
};

/** Physical page size for each supported Brother QL label roll. */
const LABEL_DIMENSIONS: Record<string, { w: number; h: number }> = {
  "62mm": { w: 62, h: 100 },
  "62x100mm": { w: 62, h: 100 },
  "62x29mm": { w: 62, h: 29 },
  "29mm": { w: 29, h: 90 },
};

/** Reads the configured printer mode/label size from settings. */
export async function getBadgeConfig(): Promise<BadgeConfig> {
  const { data } = await supabase
    .from("settings")
    .select("key, value")
    .in("key", ["label_printer_mode", "label_size", "printer_model"]);

  const map: Record<string, string> = {};
  data?.forEach((r) => { map[r.key] = r.value; });

  return {
    mode: map.label_printer_mode === "label" ? "label" : "standard",
    labelSize: map.label_size || "62mm",
    printerModel: map.printer_model,
  };
}

function badgeMarkup(data: BadgeData, color: string, date: Date) {
  return `
    <div class="badge">
      <div class="strip"></div>
      <div class="head">
        <div class="type">${data.type}</div>
        <div class="name">${data.name}</div>
      </div>
      <div class="body">
        <div class="row"><span class="label">Date</span><span class="value">${format(date, "dd MMM yyyy")}</span></div>
        ${data.visiting ? `<div class="row"><span class="label">Visiting</span><span class="value">${data.visiting}</span></div>` : ""}
      </div>
      <div class="foot">Centrim Life</div>
    </div>`;
}

function standardHtml(data: BadgeData, color: string, date: Date) {
  return `<!DOCTYPE html><html><head><title>Badge — ${data.name}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: Inter, system-ui, sans-serif; background:#f8fafc; display:flex; align-items:center; justify-content:center; min-height:100vh; }
    .badge { width: 320px; border-radius: 18px; overflow:hidden; background:#fff; border:2px solid #e2e8f0; }
    .strip { height: 10px; background:${color}; }
    .head { padding: 22px 20px 16px; text-align:center; }
    .type { display:inline-block; padding:4px 12px; border-radius:999px; background:${color}1a; color:${color}; font-size:12px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; }
    .name { font-size:26px; font-weight:800; color:#0f172a; margin-top:10px; line-height:1.15; }
    .body { padding: 0 20px 20px; }
    .row { display:flex; justify-content:space-between; font-size:13px; padding:8px 0; border-top:1px solid #f1f5f9; }
    .label { color:#64748b; }
    .value { color:#0f172a; font-weight:600; text-align:right; }
    .foot { text-align:center; font-size:10px; color:#94a3b8; padding:10px 0 14px; letter-spacing:.08em; text-transform:uppercase; }
    @media print { body { background:#fff; } .badge { border:1px solid #cbd5e1; } }
  </style></head><body>
    ${badgeMarkup(data, color, date)}
    <script>window.onload = function(){ window.print(); }<\/script>
  </body></html>`;
}

function labelHtml(data: BadgeData, color: string, date: Date, size: string) {
  const dim = LABEL_DIMENSIONS[size] || LABEL_DIMENSIONS["62mm"];
  const compact = dim.h <= 40; // 62 x 29mm roll — name + type only
  const nameSize = compact ? 13 : 19;

  return `<!DOCTYPE html><html><head><title>Badge — ${data.name}</title>
  <style>
    @page { size: ${dim.w}mm ${dim.h}mm; margin: 2mm; }
    * { margin:0; padding:0; box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    html, body { width:${dim.w}mm; }
    body { font-family: Inter, system-ui, sans-serif; background:#fff; }
    .badge { width:100%; border:0.4mm solid ${color}; border-radius:2mm; overflow:hidden; }
    .strip { height:2.5mm; background:${color}; }
    .head { padding:${compact ? "1.5mm 2mm 1mm" : "3mm 3mm 2mm"}; text-align:center; }
    .type { display:inline-block; padding:0.4mm 2mm; border-radius:99mm; background:${color}; color:#fff; font-size:${compact ? 7 : 8}pt; font-weight:700; letter-spacing:.06em; text-transform:uppercase; }
    .name { font-size:${nameSize}pt; font-weight:800; color:#0f172a; margin-top:1.5mm; line-height:1.1; word-break:break-word; }
    .body { padding:0 3mm ${compact ? "1mm" : "2mm"}; display:${compact ? "none" : "block"}; }
    .row { display:flex; justify-content:space-between; gap:2mm; font-size:9pt; padding:1.2mm 0; border-top:0.2mm solid #e2e8f0; }
    .label { color:#64748b; }
    .value { color:#0f172a; font-weight:600; text-align:right; }
    .foot { text-align:center; font-size:6.5pt; color:#94a3b8; padding:${compact ? "0.5mm" : "1.5mm"} 0 1.5mm; letter-spacing:.08em; text-transform:uppercase; }
  </style></head><body>
    ${badgeMarkup(data, color, date)}
    <script>window.onload = function(){ window.print(); }<\/script>
  </body></html>`;
}

export function printBadge(data: BadgeData, config?: Partial<BadgeConfig>) {
  const color = TYPE_COLORS[data.type?.toLowerCase()] || TYPE_COLORS.visitor;
  const date = data.date || new Date();
  const mode = config?.mode || "standard";
  const size = config?.labelSize || "62mm";
  const dim = LABEL_DIMENSIONS[size] || LABEL_DIMENSIONS["62mm"];

  const win =
    mode === "label"
      ? window.open("", "_blank", `width=${Math.round(dim.w * 4)},height=${Math.round(dim.h * 4) + 120}`)
      : window.open("", "_blank", "width=460,height=640");
  if (!win) return;

  win.document.write(
    mode === "label" ? labelHtml(data, color, date, size) : standardHtml(data, color, date)
  );
  win.document.close();
}

/** Reads the configured printer mode and prints accordingly. */
export async function printBadgeAuto(data: BadgeData) {
  const config = await getBadgeConfig();
  printBadge(data, config);
}
