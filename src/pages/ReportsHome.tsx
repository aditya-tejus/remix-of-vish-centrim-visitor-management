import { useNavigate } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Shield, ClipboardList, TrendingUp, BarChart3, ArrowRight, MessageSquare } from "lucide-react";

const REPORT_CARDS = [
  {
    title: "Evacuation Report",
    description: "History of evacuation drills and roll call results",
    icon: Shield,
    path: "/reports/evacuation",
    color: "text-destructive bg-destructive/10",
  },
  {
    title: "Presence Log",
    description: "Complete filterable record of all check-ins and check-outs",
    icon: ClipboardList,
    path: "/reports/presence",
    color: "text-primary bg-primary/10",
  },
  {
    title: "Visit Trends",
    description: "Daily and weekly visit patterns by person type",
    icon: TrendingUp,
    path: "/reports/trends",
    color: "text-success bg-success/10",
  },
  {
    title: "Reports & Analytics",
    description: "Full analytics dashboard with charts and compliance metrics",
    icon: BarChart3,
    path: "/reports/analytics",
    color: "text-warning bg-warning/10",
  },
  {
    title: "Feedback Responses",
    description: "Browse all feedback submitted by visitors and residents",
    icon: MessageSquare,
    path: "/reports/feedback-responses",
    color: "text-primary bg-primary/10",
  },
  {
    title: "Feedback Reports",
    description: "Analytics dashboard with rating trends and survey breakdowns",
    icon: BarChart3,
    path: "/reports/feedback-reports",
    color: "text-violet-500 bg-violet-500/10",
  },
];

export default function ReportsHome() {
  const navigate = useNavigate();

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex-1">
          <header className="sticky top-0 z-10 bg-card border-b border-border">
            <div className="flex items-center gap-4 px-6 h-14">
              <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
              <div>
                <h1 className="text-xl font-bold text-foreground">Reports</h1>
                <p className="text-[13px] text-muted-foreground">View evacuation reports, presence logs, and visit trends</p>
              </div>
            </div>
          </header>

          <main className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
              {REPORT_CARDS.map((card) => (
                <button
                  key={card.path}
                  onClick={() => navigate(card.path)}
                  className="group flex items-start gap-4 rounded-xl border-2 border-border bg-card p-6 text-left transition-all duration-200 hover:border-primary hover:shadow-md active:scale-[0.98]"
                >
                  <div className={`flex h-12 w-12 items-center justify-center rounded-full ${card.color} transition-colors shrink-0`}>
                    <card.icon className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-semibold text-foreground">{card.title}</p>
                    <p className="text-[13px] text-muted-foreground mt-1">{card.description}</p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-1 shrink-0" />
                </button>
              ))}
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
