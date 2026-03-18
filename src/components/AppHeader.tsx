import centrimLogo from "@/assets/centrim-life-logo.png";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { NotificationBell } from "@/components/NotificationBell";
import { Search, CalendarDays, Grid3X3, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface AppHeaderProps {
  /** Page title shown after the sidebar trigger */
  title?: string;
  /** Optional subtitle below the title */
  subtitle?: string;
  /** Right-side action buttons (page-specific) */
  actions?: React.ReactNode;
  /** Notification counts */
  overstayedCount?: number;
  overdueCount?: number;
  draftCount?: number;
  pendingCount?: number;
}

export function AppHeader({
  title,
  subtitle,
  actions,
  overstayedCount = 0,
  overdueCount = 0,
  draftCount = 0,
  pendingCount = 0,
}: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-10 bg-card border-b border-border">
      <div className="flex items-center justify-between px-6 h-14">
        {/* Left: sidebar trigger + page title */}
        <div className="flex items-center gap-4">
          <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
          {title && (
            <div>
              <h1 className="text-xl font-bold text-foreground leading-tight">{title}</h1>
              {subtitle && (
                <p className="text-[13px] text-muted-foreground">{subtitle}</p>
              )}
            </div>
          )}
        </div>

        {/* Right: facility badge + toolbar + page actions */}
        <div className="flex items-center gap-2">
          {/* Facility badge */}
          <div className="hidden lg:flex items-center gap-2 mr-2">
            <span className="text-[13px] text-muted-foreground font-medium">Sydney Care Centre</span>
            <Badge variant="outline" className="text-[10px] font-bold bg-primary/10 text-primary border-primary/30">
              RAC
            </Badge>
          </div>

          <div className="w-px h-5 bg-border" />

          {/* Icon toolbar */}
          <div className="flex items-center gap-0.5">
            <NotificationBell
              overstayedCount={overstayedCount}
              overdueCount={overdueCount}
              draftCount={draftCount}
              pendingCount={pendingCount}
            />
          </div>

          {/* Page-specific actions */}
          {actions && (
            <>
              <div className="w-px h-5 bg-border" />
              <div className="flex items-center gap-1.5">
                {actions}
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
