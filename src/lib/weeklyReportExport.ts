import { reportToRows, type ReportRow } from "@/lib/weeklyReport";

export interface ReportContext {
  siteName: string;
  rangeLabel: string;
  timeZone: string;
  timeZoneIsFallback: boolean;
  generatedAt: string;
  includeScreening: boolean;
}

function contextLines(ctx: ReportContext): string[] {
  return [
    `Site: ${ctx.siteName}`,
    `Period: ${ctx.rangeLabel}`,
    `Times shown in: ${ctx.timeZone}${ctx.timeZoneIsFallback ? " (this device — no site time zone set)" : ""}`,
    `Generated: ${ctx.generatedAt}`,
  ];
}

function escape(value: string) {
  return `"${(value ?? "").replace(/"/g, '""')}"`;
}

export function exportReportToCSV(rows: ReportRow[], ctx: ReportContext, filename: string) {
  const table = reportToRows(rows, ctx.timeZone, ctx.includeScreening);
  const csv = [
    ...contextLines(ctx).map((line) => escape(line)),
    "",
    ...table.map((line) => line.map(escape).join(",")),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** Opens a clean, printable page. The browser's own print dialog makes the PDF. */
export function printReport(rows: ReportRow[], ctx: ReportContext) {
  const table = reportToRows(rows, ctx.timeZone, ctx.includeScreening);
  const [headers, ...body] = table;
  const esc = (s: string) => (s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8" />
<title>Visitor report — ${esc(ctx.siteName)}</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 24px; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .meta { font-size: 12px; color: #444; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #f3f4f6; }
  @media print { body { margin: 10mm; } }
</style></head><body>
<h1>Visitor activity report</h1>
<div class="meta">${contextLines(ctx).map((l) => esc(l)).join("<br />")}</div>
<table><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>
<tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>
</body></html>`;

  const win = window.open("", "_blank");
  if (!win) return false;
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
  return true;
}
