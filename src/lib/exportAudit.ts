import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

/**
 * One place for operational exports so every download is written to the audit
 * trail with who took it, how many rows and which site it covered.
 *
 * Exports are plain CSV generated in the browser. They are not tamper-evident
 * and must not be treated as evidential records.
 */
export interface ExportOptions {
  filenamePrefix: string;
  auditAction: string;
  siteId?: string | null;
  siteName?: string | null;
  scopeNote?: string;
}

function toCsv(header: string[], rows: (string | number | null | undefined)[][]) {
  return [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

export async function exportCsvAudited(
  header: string[],
  rows: (string | number | null | undefined)[][],
  options: ExportOptions
) {
  const csv = toCsv(header, rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${options.filenamePrefix}-${format(new Date(), "yyyy-MM-dd")}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  const { data: auth } = await supabase.auth.getUser();
  await supabase.from("audit_log").insert({
    action: options.auditAction,
    performed_by: auth.user?.email || "Staff",
    user_id: auth.user?.id ?? null,
    records_affected: rows.length,
    details: {
      site_id: options.siteId ?? null,
      site_name: options.siteName ?? null,
      scope: options.scopeNote ?? null,
      exported_at: new Date().toISOString(),
    } as any,
  });
}
