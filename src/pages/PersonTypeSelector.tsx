import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AddVisitDialog } from "@/components/AddVisitDialog";
import { useVisitors } from "@/hooks/useVisitors";
import { User, Truck, Heart, Users, QrCode, ArrowRight } from "lucide-react";

const PERSON_TYPES = [
  { type: "visitor", label: "Visitor", description: "Social, professional, or delivery visitor", icon: User, color: "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground" },
  { type: "contractor", label: "Contractor", description: "Maintenance, cleaning, IT, or building work", icon: Truck, color: "bg-warning/10 text-warning group-hover:bg-warning group-hover:text-warning-foreground" },
  { type: "volunteer", label: "Volunteer", description: "Voluntary workers and community helpers", icon: Heart, color: "bg-success/10 text-success group-hover:bg-success group-hover:text-success-foreground" },
  { type: "staff", label: "Staff", description: "Staff member or agency worker sign-in", icon: Users, color: "bg-info/10 text-info group-hover:bg-info group-hover:text-info-foreground" },
];

export default function PersonTypeSelector() {
  const navigate = useNavigate();
  const { addVisitor } = useVisitors();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<string>("visitor");

  const handleSelect = (type: string) => {
    if (type === "qr") {
      navigate("/qr-fast-lane");
      return;
    }
    setSelectedType(type);
    setDialogOpen(true);
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
                <h1 className="text-xl font-bold text-foreground">New Check-In</h1>
                <p className="text-[13px] text-muted-foreground">Select the type of person checking in</p>
              </div>
            </div>
          </header>

          <main className="p-6">
            <div className="max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4">
              {PERSON_TYPES.map((pt) => (
                <button
                  key={pt.type}
                  onClick={() => handleSelect(pt.type)}
                  className="group relative flex items-center gap-4 rounded-xl border-2 border-border bg-card p-6 transition-all duration-200 hover:border-primary hover:shadow-md active:scale-[0.98] text-left"
                >
                  <div className={`flex h-12 w-12 items-center justify-center rounded-full transition-colors ${pt.color}`}>
                    <pt.icon className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <span className="text-lg font-semibold text-foreground">{pt.label}</span>
                    <p className="text-[13px] text-muted-foreground mt-0.5">{pt.description}</p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}

              {/* QR Fast Lane */}
              <button
                onClick={() => handleSelect("qr")}
                className="group relative flex items-center gap-4 rounded-xl border-2 border-dashed border-border bg-card/50 p-6 transition-all duration-200 hover:border-primary hover:shadow-md active:scale-[0.98] text-left sm:col-span-2"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <QrCode className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <span className="text-lg font-semibold text-foreground">QR Fast Lane</span>
                  <p className="text-[13px] text-muted-foreground mt-0.5">Scan a returning visitor's QR code for quick check-in</p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            </div>
          </main>
        </SidebarInset>
      </div>
      <AddVisitDialog open={dialogOpen} onOpenChange={setDialogOpen} onAdd={addVisitor} initialType={selectedType as any} />
    </SidebarProvider>
  );
}
