import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Syringe, Link2, CalendarClock, ClipboardList, MessageSquare } from "lucide-react";
import { ComplianceTab } from "@/components/settings/ComplianceTab";
import { HealthScreeningTab } from "@/components/settings/HealthScreeningTab";
import { ReturnNotificationSettingsTab } from "@/components/settings/ReturnNotificationSettingsTab";
import { IntegrationTab } from "@/components/settings/IntegrationTab";
import { AuditTrailTab } from "@/components/settings/AuditTrailTab";
import { FeedbackSettingsTab } from "@/components/settings/FeedbackSettingsTab";

export default function SettingsPage() {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex-1">
          <header className="sticky top-0 z-30 bg-card border-b border-border h-14 flex items-center px-6">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
              <div>
                <h1 className="text-xl font-bold text-foreground leading-tight">Settings</h1>
                <p className="text-[13px] text-muted-foreground">Manage compliance, configuration, and system settings.</p>
              </div>
            </div>
          </header>
          <main className="p-6">
            <Tabs defaultValue="compliance" className="space-y-6">
              <TabsList className="inline-flex items-center bg-muted rounded-lg p-1 gap-0.5 flex-wrap h-auto">
                <TabsTrigger value="compliance" className="gap-1.5 rounded-md text-[13px] font-medium data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm h-8 px-3">
                  <Shield className="h-3.5 w-3.5" />GDPR
                </TabsTrigger>
                <TabsTrigger value="forms" className="gap-1.5 rounded-md text-[13px] font-medium data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm h-8 px-3">
                  <Syringe className="h-3.5 w-3.5" />Forms
                </TabsTrigger>
                <TabsTrigger value="returns" className="gap-1.5 rounded-md text-[13px] font-medium data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm h-8 px-3">
                  <CalendarClock className="h-3.5 w-3.5" />Returns
                </TabsTrigger>
                <TabsTrigger value="integration" className="gap-1.5 rounded-md text-[13px] font-medium data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm h-8 px-3">
                  <Link2 className="h-3.5 w-3.5" />Integration
                </TabsTrigger>
                <TabsTrigger value="audit-trail" className="gap-1.5 rounded-md text-[13px] font-medium data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm h-8 px-3">
                  <ClipboardList className="h-3.5 w-3.5" />Audit Trail
                </TabsTrigger>
                <TabsTrigger value="feedback" className="gap-1.5 rounded-md text-[13px] font-medium data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm h-8 px-3">
                  <MessageSquare className="h-3.5 w-3.5" />Feedback
                </TabsTrigger>
              </TabsList>

              <TabsContent value="compliance"><ComplianceTab /></TabsContent>
              <TabsContent value="forms"><HealthScreeningTab /></TabsContent>
              <TabsContent value="returns"><ReturnNotificationSettingsTab /></TabsContent>
              <TabsContent value="integration"><IntegrationTab /></TabsContent>
              <TabsContent value="audit-trail"><AuditTrailTab /></TabsContent>
              <TabsContent value="feedback"><FeedbackSettingsTab /></TabsContent>
            </Tabs>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
