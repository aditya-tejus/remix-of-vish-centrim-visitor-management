import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { AddVisitDialog } from "@/components/AddVisitDialog";
import { QRCodeDialog } from "@/components/QRCodeDialog";
import { useVisitors } from "@/hooks/useVisitors";
import { Visitor } from "@/types/visitor";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function CheckIn() {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [qrVisitor, setQrVisitor] = useState<Visitor | null>(null);
  const { addVisitor } = useVisitors();

  const handleAddVisitor = (visitor: Omit<Visitor, "id">) => {
    const newVisitor = addVisitor(visitor);
    if (visitor.type !== "resident") setQrVisitor(newVisitor);
    return newVisitor;
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex-1 min-w-0">
          <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur-sm">
            <div className="flex items-center gap-4 px-6 py-4">
              <SidebarTrigger />
              <div className="flex-1">
                <h1 className="text-lg font-semibold text-foreground">Check-In</h1>
                <p className="text-xs text-muted-foreground">Quick visitor check-in</p>
              </div>
              <Button onClick={() => setAddDialogOpen(true)} className="gap-1.5">
                <Plus className="h-4 w-4" /> New Check-In
              </Button>
            </div>
          </header>
          <main className="p-6 flex items-center justify-center min-h-[60vh]">
            <div className="text-center space-y-4">
              <div className="text-5xl">👋</div>
              <h2 className="text-xl font-semibold text-foreground">Ready to Check In</h2>
              <p className="text-sm text-muted-foreground max-w-md">
                Register a new visitor, contractor, or staff member. You can also scan a returning visitor's QR code for instant check-in.
              </p>
              <Button onClick={() => setAddDialogOpen(true)} size="lg" className="gap-2">
                <Plus className="h-4 w-4" /> Start Check-In
              </Button>
            </div>
          </main>
        </SidebarInset>
      </div>
      <AddVisitDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} onAdd={handleAddVisitor} />
      <QRCodeDialog visitor={qrVisitor} open={!!qrVisitor} onOpenChange={(o) => { if (!o) setQrVisitor(null); }} />
    </SidebarProvider>
  );
}
