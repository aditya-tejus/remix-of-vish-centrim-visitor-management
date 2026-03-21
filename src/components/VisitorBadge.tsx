import { Visitor } from "@/types/visitor";
import { format } from "date-fns";
import QRCode from "react-qr-code";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

interface VisitorBadgeProps {
  visitor: Visitor;
  variant?: "digital" | "print";
  onPrint?: () => void;
}

export function VisitorBadge({ visitor, variant = "digital", onPrint }: VisitorBadgeProps) {
  const initials = `${visitor.firstName[0] || ""}${visitor.surname[0] || ""}`.toUpperCase();
  const qrValue = visitor.qrCode || visitor.id;

  const handlePrint = () => {
    if (onPrint) { onPrint(); return; }
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    const svg = document.getElementById(`badge-qr-${visitor.id}`);
    printWindow.document.write(`
      <!DOCTYPE html>
      <html><head><title>Visitor Badge - ${visitor.firstName} ${visitor.surname}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { display: flex; align-items: center; justify-content: center; min-height: 100vh; font-family: Inter, system-ui, sans-serif; background: #f8f9fa; }
        .badge { width: 320px; border: 2px solid #e5e7eb; border-radius: 20px; overflow: hidden; background: white; }
        .header { background: linear-gradient(135deg, #1e40af, #3b82f6); padding: 20px; text-align: center; color: white; }
        .header .initials { width: 56px; height: 56px; border-radius: 50%; background: rgba(255,255,255,0.2); display: inline-flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 700; margin-bottom: 8px; }
        .header .name { font-size: 20px; font-weight: 700; }
        .header .type { font-size: 13px; opacity: 0.85; text-transform: capitalize; margin-top: 2px; }
        .body { padding: 20px; text-align: center; }
        .detail { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; border-bottom: 1px solid #f3f4f6; }
        .detail:last-child { border: none; }
        .detail .label { color: #6b7280; }
        .detail .value { font-weight: 600; color: #111827; }
        .qr { margin: 16px auto 8px; }
        .qr-hint { font-size: 11px; color: #9ca3af; }
        @media print { body { background: white; } .badge { border: 1px solid #d1d5db; } }
      </style></head><body>
      <div class="badge">
        <div class="header">
          <div class="initials">${initials}</div>
          <div class="name">${visitor.firstName} ${visitor.surname}</div>
          <div class="type">${visitor.type}</div>
        </div>
        <div class="body">
          <div class="detail"><span class="label">Checked In</span><span class="value">${format(visitor.checkInTime, "h:mm a, dd MMM yyyy")}</span></div>
          ${visitor.whomToVisit ? `<div class="detail"><span class="label">Visiting</span><span class="value">${visitor.whomToVisit}</span></div>` : ""}
          <div class="qr">${svg?.outerHTML || ""}</div>
          <div class="qr-hint">Scan QR code for quick check-out</div>
        </div>
      </div>
      </body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  if (variant === "print") {
    return (
      <Button variant="outline" size="sm" className="gap-1.5" onClick={handlePrint}>
        <Download className="h-3.5 w-3.5" />
        Print Badge
      </Button>
    );
  }

  // Digital badge (shown on kiosk success screen)
  return (
    <div className="w-full max-w-xs mx-auto rounded-2xl border-2 border-border bg-card overflow-hidden shadow-sm">
      <div className="bg-gradient-to-br from-primary to-primary/80 p-5 text-center text-primary-foreground">
        <div className="h-14 w-14 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-2 text-lg font-bold">
          {initials}
        </div>
        <p className="text-xl font-bold">{visitor.firstName} {visitor.surname}</p>
        <p className="text-sm opacity-85 capitalize">{visitor.type}</p>
      </div>
      <div className="p-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Checked In</span>
          <span className="font-medium text-foreground">{format(visitor.checkInTime, "h:mm a")}</span>
        </div>
        {visitor.whomToVisit && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Visiting</span>
            <span className="font-medium text-foreground">{visitor.whomToVisit}</span>
          </div>
        )}
        <div className="flex flex-col items-center pt-3 pb-1">
          <div className="p-3 rounded-xl bg-white border border-border">
            <QRCode
              id={`badge-qr-${visitor.id}`}
              value={qrValue}
              size={120}
              level="H"
              style={{ height: "auto", maxWidth: "100%", width: "100%" }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">Scan for quick check-out</p>
        </div>
      </div>
    </div>
  );
}
