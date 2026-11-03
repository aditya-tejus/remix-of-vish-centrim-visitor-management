import { AppShell } from "@/components/AppShell";
import { ResponsesList } from "@/components/feedback/ResponsesList";

export default function FeedbackResponses() {
  return (
    <AppShell
      title="Feedback responses"
      mainClassName="p-4 sm:p-6"
      eyebrow="Reports"
      subtitle="Every answer visitors, contractors and residents have given, newest first. Start with the ones that need follow-up."
    >
      <ResponsesList />
    </AppShell>
  );
}
