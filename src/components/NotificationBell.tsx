import { useState, useRef, useEffect } from "react";
import { Bell, Clock, RefreshCw, UserX, ClipboardCheck, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NotificationItem {
  type: "overstay" | "draft" | "overdue" | "pending";
  icon: React.ReactNode;
  title: string;
  time: string;
  color: string;
}

interface NotificationBellProps {
  overstayedCount: number;
  overdueCount: number;
  draftCount: number;
  pendingCount: number;
}

export function NotificationBell({ overstayedCount, overdueCount, draftCount, pendingCount }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const totalAlerts = overstayedCount + overdueCount + draftCount + pendingCount;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const items: NotificationItem[] = [];
  if (overstayedCount > 0) items.push({
    type: "overstay", icon: <Clock className="h-4 w-4" />,
    title: `${overstayedCount} visitor${overstayedCount > 1 ? "s" : ""} overstayed`,
    time: "Active now", color: "text-destructive bg-destructive/10",
  });
  if (overdueCount > 0) items.push({
    type: "overdue", icon: <UserX className="h-4 w-4" />,
    title: `${overdueCount} resident${overdueCount > 1 ? "s" : ""} overdue for return`,
    time: "Active now", color: "text-destructive bg-destructive/10",
  });
  if (draftCount > 0) items.push({
    type: "draft", icon: <RefreshCw className="h-4 w-4" />,
    title: `${draftCount} pending clinical import${draftCount > 1 ? "s" : ""}`,
    time: "Awaiting review", color: "text-info bg-info/10",
  });
  if (pendingCount > 0) items.push({
    type: "pending", icon: <ClipboardCheck className="h-4 w-4" />,
    title: `${pendingCount} checkout request${pendingCount > 1 ? "s" : ""} pending`,
    time: "Awaiting approval", color: "text-[hsl(263,70%,58%)] bg-[hsl(263,70%,95%)]",
  });

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 relative"
        onClick={() => setOpen(!open)}
      >
        <Bell className="h-[18px] w-[18px] text-muted-foreground" />
        {totalAlerts > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 w-4 bg-destructive rounded-full flex items-center justify-center">
            <span className="text-[9px] font-bold text-destructive-foreground">{totalAlerts > 9 ? "9+" : totalAlerts}</span>
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[360px] bg-card border border-border rounded-[10px] shadow-lg z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
            {items.length > 0 && (
              <button className="text-[11px] text-primary hover:underline font-medium" onClick={() => setOpen(false)}>
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-[480px] overflow-y-auto">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <div className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center">
                  <Check className="h-5 w-5 text-success" />
                </div>
                <p className="text-sm text-muted-foreground">All caught up</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {items.map((item, i) => (
                  <div key={i} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${item.color}`}>
                      {item.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{item.title}</p>
                      <p className="text-[11px] text-muted-foreground">{item.time}</p>
                    </div>
                    <span className="text-muted-foreground text-xs mt-1">→</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
