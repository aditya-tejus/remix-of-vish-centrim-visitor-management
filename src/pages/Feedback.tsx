import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SurveyBuilder } from "@/components/feedback/SurveyBuilder";
import { ResponsesList } from "@/components/feedback/ResponsesList";
import { FeedbackReports } from "@/components/feedback/FeedbackReports";
import { MessageSquare, ClipboardList, BarChart3 } from "lucide-react";

export default function Feedback() {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex-1 min-w-0">
          <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur-sm">
            <div className="flex items-center gap-4 px-6 py-4">
              <SidebarTrigger />
              <div>
                <h1 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-primary" /> Feedback Management
                </h1>
                <p className="text-xs text-muted-foreground">Create surveys, view responses, and generate reports</p>
              </div>
            </div>
          </header>

          <main className="p-6">
            <Tabs defaultValue="surveys" className="space-y-6">
              <TabsList className="bg-muted/50 p-1 rounded-xl h-auto">
                <TabsTrigger value="surveys" className="gap-1.5 rounded-lg text-xs data-[state=active]:shadow-sm">
                  <ClipboardList className="h-3.5 w-3.5" /> Surveys
                </TabsTrigger>
                <TabsTrigger value="responses" className="gap-1.5 rounded-lg text-xs data-[state=active]:shadow-sm">
                  <MessageSquare className="h-3.5 w-3.5" /> Responses
                </TabsTrigger>
                <TabsTrigger value="reports" className="gap-1.5 rounded-lg text-xs data-[state=active]:shadow-sm">
                  <BarChart3 className="h-3.5 w-3.5" /> Reports
                </TabsTrigger>
              </TabsList>

              <TabsContent value="surveys"><SurveyBuilder /></TabsContent>
              <TabsContent value="responses"><ResponsesList /></TabsContent>
              <TabsContent value="reports"><FeedbackReports /></TabsContent>
            </Tabs>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
