import { AppShell } from "@/components/AppShell";
import { ResponsesList } from "@/components/feedback/ResponsesList";
import { MessageSquare } from "lucide-react";

export default function FeedbackResponses() {
  return (
    <AppShell
      title="Feedback responses"
      subtitle="Everything visitors, contractors and residents have told you, newest first."
      mainClassName="p-6"
    >
            <ResponsesList />
          </AppShell>
  );
}
