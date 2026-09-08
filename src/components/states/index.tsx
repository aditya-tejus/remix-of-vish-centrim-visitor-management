/**
 * Shared screen states (Stage 2).
 *
 * One consistent treatment for loading, empty, error, permission and offline
 * across every staff screen. Presentation only — no business logic.
 */
import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Inbox, Lock, RefreshCw, WifiOff } from "lucide-react";

interface BaseProps {
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

function Shell({
  icon,
  tone = "muted",
  title,
  description,
  action,
  className = "",
  role,
}: BaseProps & { icon: ReactNode; tone?: "muted" | "warning" | "danger"; role?: string }) {
  const toneClasses =
    tone === "danger"
      ? "bg-destructive/10 text-destructive"
      : tone === "warning"
      ? "bg-warning/10 text-warning"
      : "bg-muted text-muted-foreground";
  return (
    <div
      role={role}
      className={`flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card px-6 py-12 text-center ${className}`}
    >
      <div className={`flex h-12 w-12 items-center justify-center rounded-full ${toneClasses}`}>{icon}</div>
      {title && <p className="text-base font-semibold text-foreground">{title}</p>}
      {description && <p className="max-w-md text-[13px] text-muted-foreground">{description}</p>}
      {action && <div className="pt-1">{action}</div>}
    </div>
  );
}

export function LoadingState({ rows = 4, label = "Loading" }: { rows?: number; label?: string }) {
  return (
    <div className="space-y-2" role="status" aria-live="polite" aria-label={label}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded-xl" />
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function EmptyState({ title = "Nothing here yet", description, action, className }: BaseProps) {
  return (
    <Shell
      icon={<Inbox className="h-6 w-6" />}
      title={title}
      description={description}
      action={action}
      className={className}
    />
  );
}

export function ErrorState({
  title = "Something went wrong",
  description = "We could not load this just now. Try again in a moment.",
  onRetry,
  className,
}: BaseProps & { onRetry?: () => void }) {
  return (
    <Shell
      role="alert"
      tone="danger"
      icon={<AlertTriangle className="h-6 w-6" />}
      title={title}
      description={description}
      className={className}
      action={
        onRetry && (
          <Button variant="outline" onClick={onRetry} className="gap-2">
            <RefreshCw className="h-4 w-4" /> Try again
          </Button>
        )
      }
    />
  );
}

export function PermissionDeniedState({
  title = "You do not have access to this",
  description = "Ask an administrator if you need to see this information.",
  className,
}: BaseProps) {
  return (
    <Shell
      role="alert"
      tone="warning"
      icon={<Lock className="h-6 w-6" />}
      title={title}
      description={description}
      className={className}
    />
  );
}

export function OfflineState({
  title = "No connection",
  description = "Changes will be saved once the connection returns.",
  onRetry,
  className,
}: BaseProps & { onRetry?: () => void }) {
  return (
    <Shell
      role="alert"
      tone="warning"
      icon={<WifiOff className="h-6 w-6" />}
      title={title}
      description={description}
      className={className}
      action={
        onRetry && (
          <Button variant="outline" onClick={onRetry} className="gap-2">
            <RefreshCw className="h-4 w-4" /> Retry
          </Button>
        )
      }
    />
  );
}
