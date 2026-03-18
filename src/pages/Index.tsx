import { useState } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { DashboardHeader } from "@/components/DashboardHeader";
import { VisitorStats } from "@/components/VisitorStats";
import { UrgentActions } from "@/components/UrgentActions";
import { AddVisitDialog } from "@/components/AddVisitDialog";
import { CheckOutSheet } from "@/components/CheckOutSheet";
import { QRCodeDialog } from "@/components/QRCodeDialog";
import { useVisitors } from "@/hooks/useVisitors";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { Visitor } from "@/types/visitor";

const Index = () => {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [checkOutDialogOpen, setCheckOutDialogOpen] = useState(false);
  const [qrVisitor, setQrVisitor] = useState<Visitor | null>(null);
  const { visitors, addVisitor, checkOutVisitor, checkOutAllOverstayed, deleteVisitor, checkedInCount, totalToday, overstayedCount } = useVisitors();

  const handleAddVisitor = (visitor: Omit<Visitor, "id">) => {
    const newVisitor = addVisitor(visitor);
    if (visitor.type !== "resident") {
      setQrVisitor(newVisitor);
    }
    return newVisitor;
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex-1">
          <DashboardHeader onAddVisit={() => setAddDialogOpen(true)} onCheckOut={() => setCheckOutDialogOpen(true)} />
          <main className="p-6 space-y-6">
            <VisitorStats
              checkedIn={checkedInCount}
              totalToday={totalToday}
              overstayed={overstayedCount}
            />
            <UrgentActions
              visitors={visitors}
              onCheckOut={checkOutVisitor}
              onCheckOutAllOverstayed={checkOutAllOverstayed}
            />
          </main>
        </SidebarInset>
      </div>
      <AddVisitDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onAdd={handleAddVisitor}
      />
      <CheckOutDialog
        open={checkOutDialogOpen}
        onOpenChange={setCheckOutDialogOpen}
        visitors={visitors}
        onCheckOut={checkOutVisitor}
      />
      <QRCodeDialog
        visitor={qrVisitor}
        open={!!qrVisitor}
        onOpenChange={() => setQrVisitor(null)}
      />
    </SidebarProvider>
  );
};

export default Index;
