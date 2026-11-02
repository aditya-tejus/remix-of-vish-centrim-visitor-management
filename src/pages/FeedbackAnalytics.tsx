import { AppShell } from "@/components/AppShell";
import { FeedbackReports } from "@/components/feedback/FeedbackReports";
import { BarChart3 } from "lucide-react";

export default function FeedbackAnalytics() {
  return (
    <AppShell
      title="Feedback reports"
      subtitle="Ratings over time, how they spread, and results for each survey."
      mainClassName="p-6"
    >
            <FeedbackReports />
          </AppShell>
  );
}
