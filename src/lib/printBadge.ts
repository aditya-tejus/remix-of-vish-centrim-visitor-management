import { format } from "date-fns";

/**
 * V1 badge printing: uses the standard browser print dialog with a
 * print-friendly layout. A physical label-printer SDK integration
 * (e.g. Brother QL series) is a separate follow-up once a specific
 * printer model is chosen — see Settings → Printing for printer config.
 */
export interface BadgeData {
  name: string;
  type: string; // visitor | contractor | staff | volunteer | resident
  visiting?: string;
  date?: Date;
}

const TYPE_COLORS: Record<string, string> = {
  visitor: "#2563eb",
  contractor: "#ea580c",
  staff: "#7c3aed",
  volunteer: "#059669",
  resident: "#0891b2",
};

export function printBadge(data: BadgeData) {
  const color = TYPE_COLORS[data.type?.toLowerCase()] || TYPE_COLORS.visitor;
  const date = data.date || new Date();
  const win = window.open("", "_blank", "width=460,height=640");
  if (!win) return;

  win.document.write(`<!DOCTYPE html><html><head><title>Badge — ${data.name}</title>
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
    </div>
    <script>window.onload = function(){ window.print(); }<\/script>
  </body></html>`);
  win.document.close();
}
