import centrimLogo from "@/assets/centrim-life-logo.png";
import {
  Users, Settings, ClipboardList, UserPlus, BarChart3,
  Shield, Calendar, MessageSquare, AlertTriangle, LineChart,
  ChevronDown, DoorOpen, QrCode, Layers, CheckSquare,
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
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface NavItem {
  title: string;
  icon?: LucideIcon;
  path: string;
  badge?: number | null;
  badgeVariant?: "blue" | "red" | "amber" | "green";
  indent?: boolean;
  activeDot?: boolean;
}

interface NavGroup {
  label: string;
  icon: LucideIcon;
  iconColor: string;
  items: NavItem[];
  collapsible?: boolean;
}

export function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { visitors, overstayedCount } = useVisitors();
  const [pendingCheckoutRequests, setPendingCheckoutRequests] = useState(0);

  useEffect(() => {
    const fetchPending = async () => {
      const { count } = await supabase
        .from("leave_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      setPendingCheckoutRequests(count || 0);
    };
    fetchPending();
  }, []);

  const activeVisitorCount = visitors.filter(
    (v) => v.status === "checked-in" && v.type !== "resident"
  ).length;

  const residentsAwayCount = visitors.filter(
    (v) => v.type === "resident" && v.status !== "checked-in"
  ).length;

  const totalVisitorBadge = overstayedCount > 0 ? overstayedCount : null;

  const navGroups: NavGroup[] = [
    {
      label: "Visitors",
      icon: Users,
      iconColor: "text-blue-400",
      collapsible: true,
      items: [
        { title: "Visitor List", path: "/", badge: activeVisitorCount || null, badgeVariant: "blue", activeDot: true },
        { title: "Residents", path: "/residents", badge: residentsAwayCount || null, badgeVariant: "amber" },
        { title: "Visitor Profiles", path: "/visitors" },
        { title: "Evacuation Report", path: "/evacuation" },
      ],
    },
    {
      label: "Safety & Compliance",
      icon: Shield,
      iconColor: "text-amber-400",
      collapsible: true,
      items: [
        { title: "GDPR & Privacy", path: "/gdpr", indent: true },
        { title: "Audit Trail", path: "/audit-log", indent: true },
        { title: "Coverage Checklist", path: "/coverage", indent: true },
      ],
    },
    {
      label: "Insights",
      icon: BarChart3,
      iconColor: "text-violet-400",
      collapsible: true,
      items: [
        { title: "Reports", path: "/reports", indent: true },
        { title: "Visitor Analytics", path: "/visitor-analytics", indent: true },
        { title: "Visitor Feedback", path: "/feedback", indent: true },
      ],
    },
  ];

  const badgeClasses: Record<string, string> = {
    blue: "bg-blue-500 text-white",
    red: "bg-destructive text-destructive-foreground",
    amber: "bg-warning text-warning-foreground",
    green: "bg-success text-success-foreground",
  };

  const isGroupActive = (group: NavGroup) =>
    group.items.some((item) => location.pathname === item.path);

  return (
    <Sidebar className="border-r-0">
      <SidebarHeader className="px-5 py-4">
        <div className="flex items-center gap-3">
          <img src={centrimLogo} alt="Centrim Life" className="h-10 object-contain" />
          <span className="text-[11px] font-semibold tracking-wide text-sidebar-primary bg-sidebar-primary/15 rounded px-1.5 py-0.5">
            VMS
          </span>
        </div>
      </SidebarHeader>

      <div className="mx-4 h-px bg-sidebar-border" />

      <SidebarContent className="px-2 pt-3">
        {navGroups.map((group) => (
          <Collapsible key={group.label} defaultOpen={isGroupActive(group) || group.label === "Visitors"}>
            <SidebarGroup>
              <CollapsibleTrigger className="w-full">
                <SidebarGroupLabel className="flex items-center gap-2.5 text-[13px] font-semibold text-sidebar-foreground px-3 py-2 hover:bg-[rgba(255,255,255,0.05)] rounded-lg cursor-pointer transition-colors">
                  <group.icon className={`h-4 w-4 ${group.iconColor}`} />
                  <span className="flex-1 text-left">{group.label}</span>
                  {group.label === "Visitors" && totalVisitorBadge != null && totalVisitorBadge > 0 && (
                    <span className={`${badgeClasses["red"]} text-[10px] font-bold min-w-[20px] h-5 rounded-full flex items-center justify-center px-1.5`}>
                      {totalVisitorBadge}
                    </span>
                  )}
                  <ChevronDown className="h-3.5 w-3.5 text-sidebar-muted transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </SidebarGroupLabel>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu className="space-y-0.5 mt-1">
                    {group.items.map((item) => {
                      const active = location.pathname === item.path;
                      return (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton
                            onClick={() => navigate(item.path)}
                            isActive={active}
                            tooltip={item.title}
                            className={`rounded-lg h-8 text-[13px] font-medium gap-2 transition-all duration-150
                              ${item.indent ? "pl-10" : "pl-3"}
                              ${active
                                ? "bg-sidebar-accent text-sidebar-foreground"
                                : "text-sidebar-muted hover:bg-[rgba(255,255,255,0.05)] hover:text-sidebar-foreground"
                              }`}
                          >
                            {item.activeDot && active && (
                              <span className="h-1.5 w-1.5 rounded-full bg-sidebar-primary shrink-0" />
                            )}
                            <span className="flex-1">{item.title}</span>
                            {item.badge != null && item.badge > 0 && (
                              <span className={`${badgeClasses[item.badgeVariant || "blue"]} text-[10px] font-bold min-w-[20px] h-5 rounded-full flex items-center justify-center px-1.5`}>
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

        {/* Kiosk Mode link */}
        <div className="mt-2 px-1">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => window.open("/kiosk", "_blank")}
                tooltip="Kiosk Mode"
                className="rounded-lg h-8 text-[13px] font-medium gap-3 px-3 text-sidebar-muted hover:bg-[rgba(255,255,255,0.05)] hover:text-sidebar-foreground"
              >
                <Layers className="h-4 w-4 shrink-0 text-cyan-400" />
                <span>Kiosk Mode</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </div>

        {/* Settings */}
        <div className="mt-1">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => navigate("/settings")}
                isActive={location.pathname === "/settings"}
                tooltip="Settings"
                className={`rounded-lg h-9 text-[13px] font-medium gap-3 px-3 transition-all duration-150
                  ${location.pathname === "/settings"
                    ? "bg-sidebar-accent text-sidebar-foreground"
                    : "text-sidebar-muted hover:bg-[rgba(255,255,255,0.05)] hover:text-sidebar-foreground"
                  }`}
              >
                <Settings className="h-4 w-4 shrink-0 text-gray-400" />
                <span>Settings</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </div>
      </SidebarContent>

      <SidebarFooter className="px-3 pb-4">
        <div className="rounded-lg bg-sidebar-accent p-3">
          <p className="text-[11px] text-sidebar-muted font-medium">Care Home</p>
          <p className="text-[13px] text-sidebar-foreground font-semibold truncate">Sydney Care Centre</p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
