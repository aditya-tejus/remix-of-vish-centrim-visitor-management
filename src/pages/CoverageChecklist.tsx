import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, AlertTriangle, ArrowRight } from "lucide-react";

interface ScreenItem {
  id: number;
  name: string;
  path: string;
  phase: number;
  status: "done" | "partial" | "todo";
}

const SCREENS: ScreenItem[] = [
  { id: 1, name: "Home Workbench", path: "/", phase: 1, status: "done" },
  { id: 2, name: "Person Type Selector", path: "/person-type", phase: 7, status: "done" },
  { id: 3, name: "Visitor Check-In", path: "/check-in", phase: 6, status: "done" },
  { id: 4, name: "Group Check-In", path: "/group-checkin", phase: 7, status: "done" },
  { id: 5, name: "QR Fast Lane", path: "/qr-fast-lane", phase: 7, status: "done" },
  { id: 6, name: "Contractor Check-In", path: "/check-in", phase: 6, status: "done" },
  { id: 7, name: "Volunteer Check-In", path: "/check-in", phase: 7, status: "done" },
  { id: 8, name: "Check-Out", path: "/visit-list", phase: 6, status: "done" },
  { id: 9, name: "Group Checkout", path: "/visit-list", phase: 7, status: "partial" },
  { id: 10, name: "Resident Leave", path: "/resident-leave", phase: 6, status: "done" },
  { id: 11, name: "Emergency Roll Call", path: "/evacuation", phase: 6, status: "done" },
  { id: 12, name: "Visitor Profiles List", path: "/visitors", phase: 6, status: "done" },
  { id: 13, name: "Visitor Profile Detail", path: "/visitors", phase: 6, status: "done" },
  { id: 14, name: "Reports Home", path: "/reports", phase: 6, status: "done" },
  { id: 15, name: "Evacuation Report", path: "/reports/evacuation", phase: 7, status: "done" },
  { id: 16, name: "Presence Log", path: "/reports/presence", phase: 7, status: "done" },
  { id: 17, name: "Visit Trends", path: "/reports/trends", phase: 7, status: "done" },
  { id: 18, name: "Settings Home", path: "/settings", phase: 7, status: "done" },
  { id: 19, name: "Settings: Presence", path: "/settings", phase: 7, status: "done" },
  { id: 20, name: "Settings: Screening", path: "/settings", phase: 7, status: "done" },
  { id: 21, name: "Settings: Terms & Conditions", path: "/settings", phase: 7, status: "done" },
  { id: 22, name: "Settings: Alerts", path: "/settings", phase: 7, status: "done" },
  { id: 23, name: "Settings: Automation", path: "/settings", phase: 7, status: "done" },
  { id: 24, name: "Settings: Printing", path: "/settings", phase: 7, status: "done" },
  { id: 25, name: "Settings: Profiles & Badges", path: "/settings", phase: 7, status: "done" },
  { id: 26, name: "Settings: Resident Leave", path: "/settings", phase: 7, status: "done" },
  { id: 27, name: "Settings: GDPR / UK", path: "/settings", phase: 7, status: "done" },
  { id: 28, name: "Settings: Audit Log", path: "/settings", phase: 7, status: "done" },
  { id: 29, name: "Settings: Lock & Governance", path: "/settings", phase: 7, status: "done" },
  { id: 30, name: "Kiosk Home", path: "/kiosk", phase: 10, status: "done" },
  { id: 31, name: "Kiosk Person Type", path: "/kiosk/checkin", phase: 10, status: "done" },
  { id: 32, name: "Kiosk Visitor Check-In", path: "/kiosk/checkin", phase: 10, status: "done" },
  { id: 33, name: "Kiosk QR Fast Lane", path: "/qr-fast-lane", phase: 10, status: "partial" },
  { id: 34, name: "Kiosk Contractor Check-In", path: "/kiosk/checkin", phase: 10, status: "done" },
  { id: 35, name: "Kiosk Check-Out", path: "/kiosk/checkout", phase: 10, status: "done" },
  { id: 36, name: "Kiosk Resident Leave", path: "/kiosk/resident-leave", phase: 10, status: "done" },
];

export default function CoverageChecklist() {
  const navigate = useNavigate();

  const stats = useMemo(() => ({
    done: SCREENS.filter((s) => s.status === "done").length,
    partial: SCREENS.filter((s) => s.status === "partial").length,
    todo: SCREENS.filter((s) => s.status === "todo").length,
  }), []);

  const statusIcon = (status: string) => {
    if (status === "done") return <CheckCircle2 className="h-4 w-4 text-success" />;
    if (status === "partial") return <AlertTriangle className="h-4 w-4 text-warning" />;
    return <Circle className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex-1 min-w-0">
          <header className="sticky top-0 z-10 bg-card border-b border-border">
            <div className="flex items-center gap-4 px-6 h-14">
              <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
              <div>
                <h1 className="text-xl font-bold text-foreground">Coverage Checklist</h1>
                <p className="text-[13px] text-muted-foreground">All 36 screens — implementation status</p>
              </div>
            </div>
          </header>

          <main className="p-6 space-y-6">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-4 max-w-lg">
              <div className="rounded-xl border border-success/30 bg-success/5 p-4 text-center">
                <p className="text-2xl font-bold text-success">{stats.done}</p>
                <p className="text-xs text-muted-foreground">Done</p>
              </div>
              <div className="rounded-xl border border-warning/30 bg-warning/5 p-4 text-center">
                <p className="text-2xl font-bold text-warning">{stats.partial}</p>
                <p className="text-xs text-muted-foreground">Partial</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4 text-center">
                <p className="text-2xl font-bold text-muted-foreground">{stats.todo}</p>
                <p className="text-xs text-muted-foreground">Todo</p>
              </div>
            </div>

            {/* Screen list */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              {SCREENS.map((screen) => (
                <button
                  key={screen.id}
                  onClick={() => navigate(screen.path)}
                  className="w-full flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-muted/50 transition-colors text-left group"
                >
                  {statusIcon(screen.status)}
                  <span className="text-sm font-medium text-foreground flex-1">
                    <span className="text-muted-foreground mr-2">#{screen.id}</span>
                    {screen.name}
                  </span>
                  <Badge variant="outline" className="text-[10px]">Phase {screen.phase}</Badge>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
