import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { FeedbackPeriodChips, FeedbackReports, FeedbackReportsActions, type FeedbackPeriod } from "@/components/feedback/FeedbackReports";

export default function FeedbackAnalytics() {
  const [period, setPeriod] = useState<FeedbackPeriod>("30");
  return (
    <AppShell
      title="Feedback summary"
      mainClassName="p-4 sm:p-6"
      eyebrow="Reports"
      subtitle="How visitors and residents rate the home, and the low scores that still need a reply."
      actions={<FeedbackReportsActions period={period} />}
      headerContent={<FeedbackPeriodChips period={period} onPeriod={setPeriod} />}
    >
      <FeedbackReports period={period} />
    </AppShell>
  );
}
