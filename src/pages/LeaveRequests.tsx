import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { LeaveRequestsReview } from "@/components/LeaveRequestsReview";

export default function LeaveRequests() {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex-1">
          <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur-sm">
            <div className="flex items-center gap-4 px-6 py-4">
              <SidebarTrigger />
              <div className="flex-1">
                <h1 className="text-lg font-semibold text-foreground">Checkout Requests</h1>
                <p className="text-xs text-muted-foreground">Review and manage resident checkout requests</p>
              </div>
            </div>
          </header>
          <main className="p-6">
            <LeaveRequestsReview />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
