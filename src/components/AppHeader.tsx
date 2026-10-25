import { useState, useEffect } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { NotificationBell } from "@/components/NotificationBell";
import { Clock, Users, ShieldAlert, type LucideIcon } from "lucide-react";
import { SiteSwitcher } from "@/components/SiteSwitcher";
import { format } from "date-fns";
import { useHealthAlerts } from "@/hooks/useHealthAlerts";
import { useOccupancy } from "@/hooks/useOccupancy";
import { useOutbreakMode } from "@/hooks/useOutbreakMode";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";



interface AppHeaderProps {
  /** Page title shown after the sidebar trigger */
  title?: string;
  /** Optional subtitle below the title */
  subtitle?: string;
  /** Optional decorative Lucide icon shown before the title. Presentational only. */
  titleIcon?: LucideIcon;
  /** Tailwind classes for the title icon, e.g. an emergency tone. */
  titleIconClassName?: string;
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
  titleIcon: TitleIcon,
  titleIconClassName,
  actions,
  overstayedCount = 0,
  overdueCount = 0,
  draftCount = 0,
  pendingCount = 0,
}: AppHeaderProps) {
  const [now, setNow] = useState(new Date());
  const { data: healthBlockCount = 0 } = useHealthAlerts();
  const { count: onSiteCount, cap, atLimit, nearLimit } = useOccupancy();
  const { enabled: outbreakMode, saving: outbreakSaving, setOutbreakMode } = useOutbreakMode();
  const { role, user } = useAuth();
  const { toast } = useToast();
  const isAdmin = role === "admin";

  const toggleOutbreak = async () => {
    if (!isAdmin || outbreakSaving) return;
    const next = !outbreakMode;
    const ok = await setOutbreakMode(next, user?.email || "staff");
    toast({
      title: ok ? (next ? "Outbreak Mode turned on" : "Outbreak Mode turned off") : "Could not change Outbreak Mode",
      description: ok
        ? next
          ? "Kiosk check-in is now blocked for anyone reporting symptoms or a high temperature."
          : "Symptoms at the kiosk will now show a staff-review warning instead of blocking."
        : undefined,
      variant: ok ? undefined : "destructive",
    });
  };


  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="sticky top-0 z-10 bg-card border-b border-border">
      <div className="flex items-center justify-between gap-3 px-4 sm:px-6 min-h-20 py-3 flex-wrap">
        {/* Left: sidebar trigger + page title */}
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <SidebarTrigger aria-label="Toggle navigation" className="min-h-touch min-w-touch text-muted-foreground hover:text-foreground shrink-0" />
          {title && <PageHeader title={title} description={subtitle} icon={TitleIcon} className="pb-0" />}

        </div>

        {/* Right: clock + facility badge + toolbar + page actions */}
        <div className="flex items-center flex-wrap gap-2 min-w-0">
          {/* Live clock */}
          <div className="hidden xl:flex items-center gap-1.5 mr-1">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            <span className="text-sm font-mono font-medium text-muted-foreground tabular-nums">
              {format(now, "hh:mm a")}
            </span>
          </div>

          <div className="hidden xl:block w-px h-5 bg-border" />

          {/* Live occupancy */}
          <div
            className={`hidden xl:flex items-center gap-1.5 px-2 py-1 rounded-lg mx-1 ${
              atLimit
                ? "bg-destructive/10 text-destructive-strong"
                : nearLimit
                ? "bg-warning/10 text-warning-strong"
                : "text-muted-foreground"
            }`}
            role="status"
            aria-label={
              cap
                ? `${onSiteCount} visitors on site of a limit of ${cap}${atLimit ? ". At limit" : nearLimit ? ". Near limit" : ""}`
                : `${onSiteCount} visitors currently on site`
            }
          >
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="text-sm font-medium tabular-nums">
              {onSiteCount}{cap ? ` / ${cap}` : ""}
            </span>
            {atLimit && <span className="text-xs font-semibold">At limit</span>}
            {nearLimit && <span className="text-xs font-semibold">Near limit</span>}
          </div>

          {/* Outbreak Mode */}
          {outbreakMode && (
            <>
              <div className="hidden xl:block w-px h-5 bg-border" />
              <Button variant="ghost"
                type="button"
                onClick={toggleOutbreak}
                aria-pressed={true}
                disabled={!isAdmin || outbreakSaving}
                title={
                  isAdmin
                    ? "Outbreak Mode is on — click to turn off"
                    : "Outbreak Mode is on — kiosk check-in is blocked for anyone reporting symptoms"
                }
                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg mx-1 bg-destructive/10 text-destructive-strong ${
                  isAdmin ? "hover:bg-destructive/20 cursor-pointer" : "cursor-default"
                } disabled:opacity-70`}
              >
                <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="text-xs font-semibold uppercase tracking-wide">Outbreak Mode On</span>
                {isAdmin && <span className="text-xs font-medium opacity-70">Turn off</span>}
              </Button>
            </>
          )}
          {!outbreakMode && isAdmin && (
            <>
              <div className="hidden xl:block w-px h-5 bg-border" />
              <Button variant="ghost"
                type="button"
                onClick={toggleOutbreak}
                aria-pressed={false}
                disabled={outbreakSaving}
                title="Turn Outbreak Mode on — blocks kiosk check-in on symptoms or high temperature"
                className="hidden lg:flex items-center gap-1.5 px-2 py-1 rounded-lg mx-1 text-muted-foreground hover:text-foreground hover:bg-secondary"
              >
                <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="text-xs font-medium">Outbreak Mode off</span>
              </Button>
            </>
          )}

          <div className="hidden xl:block w-px h-5 bg-border" />

          {/* Current site context */}
          <div className="flex items-center min-w-0">
            <SiteSwitcher compact />
          </div>

          <div className="hidden xl:block w-px h-5 bg-border" />

          {/* Icon toolbar */}
          <div className="flex items-center gap-0.5">
            <NotificationBell
              overstayedCount={overstayedCount}
              overdueCount={overdueCount}
              draftCount={draftCount}
              pendingCount={pendingCount}
              healthBlockCount={healthBlockCount}
            />

          </div>

          {/* Page-specific actions */}
          {actions && (
            <>
              <div className="hidden xl:block w-px h-5 bg-border" />
              <div className="flex flex-wrap items-center gap-1.5">
                {actions}
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
