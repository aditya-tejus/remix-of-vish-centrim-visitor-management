import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { ResponsesList } from "@/components/feedback/ResponsesList";
import { MessageSquare } from "lucide-react";

export default function FeedbackResponses() {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex-1">
          <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur-sm">
            <div className="flex items-center gap-4 px-6 py-4">
              <SidebarTrigger />
              <div>
                <h1 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-primary" /> Feedback Responses
                </h1>
                <p className="text-xs text-muted-foreground">Browse and filter all feedback submitted by visitors, contractors, and residents</p>
              </div>
            </div>
          </header>
          <main className="p-6">
            <ResponsesList />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
