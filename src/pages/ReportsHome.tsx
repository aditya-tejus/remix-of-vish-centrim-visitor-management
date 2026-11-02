import { useNavigate } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { Shield, ClipboardList, TrendingUp, BarChart3, ArrowRight, MessageSquare, Users, CalendarRange } from "lucide-react";

const REPORT_CARDS = [
  {
    title: "Visitor report",
    description: "Every person recorded at this site for a chosen week, with exports",
    icon: CalendarRange,
    path: "/reports/visitor-report",
    color: "text-primary bg-primary/10",
  },
  {
    title: "Who is on site",
    description: "Live presence, people over their expected time and visit history",
    icon: Users,
    path: "/reports/on-site",
    color: "text-primary bg-primary/10",
  },
  {
    title: "Evacuation report",
    description: "History of evacuation drills and roll call results",
    icon: Shield,
    path: "/reports/evacuation",
    color: "text-destructive bg-destructive/10",
  },
  {
    title: "Presence log",
    description: "Every check-in and check-out, with filters",
    icon: ClipboardList,
    path: "/reports/presence",
    color: "text-primary bg-primary/10",
  },
  {
    title: "Visit trends",
    description: "Daily and weekly visit patterns by person type",
    icon: TrendingUp,
    path: "/reports/trends",
    color: "text-success bg-success/10",
  },
  {
    title: "Reports and analytics",
    description: "Visits, busy times and who is visited most",
    icon: BarChart3,
    path: "/reports/analytics",
    color: "text-warning bg-warning/10",
  },
  {
    title: "Feedback responses",
    description: "Browse all feedback submitted by visitors and residents",
    icon: MessageSquare,
    path: "/reports/feedback-responses",
    color: "text-primary bg-primary/10",
  },
  {
    title: "Feedback reports",
    description: "Analytics dashboard with rating trends and survey breakdowns",
    icon: BarChart3,
    path: "/reports/feedback-reports",
    color: "text-info-strong bg-info-subtle",
  },
];

export default function ReportsHome() {
  const navigate = useNavigate();

  return (
    <AppShell
      title="Reports"
      subtitle="Evacuations, presence, visit trends and feedback for this site."
      mainClassName="p-4 sm:p-6"
    >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 sm:gap-4">
              {REPORT_CARDS.map((card) => (
                <button
                  key={card.path}
                  onClick={() => navigate(card.path)}
                  className="group flex items-start gap-4 rounded-2xl border border-border bg-card p-5 text-left shadow-sm transition-colors hover:border-primary/60 hover:shadow-md"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                    <card.icon aria-hidden className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-extrabold text-foreground">{card.title}</p>
                    <p className="text-[13px] text-muted-foreground mt-1">{card.description}</p>
                  </div>
                  <ArrowRight aria-hidden className="mt-1 h-5 w-5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                </button>
              ))}
            </div>
    </AppShell>
  );
}
