import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Users, HardHat, Home, UserCog, Heart, ClipboardList, Users2, Stethoscope, Syringe, Camera, ScrollText, Bell, Zap, DoorOpen, CalendarClock, Search, Building2, ShieldCheck, UserSearch } from "lucide-react";
import { FormFieldsManager } from "@/components/settings/FormFieldsManager";
import { CompanionFieldsManager } from "@/components/settings/CompanionFieldsManager";
import { HealthQuestionsManager } from "@/components/settings/HealthQuestionsManager";
import { VaccinationFieldsManager } from "@/components/settings/VaccinationFieldsManager";
import { PhotoSignatureSettings } from "@/components/settings/PhotoSignatureSettings";
import { TermsSettingsPerType } from "@/components/settings/TermsSettingsPerType";
import { AlertSettingsPerType } from "@/components/settings/AlertSettingsPerType";
import { AutomationSettingsPerType } from "@/components/settings/AutomationSettingsPerType";

import { ResidentLeaveSettingsTab } from "@/components/settings/ResidentLeaveSettingsTab";
import { ResidentPrivacyTab } from "@/components/settings/ResidentPrivacyTab";
import { StaffPrivacyTab } from "@/components/settings/StaffPrivacyTab";
import { ReturnNotificationSettingsTab } from "@/components/settings/ReturnNotificationSettingsTab";
import type { VisitorType } from "@/hooks/useHealthQuestions";
import type { SettingsSection } from "./SettingsNav";

interface PersonTypeConfig {
  id: SettingsSection;
  label: string;
  description: string;
  icon: typeof Users;
  color: string;
  dotColor: string;
  visitorType: string;
  sections: SectionConfig[];
}

interface SectionConfig {
  id: string;
  label: string;
  icon: typeof ClipboardList;
  badge?: string;
  component: React.ReactNode;
}

const personTypeConfigs: Record<string, Omit<PersonTypeConfig, "sections">> = {
  visitor: { id: "visitor", label: "Visitor Settings", description: "Configure check-in fields, screening, and automation for visitor check-ins.", icon: Users, color: "text-primary", dotColor: "bg-primary/10", visitorType: "visitor" },
  contractor: { id: "contractor", label: "Contractor Settings", description: "Configure contractor check-in, supplier management, and screening.", icon: HardHat, color: "text-amber-500", dotColor: "bg-amber-500/10", visitorType: "contractor" },
  resident: { id: "resident", label: "Resident Settings", description: "Configure directory display, leave management, and resident notifications.", icon: Home, color: "text-emerald-500", dotColor: "bg-emerald-500/10", visitorType: "resident" },
  staff: { id: "staff", label: "Staff Settings", description: "Configure staff check-in fields and badge settings.", icon: UserCog, color: "text-violet-500", dotColor: "bg-violet-500/10", visitorType: "staff" },
  volunteer: { id: "volunteer", label: "Volunteer Settings", description: "Configure volunteer check-in, screening, and compliance.", icon: Heart, color: "text-rose-500", dotColor: "bg-rose-500/10", visitorType: "volunteer" },
};

function getSections(type: string): SectionConfig[] {
  const vt = type as VisitorType;
  const sections: SectionConfig[] = [];

  // Type-specific sections first
  if (type === "resident") {
    sections.push(
      { id: "resident-privacy", label: "Directory Display", icon: ShieldCheck, component: <ResidentPrivacyTab personType={type} /> },
      { id: "leave", label: "Leave Configuration", icon: DoorOpen, component: <ResidentLeaveSettingsTab /> },
      { id: "returns", label: "Return Notifications", icon: CalendarClock, component: <ReturnNotificationSettingsTab /> },
    );
  }

  // Resident & staff privacy for visitor & volunteer
  if (["visitor", "volunteer"].includes(type)) {
    sections.push(
      { id: "resident-privacy", label: "Resident Privacy on Kiosk", icon: ShieldCheck, component: <ResidentPrivacyTab personType={type} /> },
      { id: "staff-privacy", label: "Staff Lookup on Kiosk", icon: UserSearch, component: <StaffPrivacyTab personType={type} /> },
    );
  }

  // Common sections
  if (type !== "resident") {
    sections.push(
      { id: "form-fields", label: "Check-In Form Fields", icon: ClipboardList, component: <FormFieldsManager visitorType={vt} /> },
    );
  }

  if (["visitor", "volunteer"].includes(type)) {
    sections.push(
      { id: "companions", label: "Companion Fields", icon: Users2, component: <CompanionFieldsManager visitorType={vt} /> },
    );
  }

  if (["visitor", "contractor", "volunteer"].includes(type)) {
    sections.push(
      { id: "health", label: "Check-in Questions", icon: Stethoscope, component: <HealthQuestionsManager visitorType={vt} /> },
      { id: "vaccination", label: "Vaccination Records", icon: Syringe, component: <VaccinationFieldsManager visitorType={vt} /> },
    );
  }

  // Photo & Signature for all
  sections.push(
    { id: "photo", label: "Photo & Signature", icon: Camera, component: <PhotoSignatureSettings personType={type} /> },
  );

  // T&C for all person types
  sections.push(
    { id: "terms", label: "Terms & Conditions", icon: ScrollText, component: <TermsSettingsPerType personType={type} /> },
  );

  // Alerts for all except resident (residents use leave-based alerts)
  if (type !== "resident") {
    sections.push(
      { id: "alerts", label: "Alerts & Thresholds", icon: Bell, component: <AlertSettingsPerType personType={type} /> },
    );
  }

  // Automation for all except resident
  if (type !== "resident") {
    sections.push(
      { id: "automation", label: "Automation", icon: Zap, component: <AutomationSettingsPerType personType={type} /> },
    );
  }


  return sections;
}

interface Props {
  type: string;
}

export function PersonTypeSettings({ type }: Props) {
  const config = personTypeConfigs[type];
  if (!config) return null;

  const sections = getSections(type);
  const Icon = config.icon;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", config.dotColor)}>
          <Icon className={cn("h-5 w-5", config.color)} />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">{config.label}</h2>
          <p className="text-xs text-muted-foreground">{config.description}</p>
        </div>
      </div>

      {/* Accordion sections */}
      <Accordion type="multiple" defaultValue={[sections[0]?.id]} className="space-y-2">
        {sections.map((section) => {
          const SIcon = section.icon;
          return (
            <AccordionItem key={section.id} value={section.id} className="rounded-xl border border-border bg-card overflow-hidden">
              <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/30 [&[data-state=open]]:bg-muted/20">
                <div className="flex items-center gap-2.5 text-left">
                  <SIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium text-foreground">{section.label}</span>
                  {section.badge && (
                    <Badge variant="secondary" className="text-[10px] h-5">{section.badge}</Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 pt-2">
                {section.component}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
