import { useState, useEffect } from "react";
import centrimLogo from "@/assets/centrim-life-logo.png";
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
      <div className="flex items-center justify-between gap-2 px-4 sm:px-6 min-h-14 py-2">
        {/* Left: sidebar trigger + page title */}
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <SidebarTrigger aria-label="Toggle navigation" className="text-muted-foreground hover:text-foreground shrink-0" />
          {title && (
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-foreground leading-tight truncate flex items-center gap-2">
                {TitleIcon && <TitleIcon className={titleIconClassName ?? "h-5 w-5 shrink-0"} aria-hidden="true" />}
                <span className="truncate">{title}</span>
              </h1>
              {subtitle && (
                <p className="text-[13px] text-muted-foreground line-clamp-2">{subtitle}</p>
              )}
            </div>
          )}
        </div>

        {/* Right: clock + facility badge + toolbar + page actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Live clock */}
          <div className="hidden md:flex items-center gap-1.5 mr-1">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            <span className="text-[13px] font-mono font-medium text-muted-foreground tabular-nums">
              {format(now, "hh:mm a")}
            </span>
          </div>

          <div className="w-px h-5 bg-border" />

          {/* Live occupancy */}
          <div
            className={`hidden md:flex items-center gap-1.5 px-2 py-1 rounded-lg mx-1 ${
              atLimit
                ? "bg-destructive/10 text-destructive"
                : nearLimit
                ? "bg-warning/10 text-warning"
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
            <span className="text-[13px] font-medium tabular-nums">
              {onSiteCount}{cap ? ` / ${cap}` : ""}
            </span>
            {atLimit && <span className="text-[11px] font-semibold">At limit</span>}
            {nearLimit && <span className="text-[11px] font-semibold">Near limit</span>}
          </div>

          {/* Outbreak Mode */}
          {outbreakMode && (
            <>
              <div className="w-px h-5 bg-border" />
              <button
                type="button"
                onClick={toggleOutbreak}
                aria-pressed={true}
                disabled={!isAdmin || outbreakSaving}
                title={
                  isAdmin
                    ? "Outbreak Mode is on — click to turn off"
                    : "Outbreak Mode is on — kiosk check-in is blocked for anyone reporting symptoms"
                }
                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg mx-1 bg-destructive/10 text-destructive ${
                  isAdmin ? "hover:bg-destructive/20 cursor-pointer" : "cursor-default"
                } disabled:opacity-70`}
              >
                <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="text-[11px] font-semibold uppercase tracking-wide">Outbreak Mode On</span>
                {isAdmin && <span className="text-[10px] font-medium opacity-70">Turn off</span>}
              </button>
            </>
          )}
          {!outbreakMode && isAdmin && (
            <>
              <div className="w-px h-5 bg-border" />
              <button
                type="button"
                onClick={toggleOutbreak}
                aria-pressed={false}
                disabled={outbreakSaving}
                title="Turn Outbreak Mode on — blocks kiosk check-in on symptoms or high temperature"
                className="hidden lg:flex items-center gap-1.5 px-2 py-1 rounded-lg mx-1 text-muted-foreground hover:text-foreground hover:bg-secondary"
              >
                <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="text-[11px] font-medium">Outbreak Mode off</span>
              </button>
            </>
          )}

          <div className="w-px h-5 bg-border" />

          {/* Current site context */}
          <div className="hidden lg:flex items-center mx-1">
            <SiteSwitcher compact />
          </div>

          <div className="w-px h-5 bg-border" />

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
