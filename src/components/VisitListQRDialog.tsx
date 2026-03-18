import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QrCode, Download } from "lucide-react";
import QRCode from "react-qr-code";

interface VisitListQRDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VisitListQRDialog({ open, onOpenChange }: VisitListQRDialogProps) {
  const publicCheckinUrl = `${window.location.origin}/public-checkin`;

  const handlePrintQR = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    const svg = document.getElementById("public-checkin-qr");
    if (!svg) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html><head><title>Public Check-In QR Code</title>
      <style>
        body { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; font-family: Inter, system-ui, sans-serif; margin: 0; padding: 2rem; }
        .card { text-align: center; border: 2px solid #e5e7eb; border-radius: 16px; padding: 2rem; max-width: 320px; }
        .title { font-size: 1.25rem; font-weight: 700; margin-bottom: 0.5rem; color: #111827; }
        .hint { font-size: 0.8rem; color: #6b7280; margin-bottom: 1.5rem; }
        .qr { margin: 0 auto; }
        .url { font-size: 0.65rem; color: #9ca3af; margin-top: 1rem; word-break: break-all; }
        @media print { body { padding: 0; } }
      </style></head><body>
      <div class="card">
        <p class="title">Visitor Check-In</p>
        <p class="hint">Scan to check in</p>
        <div class="qr">${svg.outerHTML}</div>
        <p class="url">${publicCheckinUrl}</p>
      </div>
      </body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[380px] p-0 gap-0 rounded-xl">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="text-base font-semibold text-foreground flex items-center gap-2">
            <QrCode className="h-4 w-4 text-primary" />
            Public Check-In QR Code
          </DialogTitle>
        </DialogHeader>
        <div className="px-6 pb-6 space-y-5">
          <p className="text-[13px] text-muted-foreground">
            Display or print this QR code at your reception. Visitors can scan it to submit a check-in request.
          </p>
          <div className="flex flex-col items-center py-4">
            <div className="p-4 rounded-xl bg-card border border-border shadow-sm">
              <QRCode
                id="public-checkin-qr"
                value={publicCheckinUrl}
                size={200}
                level="H"
                style={{ height: "auto", maxWidth: "100%", width: "100%" }}
              />
            </div>
            <p className="text-[12px] text-muted-foreground mt-3 text-center max-w-[260px]">
              Visitors scan this to open the <span className="font-semibold text-foreground">self-service check-in form</span>
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1 gap-1.5 h-[34px] text-[13px]" onClick={handlePrintQR}>
              <Download className="h-3.5 w-3.5" />
              Print / Save
            </Button>
            <Button size="sm" className="flex-1 h-[34px] text-[13px]" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
