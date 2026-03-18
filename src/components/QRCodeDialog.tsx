import { Visitor } from "@/types/visitor";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { format } from "date-fns";
import { Check, Download, QrCode } from "lucide-react";
import QRCode from "react-qr-code";

interface QRCodeDialogProps {
  visitor: Visitor | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QRCodeDialog({ visitor, open, onOpenChange }: QRCodeDialogProps) {
  if (!visitor) return null;

  // QR payload is a URL to the public check-in form
  const baseUrl = window.location.origin;
  const qrPayload = `${baseUrl}/public-checkin`;

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    const svg = document.getElementById("visitor-qr-code");
    if (!svg) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html><head><title>Visitor QR - ${visitor.firstName} ${visitor.surname}</title>
      <style>
        body { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; font-family: system-ui, sans-serif; margin: 0; padding: 2rem; }
        .card { text-align: center; border: 2px solid #e5e7eb; border-radius: 16px; padding: 2rem; max-width: 320px; }
        .name { font-size: 1.25rem; font-weight: 700; margin: 1rem 0 0.25rem; }
        .meta { font-size: 0.75rem; color: #6b7280; }
        .qr { margin: 1.5rem auto; }
        .hint { font-size: 0.7rem; color: #9ca3af; margin-top: 1rem; }
        @media print { body { padding: 0; } }
      </style></head><body>
      <div class="card">
        <p class="name">${visitor.firstName} ${visitor.surname}</p>
        <p class="meta">${visitor.type.charAt(0).toUpperCase() + visitor.type.slice(1)} • Checked in ${format(visitor.checkInTime, "HH:mm, dd MMM yyyy")}</p>
        <div class="qr">${svg.outerHTML}</div>
        <p class="hint">Scan this QR code to check out</p>
      </div>
      </body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[380px] p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="text-base font-semibold text-foreground flex items-center gap-2">
            <QrCode className="h-4 w-4 text-primary" />
            Check-In Confirmed
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-5">
          {/* Success banner */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-success/10 border border-success/20">
            <div className="h-8 w-8 rounded-full bg-success flex items-center justify-center shrink-0">
              <Check className="h-4 w-4 text-success-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{visitor.firstName} {visitor.surname}</p>
              <p className="text-[11px] text-muted-foreground">
                Checked in at {format(visitor.checkInTime, "HH:mm")} • {visitor.type}
              </p>
            </div>
          </div>

          {/* QR Code */}
          <div className="flex flex-col items-center py-4">
            <div className="p-4 rounded-2xl bg-card border border-border shadow-sm">
              <QRCode
                id="visitor-qr-code"
                value={qrPayload}
                size={180}
                level="H"
                style={{ height: "auto", maxWidth: "100%", width: "100%" }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-3 text-center">
              Scan this QR code to open the <span className="font-semibold text-foreground">check-in form</span>
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={handlePrint}>
              <Download className="h-3.5 w-3.5" />
              Print / Save
            </Button>
            <Button size="sm" className="flex-1" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
