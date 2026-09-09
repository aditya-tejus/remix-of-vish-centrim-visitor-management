import { isOverstayedSync } from "@/hooks/useOverstayPolicy";
import centrimLogo from "@/assets/centrim-life-logo.png";
import {
  Settings, BarChart3, ChevronDown, Home, KeyRound, UtensilsCrossed, IdCard,
  ListChecks, Siren, MonitorSmartphone, LayoutDashboard, Users,
  type LucideIcon,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarFooter,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { NavLink, useLocation } from "react-router-dom";
import { useVisitors } from "@/hooks/useVisitors";
import { useSite } from "@/contexts/SiteContext";
import { useOperatingContext } from "@/contexts/OperatingContext";

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
  const location = useLocation();
  const { visitors } = useVisitors();
  const { currentSite } = useSite();
  const { modules, terms } = useOperatingContext();

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
    ...(modules.keysRegister || modules.foodRegister
      ? [{
          label: "Registers",
          icon: KeyRound,
          items: [
            ...(modules.foodRegister ? [{ title: "Food Register", path: "/food-register", icon: UtensilsCrossed }] : []),
            ...(modules.keysRegister ? [{ title: "Keys & Fob Register", path: "/keys", icon: KeyRound }] : []),
          ],
        }]
      : []),
    {
      label: "Reports",
      icon: BarChart3,
      items: [
        { title: "Visitor Report", path: "/reports/visitor-report" },
        { title: "Feedback Responses", path: "/reports/feedback-responses" },
        { title: "Feedback Reports", path: "/reports/feedback-reports" },
        { title: "Safety & Compliance", path: "/gdpr" },
        { title: "Presence Log", path: "/reports/presence" },
        { title: "Audit Log", path: "/audit-log" },
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

  const primaryItems: (NavItem & { match: string[] })[] = [
    { title: "Today", path: "/today", icon: LayoutDashboard, match: ["/today", "/"], badge: null },
    {
      title: "Visitor List", path: "/visit-list", icon: ListChecks, match: ["/visit-list"],
      badge: todayOverstayed || activeVisitorCount || null,
      badgeVariant: todayOverstayed > 0 ? "red" : "blue",
    },
    { title: terms.residentPlural, path: "/residents", icon: Home, match: ["/residents"], badge: residentsAwayCount || null, badgeVariant: "amber" },
    { title: "Visitor Profiles", path: "/visitors", icon: IdCard, match: ["/visitors"], badge: null },
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
        <nav aria-label="Main">
        {/* Primary surfaces */}
        <SidebarMenu className="space-y-0.5 px-1 pb-2">
          {primaryItems.map((item) => {
            const active = item.match.includes(location.pathname);
            const Icon = item.icon ?? Home;
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  isActive={active}
                  tooltip={item.title}
                  className={`h-10 gap-2.5 rounded-lg px-3 text-[13px] font-semibold ${
                    active
                      ? "bg-sidebar-accent text-sidebar-foreground"
                      : "text-sidebar-muted hover:bg-[rgba(255,255,255,0.05)] hover:text-sidebar-foreground"
                  }`}
                >
                  <NavLink to={item.path} aria-current={active ? "page" : undefined}>
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />

                    <span className="flex-1 text-left">{item.title}</span>
                    {item.badge != null && item.badge > 0 && (
                      <span className={`${badgeClasses[item.badgeVariant || "blue"]} flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold`}>
                        {item.badge}
                      </span>
                    )}

                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>


        {navGroups.map((group) => (
          <Collapsible
            key={group.label}
            defaultOpen={isGroupActive(group)}
            className="group/nav-group"
          >
            <SidebarGroup>
              <SidebarGroupLabel asChild>
                <CollapsibleTrigger className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-semibold text-sidebar-foreground transition-colors hover:bg-[rgba(255,255,255,0.05)]">
                  <group.icon className="h-4 w-4 text-sidebar-muted" aria-hidden="true" />
                  <span className="flex-1 text-left">{group.label}</span>
                  <ChevronDown
                    className="h-3.5 w-3.5 text-sidebar-muted transition-transform duration-200 group-data-[state=open]/nav-group:rotate-180"
                    aria-hidden="true"
                  />
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu className="mt-1 space-y-0.5">
                    {group.items.map((item) => {
                      const active = location.pathname === item.path;
                      return (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton
                            asChild
                            isActive={active}
                            tooltip={item.title}
                            className={`h-9 gap-2 rounded-lg pl-9 text-[13px] font-medium transition-all duration-150
                              ${active
                                ? "bg-sidebar-accent text-sidebar-foreground"
                                : "text-sidebar-muted hover:bg-[rgba(255,255,255,0.05)] hover:text-sidebar-foreground"
                              }`}
                          >
                            <NavLink to={item.path} aria-current={active ? "page" : undefined}>
                              <span className="flex-1">{item.title}</span>
                              {item.badge != null && item.badge > 0 && (
                                <span className={`${badgeClasses[item.badgeVariant || "blue"]} flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold`}>
                                  {item.badge}
                                </span>
                              )}
                            </NavLink>
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

        {/* Settings, emergency and kiosk — always visible */}
        <div className="mt-2 px-1">
          <SidebarMenu className="space-y-0.5">
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={location.pathname === "/settings"}
                tooltip="Settings"
                className={`h-10 gap-2.5 rounded-lg px-3 text-[13px] font-semibold ${
                  location.pathname === "/settings"
                    ? "bg-sidebar-accent text-sidebar-foreground"
                    : "text-sidebar-muted hover:bg-[rgba(255,255,255,0.05)] hover:text-sidebar-foreground"
                }`}
              >
                <NavLink to="/settings" aria-current={location.pathname === "/settings" ? "page" : undefined}>
                  <Settings className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="flex-1 text-left">Settings</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={location.pathname === "/evacuation"}
                tooltip="Emergency Roll Call"
                className="h-9 gap-2.5 rounded-lg border border-destructive/40 px-3 text-[13px] font-semibold text-destructive-foreground/90 hover:bg-destructive/20"
              >
                <NavLink to="/evacuation" aria-current={location.pathname === "/evacuation" ? "page" : undefined}>
                  <Siren className="h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
                  <span>Emergency Roll Call</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                tooltip="Kiosk Mode opens in a new tab"
                className="h-9 gap-2.5 rounded-lg px-3 text-[13px] font-medium text-sidebar-muted hover:bg-[rgba(255,255,255,0.05)] hover:text-sidebar-foreground"
              >
                <a href="/kiosk" target="_blank" rel="noopener noreferrer">
                  <MonitorSmartphone className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>Kiosk Mode (new tab)</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </div>
        </nav>
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
