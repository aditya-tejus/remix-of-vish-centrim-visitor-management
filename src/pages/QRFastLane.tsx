import { useState } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useVisitors } from "@/hooks/useVisitors";
import { useToast } from "@/hooks/use-toast";
import { QrCode, Search, CheckCircle2, LogOut, AlertTriangle } from "lucide-react";

export default function QRFastLane() {
  const { visitors, addVisitor, checkOutVisitor } = useVisitors();
  const { toast } = useToast();
  const [qrInput, setQrInput] = useState("");
  const [result, setResult] = useState<{ type: "checkin" | "already" | "notfound"; visitor?: any } | null>(null);

  const handleScan = () => {
    const code = qrInput.trim();
    if (!code) return;

    // Find visitor by QR code or name match
    const match = visitors.find(
      (v) => v.id === code || `${v.firstName} ${v.surname}`.toLowerCase() === code.toLowerCase()
    );

    if (!match) {
      setResult({ type: "notfound" });
      return;
    }

    if (match.status === "checked-in") {
      setResult({ type: "already", visitor: match });
    } else {
      // Re-check-in
      addVisitor({
        firstName: match.firstName,
        surname: match.surname,
        email: match.email,
        mobile: match.mobile,
        type: match.type,
        checkInTime: new Date(),
        checkOutTime: null,
        whomToVisit: match.whomToVisit,
        address: match.address,
        status: "checked-in",
        healthDeclaration: false,
        additionalVisitors: 0,
        comments: "QR Fast Lane check-in",
        retentionExpiry: new Date(Date.now() + 86400000 * 60),
        acknowledgedPrivacy: match.acknowledgedPrivacy,
      });
      setResult({ type: "checkin", visitor: match });
      toast({ title: "Checked In", description: `${match.firstName} ${match.surname} checked in via QR.` });
    }
    setQrInput("");
  };

  const handleCheckOut = () => {
    if (result?.visitor) {
      checkOutVisitor(result.visitor.id);
      toast({ title: "Checked Out", description: `${result.visitor.firstName} ${result.visitor.surname} has been checked out.` });
      setResult(null);
    }
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex-1">
          <header className="sticky top-0 z-10 bg-card border-b border-border">
            <div className="flex items-center gap-4 px-6 h-14">
              <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
              <div>
                <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
                  <QrCode className="h-5 w-5 text-primary" /> QR Fast Lane
                </h1>
                <p className="text-[13px] text-muted-foreground">Scan or enter a QR code for quick check-in</p>
              </div>
            </div>
          </header>

          <main className="flex items-center justify-center min-h-[60vh]">
            <div className="max-w-md w-full space-y-6 p-6">
              <div className="rounded-2xl border-2 border-dashed border-border bg-card p-8 text-center space-y-4">
                <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <QrCode className="h-10 w-10 text-primary" />
                </div>
                <p className="text-sm text-muted-foreground">Scan a visitor's QR code or enter their ID/name below</p>
                <div className="flex gap-2">
                  <Input
                    value={qrInput}
                    onChange={(e) => setQrInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleScan()}
                    placeholder="QR code, visitor ID, or full name..."
                    className="flex-1"
                    autoFocus
                  />
                  <Button onClick={handleScan} className="gap-1.5">
                    <Search className="h-4 w-4" /> Look Up
                  </Button>
                </div>
              </div>

              {result && (
                <div className={`rounded-xl border p-6 text-center space-y-3 ${
                  result.type === "checkin" ? "border-success/30 bg-success/5" :
                  result.type === "already" ? "border-warning/30 bg-warning/5" :
                  "border-destructive/30 bg-destructive/5"
                }`}>
                  {result.type === "checkin" && (
                    <>
                      <CheckCircle2 className="h-8 w-8 text-success mx-auto" />
                      <p className="font-semibold text-foreground">{result.visitor.firstName} {result.visitor.surname}</p>
                      <p className="text-sm text-success">Successfully checked in</p>
                    </>
                  )}
                  {result.type === "already" && (
                    <>
                      <AlertTriangle className="h-8 w-8 text-warning mx-auto" />
                      <p className="font-semibold text-foreground">{result.visitor.firstName} {result.visitor.surname}</p>
                      <p className="text-sm text-warning">Already checked in</p>
                      <Button variant="outline" size="sm" onClick={handleCheckOut} className="gap-1.5">
                        <LogOut className="h-3.5 w-3.5" /> Check Out Instead
                      </Button>
                    </>
                  )}
                  {result.type === "notfound" && (
                    <>
                      <AlertTriangle className="h-8 w-8 text-destructive mx-auto" />
                      <p className="text-sm text-destructive">No visitor found with that code</p>
                    </>
                  )}
                </div>
              )}
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
