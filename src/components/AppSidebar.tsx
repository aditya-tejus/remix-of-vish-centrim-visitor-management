import { isOverstayedSync } from "@/hooks/useOverstayPolicy";
import centrimLogo from "@/assets/centrim-life-logo.png";
import {
  Settings, Home, Users, FolderOpen, Siren, MonitorSmartphone, LayoutDashboard,
  type LucideIcon,
} from "lucide-react";
import { buildNavigation, activeSection, activeChild, type NavSection } from "@/lib/navigation";

import {
  Sidebar, SidebarContent, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarMenuSub, SidebarMenuSubItem, SidebarMenuSubButton,
  SidebarHeader, SidebarFooter,
} from "@/components/ui/sidebar";
import { NavLink, useLocation } from "react-router-dom";
import { useVisitors } from "@/hooks/useVisitors";
import { useSite } from "@/contexts/SiteContext";
import { useOperatingContext } from "@/contexts/OperatingContext";

const SECTION_ICONS: Record<NavSection["key"], LucideIcon> = {
  today: LayoutDashboard,
  visitors: Users,
  residents: Home,
  records: FolderOpen,
};

const badgeClasses = {
  blue: "bg-sidebar-primary text-sidebar-primary-foreground",
  red: "bg-destructive text-destructive-foreground",
  amber: "bg-warning text-warning-foreground",
} as const;

export function AppSidebar() {
  const location = useLocation();
  const { visitors } = useVisitors();
  const { currentSite } = useSite();
  const { modules, terms } = useOperatingContext();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayNonResidents = visitors.filter((v) => v.type !== "resident" && v.checkInTime >= todayStart);
  const activeVisitorCount = todayNonResidents.filter((v) => v.status === "checked-in").length;
  const todayOverstayed = todayNonResidents.filter(isOverstayedSync).length;
  const residentsAwayCount = visitors.filter((v) => v.type === "resident" && v.status !== "checked-in").length;

  const model = buildNavigation(
    { foodRegister: !!modules.foodRegister, keysRegister: !!modules.keysRegister },
    terms.residentPlural
  );
  const current = activeSection(model, location.pathname);
  const currentChild = current ? activeChild(current, location.pathname) : null;

  const BADGES: Partial<Record<NavSection["key"], { count: number; variant: keyof typeof badgeClasses; label: string }>> = {
    visitors: todayOverstayed > 0
      ? { count: todayOverstayed, variant: "red", label: `${todayOverstayed} past their expected time` }
      : { count: activeVisitorCount, variant: "blue", label: `${activeVisitorCount} on site` },
    residents: { count: residentsAwayCount, variant: "amber", label: `${residentsAwayCount} away` },
  };

  const onEmergency = location.pathname === "/evacuation";
  const onSettings = location.pathname === "/settings";

  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarHeader className="px-5 py-5">
        <div className="flex min-w-0 items-center gap-2">
          <img src={centrimLogo} alt="Centrim Life" className="h-8 min-w-0 flex-1 object-contain object-left" />
          <span className="shrink-0 rounded bg-sidebar-primary/15 px-1.5 py-0.5 text-xs font-semibold tracking-wide text-sidebar-primary">
            Visitors
          </span>
        </div>
      </SidebarHeader>

      <div className="mx-4 h-px bg-sidebar-border" />

      <SidebarContent className="px-2 pt-3">
        <nav aria-label="Main" className="flex flex-1 flex-col">
          <SidebarMenu className="space-y-0.5 px-1">
            {model.sections.map((section) => {
              const isCurrent = current?.key === section.key;
              const Icon = SECTION_ICONS[section.key];
              const badge = BADGES[section.key];
              return (
                <SidebarMenuItem key={section.key}>
                  <SidebarMenuButton
                    asChild
                    isActive={isCurrent}
                    tooltip={section.title}
                    className={`min-h-touch h-11 gap-2.5 rounded-lg px-3 text-sm font-semibold ${
                      isCurrent
                        ? "bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-l-sidebar-primary"
                        : "text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground"
                    }`}
                  >
                    <NavLink to={section.path} aria-current={isCurrent && !section.children.length ? "page" : undefined}>
                      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span className="flex-1 text-left">{section.title}</span>
                      {badge && badge.count > 0 && (
                        <span
                          className={`${badgeClasses[badge.variant]} flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-xs font-bold`}
                          aria-label={badge.label}
                        >
                          {badge.count}
                        </span>
                      )}
                    </NavLink>
                  </SidebarMenuButton>

                  {/* Only the current section shows its pages */}
                  {isCurrent && section.children.length > 0 && (
                    <SidebarMenuSub className="mb-1 mt-0.5">
                      {section.children.map((child) => {
                        const on = currentChild?.path === child.path;
                        return (
                          <SidebarMenuSubItem key={child.path}>
                            <SidebarMenuSubButton
                              asChild
                              isActive={on}
                              className={`min-h-touch h-10 rounded-md px-3 text-sm ${
                                on ? "font-semibold text-sidebar-foreground" : "font-medium text-sidebar-muted hover:text-sidebar-foreground"
                              }`}
                            >
                              <NavLink to={child.path} aria-current={on ? "page" : undefined}>{child.title}</NavLink>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        );
                      })}
                    </SidebarMenuSub>
                  )}
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>

          {/* Emergency is an action, kept visible and apart from everyday navigation */}
          <div className="mt-auto px-1 pb-2 pt-4">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={onEmergency}
                  tooltip={model.emergency.title}
                  className={`min-h-touch h-11 gap-2.5 rounded-lg border border-destructive/40 px-3 text-sm font-semibold text-destructive-strong hover:bg-destructive/20 ${onEmergency ? "bg-destructive/15" : ""}`}
                >
                  <NavLink to={model.emergency.path} aria-current={onEmergency ? "page" : undefined}>
                    <Siren className="h-4 w-4 shrink-0 text-destructive-strong" aria-hidden="true" />
                    <span>{model.emergency.title}</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </div>
        </nav>
      </SidebarContent>

      <SidebarFooter className="px-3 pb-4">
        <div className="border-t border-sidebar-border pt-3">
          <p className="text-xs font-medium text-sidebar-muted">Current site</p>
          <p className="truncate text-sm font-semibold text-sidebar-foreground">
            {currentSite?.name ?? "No site selected"}
          </p>
          <div className="mt-2 flex gap-1" aria-label="Utilities">
            <NavLink
              to="/settings"
              aria-current={onSettings ? "page" : undefined}
              className={`flex min-h-touch flex-1 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground ${
                onSettings ? "bg-sidebar-accent text-sidebar-foreground" : "text-sidebar-muted"
              }`}
            >
              <Settings className="h-3.5 w-3.5" aria-hidden="true" /> Settings
            </NavLink>
            <a
              href="/kiosk"
              target="_blank"
              rel="noopener noreferrer"
              title="Opens the visitor kiosk in a new tab"
              className="flex min-h-touch flex-1 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-medium text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              <MonitorSmartphone className="h-3.5 w-3.5" aria-hidden="true" /> Kiosk
            </a>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
