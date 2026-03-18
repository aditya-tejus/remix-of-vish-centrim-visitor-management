import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Syringe, Link2, CalendarClock, ClipboardList, MessageSquare, Globe, ScrollText, Bell, Zap, Printer, UserCircle, DoorOpen, Lock } from "lucide-react";
import { ComplianceTab } from "@/components/settings/ComplianceTab";
import { HealthScreeningTab } from "@/components/settings/HealthScreeningTab";
import { ReturnNotificationSettingsTab } from "@/components/settings/ReturnNotificationSettingsTab";
import { IntegrationTab } from "@/components/settings/IntegrationTab";
import { AuditTrailTab } from "@/components/settings/AuditTrailTab";
import { FeedbackSettingsTab } from "@/components/settings/FeedbackSettingsTab";
import { PresenceTab } from "@/components/settings/PresenceTab";
import { TermsConditionsTab } from "@/components/settings/TermsConditionsTab";
import { AlertsTab } from "@/components/settings/AlertsTab";
import { AutomationTab } from "@/components/settings/AutomationTab";
import { PrintingTab } from "@/components/settings/PrintingTab";
import { ProfilesBadgesTab } from "@/components/settings/ProfilesBadgesTab";
import { ResidentLeaveSettingsTab } from "@/components/settings/ResidentLeaveSettingsTab";
import { LockGovernanceTab } from "@/components/settings/LockGovernanceTab";

const tabTriggerClass = "gap-1.5 rounded-md text-[13px] font-medium data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm h-8 px-3";

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
            <Tabs defaultValue="presence" className="space-y-6">
              <TabsList className="inline-flex items-center bg-muted rounded-lg p-1 gap-0.5 flex-wrap h-auto">
                <TabsTrigger value="presence" className={tabTriggerClass}>
                  <Globe className="h-3.5 w-3.5" />Presence
                </TabsTrigger>
                <TabsTrigger value="forms" className={tabTriggerClass}>
                  <Syringe className="h-3.5 w-3.5" />Screening
                </TabsTrigger>
                <TabsTrigger value="terms" className={tabTriggerClass}>
                  <ScrollText className="h-3.5 w-3.5" />T&C
                </TabsTrigger>
                <TabsTrigger value="alerts" className={tabTriggerClass}>
                  <Bell className="h-3.5 w-3.5" />Alerts
                </TabsTrigger>
                <TabsTrigger value="automation" className={tabTriggerClass}>
                  <Zap className="h-3.5 w-3.5" />Automation
                </TabsTrigger>
                <TabsTrigger value="printing" className={tabTriggerClass}>
                  <Printer className="h-3.5 w-3.5" />Printing
                </TabsTrigger>
                <TabsTrigger value="profiles" className={tabTriggerClass}>
                  <UserCircle className="h-3.5 w-3.5" />Profiles
                </TabsTrigger>
                <TabsTrigger value="resident-leave" className={tabTriggerClass}>
                  <DoorOpen className="h-3.5 w-3.5" />Leave
                </TabsTrigger>
                <TabsTrigger value="returns" className={tabTriggerClass}>
                  <CalendarClock className="h-3.5 w-3.5" />Returns
                </TabsTrigger>
                <TabsTrigger value="compliance" className={tabTriggerClass}>
                  <Shield className="h-3.5 w-3.5" />GDPR
                </TabsTrigger>
                <TabsTrigger value="integration" className={tabTriggerClass}>
                  <Link2 className="h-3.5 w-3.5" />Integration
                </TabsTrigger>
                <TabsTrigger value="audit-trail" className={tabTriggerClass}>
                  <ClipboardList className="h-3.5 w-3.5" />Audit
                </TabsTrigger>
                <TabsTrigger value="feedback" className={tabTriggerClass}>
                  <MessageSquare className="h-3.5 w-3.5" />Feedback
                </TabsTrigger>
                <TabsTrigger value="governance" className={tabTriggerClass}>
                  <Lock className="h-3.5 w-3.5" />Governance
                </TabsTrigger>
              </TabsList>

              <TabsContent value="presence"><PresenceTab /></TabsContent>
              <TabsContent value="forms"><HealthScreeningTab /></TabsContent>
              <TabsContent value="terms"><TermsConditionsTab /></TabsContent>
              <TabsContent value="alerts"><AlertsTab /></TabsContent>
              <TabsContent value="automation"><AutomationTab /></TabsContent>
              <TabsContent value="printing"><PrintingTab /></TabsContent>
              <TabsContent value="profiles"><ProfilesBadgesTab /></TabsContent>
              <TabsContent value="resident-leave"><ResidentLeaveSettingsTab /></TabsContent>
              <TabsContent value="returns"><ReturnNotificationSettingsTab /></TabsContent>
              <TabsContent value="compliance"><ComplianceTab /></TabsContent>
              <TabsContent value="integration"><IntegrationTab /></TabsContent>
              <TabsContent value="audit-trail"><AuditTrailTab /></TabsContent>
              <TabsContent value="feedback"><FeedbackSettingsTab /></TabsContent>
              <TabsContent value="governance"><LockGovernanceTab /></TabsContent>
            </Tabs>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
