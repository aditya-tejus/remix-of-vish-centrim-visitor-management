import { useState, useRef } from "react";
import { Visitor } from "@/types/visitor";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { Printer, Users, User, HardHat, Home, UserCog, Clock } from "lucide-react";

interface HandoverPrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visitors: Visitor[];
  date: Date;
}

type PersonType = "visitor" | "resident" | "contractor" | "staff";

const typeConfig: Record<PersonType, { label: string; icon: typeof Users; pluralLabel: string }> = {
  visitor: { label: "Visitor", icon: Users, pluralLabel: "Visitors" },
  resident: { label: "Resident", icon: Home, pluralLabel: "Residents" },
  staff: { label: "Staff", icon: UserCog, pluralLabel: "Staff" },
  contractor: { label: "Contractor", icon: HardHat, pluralLabel: "Contractors" },
};

function HandoverSection({
  title,
  icon: Icon,
  people,
  showStatus,
}: {
  title: string;
  icon: typeof Users;
  people: Visitor[];
  showStatus: boolean;
}) {
  const checkedIn = people.filter((p) => p.status === "checked-in");
  const checkedOut = people.filter((p) => p.status === "checked-out");

  if (people.length === 0) return null;

  return (
    <div className="break-inside-avoid mb-6">
      <div className="flex items-center gap-2 mb-2 border-b-2 border-foreground/20 pb-1">
        <Icon className="h-4 w-4" />
        <h3 className="text-sm font-bold uppercase tracking-wider">{title}</h3>
        <span className="text-xs text-muted-foreground ml-auto">
          {checkedIn.length} in · {checkedOut.length} out · {people.length} total
        </span>
      </div>

      {/* Currently IN */}
      {checkedIn.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-success mb-1 flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-success inline-block" />
            Currently Inside ({checkedIn.length})
          </p>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="py-1 pr-2 font-semibold text-muted-foreground w-6">#</th>
                <th className="py-1 pr-2 font-semibold text-muted-foreground">Name</th>
                <th className="py-1 pr-2 font-semibold text-muted-foreground">Contact</th>
                <th className="py-1 pr-2 font-semibold text-muted-foreground">Check-In</th>
                <th className="py-1 pr-2 font-semibold text-muted-foreground">Visiting</th>
                <th className="py-1 font-semibold text-muted-foreground">Companions</th>
              </tr>
            </thead>
            <tbody>
              {checkedIn.map((v, i) => (
                <tr key={v.id} className="border-b border-border/50">
                  <td className="py-1 pr-2 text-muted-foreground">{i + 1}</td>
                  <td className="py-1 pr-2 font-medium">{v.firstName} {v.surname}</td>
                  <td className="py-1 pr-2 text-muted-foreground">{v.mobile || v.email || "—"}</td>
                  <td className="py-1 pr-2">{format(v.checkInTime, "HH:mm")}</td>
                  <td className="py-1 pr-2">{v.whomToVisit || "—"}</td>
                  <td className="py-1">{v.additionalVisitors > 0 ? v.additionalVisitors : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Checked OUT */}
      {checkedOut.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 inline-block" />
            Checked Out ({checkedOut.length})
          </p>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="py-1 pr-2 font-semibold text-muted-foreground w-6">#</th>
                <th className="py-1 pr-2 font-semibold text-muted-foreground">Name</th>
                <th className="py-1 pr-2 font-semibold text-muted-foreground">Contact</th>
                <th className="py-1 pr-2 font-semibold text-muted-foreground">In</th>
                <th className="py-1 pr-2 font-semibold text-muted-foreground">Out</th>
                <th className="py-1 font-semibold text-muted-foreground">Visiting</th>
              </tr>
            </thead>
            <tbody>
              {checkedOut.map((v, i) => (
                <tr key={v.id} className="border-b border-border/50 text-muted-foreground">
                  <td className="py-1 pr-2">{i + 1}</td>
                  <td className="py-1 pr-2 font-medium text-foreground/70">{v.firstName} {v.surname}</td>
                  <td className="py-1 pr-2">{v.mobile || v.email || "—"}</td>
                  <td className="py-1 pr-2">{format(v.checkInTime, "HH:mm")}</td>
                  <td className="py-1 pr-2">{v.checkOutTime ? format(v.checkOutTime, "HH:mm") : "—"}</td>
                  <td className="py-1">{v.whomToVisit || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function HandoverPrintDialog({ open, onOpenChange, visitors, date }: HandoverPrintDialogProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [includeTypes, setIncludeTypes] = useState<Record<PersonType, boolean>>({
    visitor: true,
    resident: true,
    staff: true,
    contractor: true,
  });
  const [includeCheckedOut, setIncludeCheckedOut] = useState(true);

  const grouped = (Object.keys(typeConfig) as PersonType[]).reduce(
    (acc, type) => {
      let filtered = visitors.filter((v) => v.type === type);
      if (!includeCheckedOut) {
        filtered = filtered.filter((v) => v.status === "checked-in");
      }
      acc[type] = filtered;
      return acc;
    },
    {} as Record<PersonType, Visitor[]>
  );

  const totalIn = visitors.filter((v) => v.status === "checked-in").length;
  const totalOut = visitors.filter((v) => v.status === "checked-out").length;

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Handover Report - ${format(date, "dd MMM yyyy")}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 20px; color: #1a1a1a; font-size: 12px; }
          .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 12px; }
          .header h1 { font-size: 18px; font-weight: 700; margin-bottom: 4px; }
          .header p { font-size: 11px; color: #666; }
          .summary { display: flex; justify-content: center; gap: 24px; margin-bottom: 16px; padding: 8px; background: #f5f5f5; border-radius: 4px; }
          .summary span { font-size: 11px; }
          .summary strong { font-weight: 700; }
          .section { margin-bottom: 20px; break-inside: avoid; }
          .section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #ddd; padding-bottom: 4px; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between; }
          .section-title .counts { font-size: 10px; font-weight: 400; color: #888; text-transform: none; }
          .status-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 4px; padding: 2px 0; }
          .status-in { color: #16a34a; }
          .status-out { color: #888; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
          th { text-align: left; font-size: 10px; font-weight: 600; color: #888; text-transform: uppercase; padding: 3px 6px 3px 0; border-bottom: 1px solid #ddd; }
          td { padding: 3px 6px 3px 0; border-bottom: 1px solid #eee; font-size: 11px; }
          .name { font-weight: 600; }
          .muted { color: #888; }
          .footer { text-align: center; margin-top: 24px; padding-top: 12px; border-top: 1px solid #ddd; font-size: 10px; color: #888; }
          .dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; margin-right: 4px; vertical-align: middle; }
          .dot-in { background: #16a34a; }
          .dot-out { background: #ccc; }
          @media print { body { padding: 10px; } .no-print { display: none; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Handover Report</h1>
          <p>${format(date, "EEEE, dd MMMM yyyy")} · Generated at ${format(new Date(), "HH:mm, dd MMM yyyy")}</p>
        </div>
        <div class="summary">
          <span><strong>${totalIn}</strong> currently inside</span>
          <span><strong>${totalOut}</strong> checked out</span>
          <span><strong>${totalIn + totalOut}</strong> total</span>
        </div>
        ${(Object.keys(typeConfig) as PersonType[])
          .filter((type) => includeTypes[type] && grouped[type].length > 0)
          .map((type) => {
            const config = typeConfig[type];
            const people = grouped[type];
            const inPeople = people.filter((p) => p.status === "checked-in");
            const outPeople = people.filter((p) => p.status === "checked-out");

            return `
              <div class="section">
                <div class="section-title">
                  ${config.pluralLabel}
                  <span class="counts">${inPeople.length} in · ${outPeople.length} out · ${people.length} total</span>
                </div>
                ${inPeople.length > 0 ? `
                  <p class="status-label status-in"><span class="dot dot-in"></span>Currently Inside (${inPeople.length})</p>
                  <table>
                    <thead><tr><th>#</th><th>Name</th><th>Contact</th><th>Check-In</th><th>Visiting</th><th>Companions</th></tr></thead>
                    <tbody>
                      ${inPeople.map((v, i) => `
                        <tr>
                          <td class="muted">${i + 1}</td>
                          <td class="name">${v.firstName} ${v.surname}</td>
                          <td class="muted">${v.mobile || v.email || "—"}</td>
                          <td>${format(v.checkInTime, "HH:mm")}</td>
                          <td>${v.whomToVisit || "—"}</td>
                          <td>${v.additionalVisitors > 0 ? v.additionalVisitors : "—"}</td>
                        </tr>
                      `).join("")}
                    </tbody>
                  </table>
                ` : ""}
                ${includeCheckedOut && outPeople.length > 0 ? `
                  <p class="status-label status-out"><span class="dot dot-out"></span>Checked Out (${outPeople.length})</p>
                  <table>
                    <thead><tr><th>#</th><th>Name</th><th>Contact</th><th>In</th><th>Out</th><th>Visiting</th></tr></thead>
                    <tbody>
                      ${outPeople.map((v, i) => `
                        <tr>
                          <td class="muted">${i + 1}</td>
                          <td class="name">${v.firstName} ${v.surname}</td>
                          <td class="muted">${v.mobile || v.email || "—"}</td>
                          <td>${format(v.checkInTime, "HH:mm")}</td>
                          <td>${v.checkOutTime ? format(v.checkOutTime, "HH:mm") : "—"}</td>
                          <td>${v.whomToVisit || "—"}</td>
                        </tr>
                      `).join("")}
                    </tbody>
                  </table>
                ` : ""}
              </div>
            `;
          }).join("")}
        <div class="footer">
          Handover Report · ${format(date, "dd MMM yyyy")} · Printed at ${format(new Date(), "HH:mm")}
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 300);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-4 w-4" />
            Handover Report
          </DialogTitle>
          <DialogDescription>
            {format(date, "EEEE, dd MMMM yyyy")} · Preview and print the shift handover list
          </DialogDescription>
        </DialogHeader>

        {/* Options */}
        <div className="flex flex-wrap items-center gap-4 py-2 border-b border-border">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Include:</span>
          {(Object.keys(typeConfig) as PersonType[]).map((type) => {
            const config = typeConfig[type];
            const count = grouped[type].length;
            return (
              <label key={type} className="flex items-center gap-1.5 text-xs cursor-pointer">
                <Checkbox
                  checked={includeTypes[type]}
                  onCheckedChange={(checked) =>
                    setIncludeTypes((prev) => ({ ...prev, [type]: !!checked }))
                  }
                  className="h-3.5 w-3.5"
                />
                {config.pluralLabel}
                <Badge variant="secondary" className="text-[9px] h-4 px-1">{count}</Badge>
              </label>
            );
          })}
          <Separator orientation="vertical" className="h-4" />
          <label className="flex items-center gap-1.5 text-xs cursor-pointer">
            <Checkbox
              checked={includeCheckedOut}
              onCheckedChange={(checked) => setIncludeCheckedOut(!!checked)}
              className="h-3.5 w-3.5"
            />
            Show checked-out
          </label>
        </div>

        {/* Preview */}
        <div ref={printRef} className="flex-1 overflow-y-auto px-1 py-3 space-y-1">
          {/* Summary bar */}
          <div className="flex items-center justify-center gap-6 mb-4 py-2 rounded-lg bg-muted/40">
            <span className="text-xs text-muted-foreground">
              <span className="font-bold text-foreground">{totalIn}</span> currently inside
            </span>
            <span className="text-xs text-muted-foreground">
              <span className="font-bold text-foreground">{totalOut}</span> checked out
            </span>
            <span className="text-xs text-muted-foreground">
              <span className="font-bold text-foreground">{totalIn + totalOut}</span> total
            </span>
          </div>

          {(Object.keys(typeConfig) as PersonType[])
            .filter((type) => includeTypes[type])
            .map((type) => {
              const config = typeConfig[type];
              return (
                <HandoverSection
                  key={type}
                  title={config.pluralLabel}
                  icon={config.icon}
                  people={grouped[type]}
                  showStatus={includeCheckedOut}
                />
              );
            })}

          {Object.values(grouped).every((g) => g.length === 0) && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No records for this date.
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-border">
          <p className="text-[10px] text-muted-foreground">
            Generated at {format(new Date(), "HH:mm, dd MMM yyyy")}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handlePrint} className="gap-1.5">
              <Printer className="h-3.5 w-3.5" /> Print Handover
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
