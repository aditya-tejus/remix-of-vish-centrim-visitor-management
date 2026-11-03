import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, BarChart3, CalendarRange, MessageSquare, Shield, Star, Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";

interface ReportLink { title: string; description: string; icon: LucideIcon; path: string }

/** Grouped by the question a member of staff is trying to answer, not by data source. */
const GROUPS: { title: string; question: string; reports: ReportLink[] }[] = [
  {
    title: "Who came and went",
    question: "Check who is here now, or who visited on a given day.",
    reports: [
      { title: "Who is on site", description: "Everyone signed in right now, and anyone past their expected time. Print it for a handover or fire check.", icon: Users, path: "/reports/on-site" },
      { title: "Visitor report", description: "Every arrival and departure for a chosen week, with times, who they saw and a download.", icon: CalendarRange, path: "/reports/visitor-report" },
    ],
  },
  {
    title: "Patterns",
    question: "Plan reception cover and notice residents who rarely have visitors.",
    reports: [
      { title: "Visit patterns", description: "Busy days and times, how long people stay and which residents get the most and fewest visitors.", icon: BarChart3, path: "/reports/analytics" },
    ],
  },
  {
    title: "Safety",
    question: "Evidence for inspections and fire safety reviews.",
    reports: [
      { title: "Evacuation report", description: "Past evacuations and drills, how long the roll call took and who was accounted for.", icon: Shield, path: "/reports/evacuation" },
    ],
  },
  {
    title: "Feedback",
    question: "What visitors and residents tell you, and what needs a reply.",
    reports: [
      { title: "Feedback summary", description: "Ratings over time, survey results and low scores that need someone to follow up.", icon: Star, path: "/reports/feedback-reports" },
      { title: "Feedback responses", description: "Read each response, filter by rating and find comments that need action.", icon: MessageSquare, path: "/reports/feedback-responses" },
    ],
  },
];

export default function ReportsHome() {
  return (
    <AppShell title="Reports" mainClassName="p-4 sm:p-6" subtitle="Pick the question you need answering. Every report covers this site only.">
      <div className="grid gap-x-4 gap-y-8 lg:grid-cols-2">
        {GROUPS.map((g) => (
          <section key={g.title} className={g.reports.length > 1 ? "lg:col-span-2" : undefined} aria-labelledby={`grp-${g.title.replace(/\s+/g, "-").toLowerCase()}`}>
            <h2 id={`grp-${g.title.replace(/\s+/g, "-").toLowerCase()}`} className="text-lg font-extrabold text-foreground">{g.title}</h2>
            <p className="mb-3 text-sm text-muted-foreground">{g.question}</p>
            <div className={g.reports.length > 1 ? "grid grid-cols-1 gap-3 md:grid-cols-2 sm:gap-4" : "grid grid-cols-1 gap-3"}>
              {g.reports.map((r) => (
                <Link key={r.path} to={r.path}
                  className="group flex min-h-[96px] items-start gap-4 rounded-2xl border border-border bg-card p-5 text-left shadow-sm transition-colors hover:border-primary/60 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                    <r.icon aria-hidden className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-extrabold text-foreground">{r.title}</span>
                    <span className="mt-1 block text-[13px] text-muted-foreground">{r.description}</span>
                  </span>
                  <ArrowRight aria-hidden className="mt-1 h-5 w-5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </AppShell>
  );
}
