import { isOverstayedSync } from "@/hooks/useOverstayPolicy";
import centrimLogo from "@/assets/centrim-life-logo.png";
import {
  Users, Settings, BarChart3, ChevronDown, Layers, Home, ClipboardList,
  KeyRound, UtensilsCrossed, IdCard, ListChecks, Siren, DoorOpen,
  type LucideIcon,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarFooter,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useNavigate, useLocation } from "react-router-dom";
import { useVisitors } from "@/hooks/useVisitors";
import { useSite } from "@/contexts/SiteContext";

interface NavItem {
  title: string;
  icon?: LucideIcon;
  path: string;
  badge?: number | null;
  badgeVariant?: "blue" | "red" | "amber" | "green";
}

interface NavGroup {
  label: string;
  icon: LucideIcon;
  items: NavItem[];
}

export function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { visitors } = useVisitors();
  const { currentSite } = useSite();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayNonResidents = visitors.filter(
    (v) => v.type !== "resident" && v.checkInTime >= todayStart
  );
  const activeVisitorCount = todayNonResidents.filter((v) => v.status === "checked-in").length;
  const todayOverstayed = todayNonResidents.filter(isOverstayedSync).length;
  const residentsAwayCount = visitors.filter(
    (v) => v.type === "resident" && v.status !== "checked-in"
  ).length;

  const navGroups: NavGroup[] = [
    {
      label: "Visitor operations",
      icon: Users,
      items: [
        { title: "Visit list", path: "/visit-list", icon: ListChecks, badge: activeVisitorCount || null, badgeVariant: "blue" },
        { title: "Overdue", path: "/visit-list", icon: Layers, badge: todayOverstayed || null, badgeVariant: "red" },
        { title: "Presence log", path: "/reports/presence", icon: ClipboardList },
        { title: "Visitor profiles", path: "/visitors", icon: IdCard },
      ],
    },
    {
      label: "People and movements",
      icon: DoorOpen,
      items: [
        { title: "Residents", path: "/residents", icon: Home, badge: residentsAwayCount || null, badgeVariant: "amber" },
        { title: "Planner", path: "/calendar", icon: ClipboardList },
      ],
    },
    {
      label: "Registers",
      icon: KeyRound,
      items: [
        { title: "Keys and fobs", path: "/keys", icon: KeyRound },
        { title: "Food register", path: "/food-register", icon: UtensilsCrossed },
      ],
    },
    {
      label: "Reports",
      icon: BarChart3,
      items: [
        { title: "Visitor reports", path: "/reports" },
        { title: "Feedback responses", path: "/reports/feedback-responses" },
        { title: "Feedback reports", path: "/reports/feedback-reports" },
        { title: "Safety and compliance", path: "/gdpr" },
      ],
    },
    {
      label: "Administration",
      icon: Settings,
      items: [
        { title: "Settings", path: "/settings" },
        { title: "Audit trail", path: "/audit-log" },
      ],
    },
  ];

  const badgeClasses: Record<string, string> = {
    blue: "bg-sidebar-primary text-sidebar-primary-foreground",
    red: "bg-destructive text-destructive-foreground",
    amber: "bg-warning text-warning-foreground",
    green: "bg-success text-success-foreground",
  };

  const isGroupActive = (group: NavGroup) =>
    group.items.some((item) => location.pathname === item.path);

  const primaryItems = [
    { title: "Visit list", path: "/", icon: ListChecks, match: ["/", "/visit-list"], badge: activeVisitorCount || null },
    { title: "Today", path: "/today", icon: Home, match: ["/today"], badge: null as number | null },
  ];

  return (
    <Sidebar className="border-r-0">
      <SidebarHeader className="px-5 py-4">
        <div className="flex min-w-0 items-center gap-2">
          <img src={centrimLogo} alt="Centrim Life" className="h-9 min-w-0 flex-1 object-contain object-left" />
          <span className="shrink-0 rounded bg-sidebar-primary/15 px-1.5 py-0.5 text-[11px] font-semibold tracking-wide text-sidebar-primary">
            Visitors
          </span>
        </div>
      </SidebarHeader>

      <div className="mx-4 h-px bg-sidebar-border" />

      <SidebarContent className="px-2 pt-3">
        {/* Primary surfaces */}
        <SidebarMenu className="space-y-0.5 px-1 pb-2">
          {primaryItems.map((item) => {
            const active = item.match.includes(location.pathname);
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  onClick={() => navigate(item.path)}
                  isActive={active}
                  tooltip={item.title}
                  className={`h-10 gap-2.5 rounded-lg px-3 text-[13px] font-semibold ${
                    active
                      ? "bg-sidebar-accent text-sidebar-foreground"
                      : "text-sidebar-muted hover:bg-[rgba(255,255,255,0.05)] hover:text-sidebar-foreground"
                  }`}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1 text-left">{item.title}</span>
                  {item.badge != null && item.badge > 0 && (
                    <span className={`${badgeClasses.blue} flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold`}>
                      {item.badge}
                    </span>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>


        {navGroups.map((group) => (
          <Collapsible key={group.label} defaultOpen={isGroupActive(group) || group.label === "Visitor operations"}>
            <SidebarGroup>
              <CollapsibleTrigger className="w-full">
                <SidebarGroupLabel className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-semibold text-sidebar-foreground transition-colors hover:bg-[rgba(255,255,255,0.05)]">
                  <group.icon className="h-4 w-4 text-sidebar-muted" />
                  <span className="flex-1 text-left">{group.label}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-sidebar-muted transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </SidebarGroupLabel>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu className="mt-1 space-y-0.5">
                    {group.items.map((item) => {
                      const active = location.pathname === item.path;
                      return (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton
                            onClick={() => navigate(item.path)}
                            isActive={active}
                            tooltip={item.title}
                            className={`h-9 gap-2 rounded-lg pl-9 text-[13px] font-medium transition-all duration-150
                              ${active
                                ? "bg-sidebar-accent text-sidebar-foreground"
                                : "text-sidebar-muted hover:bg-[rgba(255,255,255,0.05)] hover:text-sidebar-foreground"
                              }`}
                          >
                            <span className="flex-1">{item.title}</span>
                            {item.badge != null && item.badge > 0 && (
                              <span className={`${badgeClasses[item.badgeVariant || "blue"]} flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold`}>
                                {item.badge}
                              </span>
                            )}
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        ))}

        {/* Emergency — always visible, visually distinct, never noisy */}
        <div className="mt-2 px-1">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => navigate("/evacuation")}
                isActive={location.pathname === "/evacuation"}
                tooltip="Emergency roll call"
                className="h-9 gap-2.5 rounded-lg border border-destructive/40 px-3 text-[13px] font-semibold text-destructive-foreground/90 hover:bg-destructive/20"
              >
                <Siren className="h-4 w-4 shrink-0 text-destructive" />
                <span>Emergency roll call</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => window.open("/kiosk", "_blank")}
                tooltip="Open kiosk"
                className="h-9 gap-2.5 rounded-lg px-3 text-[13px] font-medium text-sidebar-muted hover:bg-[rgba(255,255,255,0.05)] hover:text-sidebar-foreground"
              >
                <Layers className="h-4 w-4 shrink-0" />
                <span>Open kiosk</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </div>
      </SidebarContent>

      <SidebarFooter className="px-3 pb-4">
        <div className="rounded-lg bg-sidebar-accent p-3">
          <p className="text-[11px] font-medium text-sidebar-muted">Current site</p>
          <p className="truncate text-[13px] font-semibold text-sidebar-foreground">
            {currentSite?.name ?? "No site selected"}
          </p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
