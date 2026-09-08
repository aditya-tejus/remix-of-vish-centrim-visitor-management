import { cn } from "@/lib/utils";
import { Users, HardHat, Home, UserCog, Heart, Globe, Printer, Shield, Link2, ClipboardList, Lock, MessageSquare, KeyRound } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export type SettingsSection =
  | "visitor" | "contractor" | "resident" | "staff" | "volunteer"
  | "person-types"
  | "presence" | "printing" | "keys" | "compliance" | "integration" | "audit" | "governance" | "feedback";


interface PersonType {
  id: SettingsSection;
  label: string;
  icon: typeof Users;
  color: string;
}

const personTypes: PersonType[] = [
  { id: "visitor", label: "Visitors", icon: Users, color: "bg-primary" },
  { id: "contractor", label: "Contractors", icon: HardHat, color: "bg-amber-500" },
  { id: "resident", label: "Residents", icon: Home, color: "bg-emerald-500" },
  { id: "staff", label: "Staff", icon: UserCog, color: "bg-violet-500" },
  { id: "volunteer", label: "Volunteers", icon: Heart, color: "bg-rose-500" },
];

const globalSections: PersonType[] = [
  { id: "feedback", label: "Feedback Surveys", icon: MessageSquare, color: "bg-muted-foreground" },
  { id: "presence", label: "Presence", icon: Globe, color: "bg-muted-foreground" },
  { id: "printing", label: "Printing", icon: Printer, color: "bg-muted-foreground" },
  { id: "keys", label: "Keys & Fobs", icon: KeyRound, color: "bg-muted-foreground" },
  { id: "compliance", label: "GDPR", icon: Shield, color: "bg-muted-foreground" },
  { id: "integration", label: "Integration", icon: Link2, color: "bg-muted-foreground" },
  { id: "audit", label: "Audit Trail", icon: ClipboardList, color: "bg-muted-foreground" },
  { id: "governance", label: "Governance", icon: Lock, color: "bg-muted-foreground" },
];


interface SettingsNavProps {
  active: SettingsSection;
  onChange: (section: SettingsSection) => void;
}

export function SettingsNav({ active, onChange }: SettingsNavProps) {
  return (
    <nav className="w-[200px] shrink-0 space-y-1">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-3 py-2">
        Person Types
      </p>
      {personTypes.map((item) => {
        const Icon = item.icon;
        const isActive = active === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onChange(item.id)}
            className={cn(
              "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors text-left",
              isActive
                ? "bg-muted text-foreground border-l-[3px] border-primary pl-[9px]"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <span className={cn("h-2 w-2 rounded-full shrink-0", item.color)} />
            <Icon className="h-4 w-4 shrink-0" />
            <span>{item.label}</span>
          </button>
        );
      })}

      <Separator className="my-3" />

      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-3 py-2">
        Global
      </p>
      {globalSections.map((item) => {
        const Icon = item.icon;
        const isActive = active === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onChange(item.id)}
            className={cn(
              "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors text-left",
              isActive
                ? "bg-muted text-foreground border-l-[3px] border-primary pl-[9px]"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
