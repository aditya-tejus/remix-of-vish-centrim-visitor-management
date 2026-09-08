import { cn } from "@/lib/utils";
import {
  Users, HardHat, Home, UserCog, Heart, Globe, Printer, Shield, Link2,
  ClipboardList, Lock, MessageSquare, KeyRound, Layers, type LucideIcon,
} from "lucide-react";
import type { SettingsScopeLevel } from "@/components/settings/SettingsScope";

export type SettingsSection =
  | "context"
  | "visitor" | "contractor" | "resident" | "staff" | "volunteer"
  | "person-types"
  | "presence" | "printing" | "keys" | "compliance" | "integration" | "audit" | "governance" | "feedback";

interface SectionMeta {
  id: SettingsSection;
  label: string;
  icon: LucideIcon;
  title: string;
  description: string;
  scopes: SettingsScopeLevel[];
}

/** Grouped by the decision an administrator is making, not by table or feature name. */
export const SETTINGS_GROUPS: { label: string; items: SectionMeta[] }[] = [
  {
    label: "How this site runs",
    items: [
      {
        id: "context", label: "Operating context", icon: Layers,
        title: "Operating context",
        description: "The kind of place this site is, the words it uses and which registers apply. Administrators only.",
        scopes: ["jurisdiction", "organisation", "site"],
      },
    ],
  },
  {
    label: "Who comes on site",
    items: [
      {
        id: "person-types", label: "Visitor types", icon: Users,
        title: "Visitor types",
        description: "Choose which types of people can sign in, and what each one is called on the kiosk.",
        scopes: ["site", "person-type"],
      },
      {
        id: "visitor", label: "Visitors", icon: Users,
        title: "Visitors",
        description: "Sign-in details, check-in questions, kiosk behaviour and reminders for visitors.",
        scopes: ["site", "person-type"],
      },
      {
        id: "contractor", label: "Contractors", icon: HardHat,
        title: "Contractors",
        description: "Company and worker checks, required documents and what happens when something is missing.",
        scopes: ["site", "person-type"],
      },
      {
        id: "volunteer", label: "Volunteers", icon: Heart,
        title: "Volunteers",
        description: "Sign-in details, questions and reminders for volunteers.",
        scopes: ["site", "person-type"],
      },
      {
        id: "staff", label: "Staff", icon: UserCog,
        title: "Staff",
        description: "Staff sign-in, shift overrun alerts and end-of-shift sign-out.",
        scopes: ["site", "person-type", "role"],
      },
    ],
  },
  {
    label: "Residents and movements",
    items: [
      {
        id: "resident", label: "Resident movements", icon: Home,
        title: "Resident movements",
        description: "Leave and outing details, questions before departure, and return reminders.",
        scopes: ["site", "area"],
      },
      {
        id: "presence", label: "Presence and emergency", icon: Globe,
        title: "Presence and emergency response",
        description: "Who is counted as on site, visitor limits, outbreak mode and roll-call behaviour.",
        scopes: ["site"],
      },
    ],
  },
  {
    label: "Registers",
    items: [
      {
        id: "keys", label: "Keys and fobs", icon: KeyRound,
        title: "Keys and fobs",
        description: "Loan periods, overdue handling, permanent holdings and replacements.",
        scopes: ["organisation", "site"],
      },
      {
        id: "printing", label: "Badges and printing", icon: Printer,
        title: "Badges and printing",
        description: "What is printed on a badge and how badges are produced at the desk.",
        scopes: ["site"],
      },
      {
        id: "feedback", label: "Feedback surveys", icon: MessageSquare,
        title: "Feedback surveys",
        description: "Questions asked after a visit and where the answers appear.",
        scopes: ["site", "person-type"],
      },
    ],
  },
  {
    label: "Governance",
    items: [
      {
        id: "compliance", label: "Privacy and retention", icon: Shield,
        title: "Privacy and retention",
        description: "Privacy wording, how long records are kept, legal holds and information requests.",
        scopes: ["jurisdiction", "organisation"],
      },
      {
        id: "governance", label: "Users and access", icon: Lock,
        title: "Users and access",
        description: "Who can change settings, record locking and the kiosk staff code.",
        scopes: ["organisation", "role"],
      },
      {
        id: "audit", label: "Audit and exports", icon: ClipboardList,
        title: "Audit and exports",
        description: "A record of every configuration change, and exports for inspections.",
        scopes: ["organisation", "site"],
      },
      {
        id: "integration", label: "Integrations", icon: Link2,
        title: "Integrations",
        description: "Connections to the rest of Centrim Life and to on-site equipment.",
        scopes: ["organisation"],
      },
    ],
  },
];

export const SECTION_META: Record<SettingsSection, SectionMeta> = Object.fromEntries(
  SETTINGS_GROUPS.flatMap((g) => g.items).map((i) => [i.id, i])
) as Record<SettingsSection, SectionMeta>;

interface SettingsNavProps {
  active: SettingsSection;
  onChange: (section: SettingsSection) => void;
}

export function SettingsNav({ active, onChange }: SettingsNavProps) {
  return (
    <nav className="w-full lg:w-[220px] shrink-0 space-y-5" aria-label="Settings sections">
      {SETTINGS_GROUPS.map((group) => (
        <div key={group.label} className="space-y-1">
          <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {group.label}
          </p>
          {group.items.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onChange(item.id)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex w-full min-h-[40px] items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-medium transition-colors",
                  isActive
                    ? "border-l-[3px] border-primary bg-muted pl-[9px] text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
