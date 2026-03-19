import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { FeedbackReports } from "@/components/feedback/FeedbackReports";
import { BarChart3 } from "lucide-react";

export default function FeedbackAnalytics() {
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
                  <BarChart3 className="h-5 w-5 text-primary" /> Feedback Reports
                </h1>
                <p className="text-xs text-muted-foreground">Analytics dashboard with rating trends, distributions, and survey breakdowns</p>
              </div>
            </div>
          </header>
          <main className="p-6">
            <FeedbackReports />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
