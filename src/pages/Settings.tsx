import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { SettingsNav, SettingsSection, SECTION_META } from "@/components/settings/SettingsNav";
import { SettingsPageHeading } from "@/components/settings/SettingsScope";
import { PersonTypeSettings } from "@/components/settings/PersonTypeSettings";
import { PersonTypesTab } from "@/components/settings/PersonTypesTab";
import { OperatingContextTab } from "@/components/settings/OperatingContextTab";
import { PresenceTab } from "@/components/settings/PresenceTab";
import { PrintingTab } from "@/components/settings/PrintingTab";
import { KeysPolicyTab } from "@/components/settings/KeysPolicyTab";

import { ContractorDocumentRulesCard } from "@/components/settings/ContractorDocumentRulesCard";
import { ComplianceTab } from "@/components/settings/ComplianceTab";
import { IntegrationTab } from "@/components/settings/IntegrationTab";
import { AuditTrailTab } from "@/components/settings/AuditTrailTab";
import { LockGovernanceTab } from "@/components/settings/LockGovernanceTab";
import { KioskStaffPinCard } from "@/components/settings/KioskStaffPinCard";
import { KioskDevicesCard } from "@/components/settings/KioskDevicesCard";

import { SurveyBuilder } from "@/components/feedback/SurveyBuilder";
import { AttendanceIntegrityCard } from "@/components/settings/AttendanceIntegrityCard";
import { DemoDataCard } from "@/components/settings/DemoDataCard";
import { SettingsSectionHeader } from "@/components/settings/SettingsSectionHeader";
import { PreviewPanel } from "@/components/settings/preview/PreviewPanel";
import { useSettingsAccess } from "@/hooks/useSettingsAccess";
import { SettingsAccessProvider } from "@/components/settings/SettingsAccessContext";
import { ReadOnlyFence } from "@/components/settings/ReadOnlyFence";
import { PersonTypesDraftProvider } from "@/components/settings/preview/personTypesDraft";

const personTypes: SettingsSection[] = ["visitor", "contractor", "resident", "staff", "volunteer"];

/** Sections where seeing the result before saving genuinely helps. */
const PREVIEW_SECTIONS: SettingsSection[] = [
  "person-types", "visitor", "contractor", "volunteer", "staff", "printing", "context",
];

/** Honest note about where each section's values are stored today. */
const STORAGE_NOTE: Partial<Record<SettingsSection, string>> = {
  context: "Stored on the site record itself, so it applies to this site only.",
  "person-types": "Saved for this site. Sites without their own value fall back to the account-wide value.",
  visitor: "Saved once for the whole account, separately for each visitor type. Every site sees the same values.",
  contractor: "Saved once for the whole account, separately for each visitor type. Every site sees the same values.",
  volunteer: "Saved once for the whole account, separately for each visitor type. Every site sees the same values.",
  staff: "Saved once for the whole account, separately for each visitor type. Every site sees the same values.",
  resident: "Saved once for the whole account, separately for each visitor type. Every site sees the same values. Contractor credential rules are the exception and are saved per site.",
  presence: "Saved once for the whole account. Every site sees the same values.",
  printing: "Saved once for the whole account — there is one badge setup, not one per site.",
  keys: "Saved once for the whole account. Every site sees the same key and fob rules.",
  feedback: "Saved once for the whole account.",
  compliance: "A checklist record, not a setting. Saved once for the whole account.",
  governance: "Saved once for the whole account. The kiosk code is stored scrambled and is never shown again.",
  audit: "A record of what happened, not a setting. Nothing here is saved.",
  integration: "A description of what could connect. Nothing is connected and nothing is saved.",
};

/** Applies the read-only fence, except where a section saves nothing. */
function SectionBody({ fenced, children }: { fenced: boolean; children: React.ReactNode }) {
  if (!fenced) return <>{children}</>;
  return <ReadOnlyFence>{children}</ReadOnlyFence>;
}

export default function SettingsPage() {
  const [active, setActive] = useState<SettingsSection>("context");
  const access = useSettingsAccess(active);

  const isPersonType = personTypes.includes(active);
  // Audit and exports saves nothing; its export button keeps its own narrower permission.
  const fenced = active !== "audit";


  return (
    <SettingsAccessProvider
      value={{ canEdit: access.canEdit, audience: access.audience, deniedReason: access.deniedReason }}
    >
    <PersonTypesDraftProvider>
    <AppShell
      title="Settings"
      subtitle="Decisions administrators make for this site."
      mainClassName="p-4 sm:p-6"
    >
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Settings Navigation */}
              <div className="lg:sticky lg:top-20 self-start w-full lg:w-auto">
                <SettingsNav active={active} onChange={setActive} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 max-w-3xl">
                <SettingsPageHeading
                  title={SECTION_META[active].title}
                  description={SECTION_META[active].description}
                  scopes={SECTION_META[active].scopes}
                />
                <SettingsSectionHeader
                  purpose={SECTION_META[active].description}
                  audience={access.audience}
                  canEdit={access.canEdit}
                  deniedReason={access.deniedReason}
                  storageNote={STORAGE_NOTE[active]}
                />
                <SectionBody fenced={fenced}>
                  {isPersonType && <PersonTypeSettings type={active} readOnly={!access.canEdit} />}
                  {active === "context" && <OperatingContextTab />}
                  {active === "person-types" && <PersonTypesTab />}
                  {active === "feedback" && <SurveyBuilder />}
                  {active === "presence" && <PresenceTab />}
                  {active === "printing" && <PrintingTab />}
                  {active === "keys" && <KeysPolicyTab />}
                  {active === "compliance" && (
                    <div className="space-y-6">
                      <ComplianceTab />
                      <ContractorDocumentRulesCard />
                    </div>
                  )}
                  {active === "integration" && <IntegrationTab />}
                  {active === "audit" && (
                    <div className="space-y-6">
                      <AuditTrailTab />
                      <AttendanceIntegrityCard />
                      <DemoDataCard />
                    </div>
                  )}
                  {active === "governance" && (
                    <div className="space-y-6">
                      <LockGovernanceTab />
                      <KioskStaffPinCard />
                      <KioskDevicesCard />
                    </div>
                  )}
                </SectionBody>
              </div>

              {/* See the result before saving */}
              {PREVIEW_SECTIONS.includes(active) && (
                <aside className="w-full xl:w-[360px] shrink-0 xl:sticky xl:top-20 self-start">
                  <PreviewPanel defaultType={isPersonType && active !== "resident" ? active : "visitor"} />
                </aside>
              )}

            </div>
    </AppShell>
    </PersonTypesDraftProvider>
    </SettingsAccessProvider>
  );
}
