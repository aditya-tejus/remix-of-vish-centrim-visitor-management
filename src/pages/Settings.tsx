import { useState } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { SettingsNav, SettingsSection, SECTION_META } from "@/components/settings/SettingsNav";
import { SettingsPageHeading } from "@/components/settings/SettingsScope";
import { SiteSwitcher } from "@/components/SiteSwitcher";
import { PersonTypeSettings } from "@/components/settings/PersonTypeSettings";
import { PersonTypesTab } from "@/components/settings/PersonTypesTab";
import { OperatingContextTab } from "@/components/settings/OperatingContextTab";
import { PresenceTab } from "@/components/settings/PresenceTab";
import { PrintingTab } from "@/components/settings/PrintingTab";
import { KeysPolicyTab } from "@/components/settings/KeysPolicyTab";

import { ComplianceTab } from "@/components/settings/ComplianceTab";
import { IntegrationTab } from "@/components/settings/IntegrationTab";
import { AuditTrailTab } from "@/components/settings/AuditTrailTab";
import { LockGovernanceTab } from "@/components/settings/LockGovernanceTab";
import { KioskStaffPinCard } from "@/components/settings/KioskStaffPinCard";

import { SurveyBuilder } from "@/components/feedback/SurveyBuilder";
import { ScrollArea } from "@/components/ui/scroll-area";

const personTypes: SettingsSection[] = ["visitor", "contractor", "resident", "staff", "volunteer"];

export default function SettingsPage() {
  const [active, setActive] = useState<SettingsSection>("context");

  const isPersonType = personTypes.includes(active);

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex-1">
          <header className="sticky top-0 z-30 bg-card border-b border-border h-14 flex items-center justify-between px-6">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
              <div>
                <h1 className="text-xl font-bold text-foreground leading-tight">Settings</h1>
                <p className="text-[13px] text-muted-foreground">Decisions administrators make for this site.</p>
              </div>
            </div>
            <SiteSwitcher compact />
          </header>
          <main className="p-6">
            <div className="flex gap-6">
              {/* Settings Navigation */}
              <div className="sticky top-20 self-start">
                <SettingsNav active={active} onChange={setActive} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 max-w-3xl">
                <SettingsPageHeading
                  title={SECTION_META[active].title}
                  description={SECTION_META[active].description}
                  scopes={SECTION_META[active].scopes}
                />
                {isPersonType && <PersonTypeSettings type={active} />}
                {active === "context" && <OperatingContextTab />}
                {active === "person-types" && <PersonTypesTab />}
                {active === "feedback" && <SurveyBuilder />}
                {active === "presence" && <PresenceTab />}
                {active === "printing" && <PrintingTab />}
                {active === "keys" && <KeysPolicyTab />}

                {active === "compliance" && <ComplianceTab />}
                {active === "integration" && <IntegrationTab />}
                {active === "audit" && <AuditTrailTab />}
                {active === "governance" && (
                  <div className="space-y-6">
                    <LockGovernanceTab />
                    <KioskStaffPinCard />
                  </div>
                )}

              </div>
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
