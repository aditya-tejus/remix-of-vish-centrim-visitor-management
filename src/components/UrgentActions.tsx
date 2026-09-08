import { isOverstayedSync } from "@/hooks/useOverstayPolicy";
import { useState, useEffect } from "react";
import { Visitor } from "@/types/visitor";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Clock, LogOut, X, ChevronRight, Ban, Bell, Home, ShieldAlert } from "lucide-react";
import { formatDistanceToNow, format, isPast } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { EscalateIncidentDialog } from "@/components/EscalateIncidentDialog";

interface UrgentActionsProps {
  visitors: Visitor[];
  onCheckOut: (id: string) => void;
  onCheckOutAllOverstayed?: () => void;
}

interface ActionItem {
  id: string;
  title: string;
  visitorId: string;
  description: string;
  time: string;
  severity: "red" | "amber" | "yellow" | "green";
  icon: typeof AlertTriangle;
  actions: { label: string; variant: "default" | "outline" | "destructive"; onClick: () => void }[];
}

export function UrgentActions({ visitors, onCheckOut, onCheckOutAllOverstayed }: UrgentActionsProps) {
  const navigate = useNavigate();
  const actions: ActionItem[] = [];
  const [escalateTarget, setEscalateTarget] = useState<Visitor | null>(null);
  const { policy } = useReturnNotificationPolicy();
  const noReturnEnabled = policy?.overdueEnabled ?? false;

  // Overstayed visitors (8+ hours)
  visitors
    .filter(isOverstayedSync)
    .forEach((v) => {
      actions.push({
        id: `overstay-${v.id}`,
        visitorId: v.id,
        title: `Overstayed — Immediate Action Needed`,
        description: `${v.firstName} ${v.surname} has been on-site for ${formatDistanceToNow(v.checkInTime)}. Please verify and check out.`,
        time: formatDistanceToNow(v.checkInTime, { addSuffix: true }),
        severity: "red",
        icon: Ban,
        actions: [
          { label: "Check Out", variant: "default", onClick: () => onCheckOut(v.id) },
        ],
      });
    });

  // Long visits (4+ hours, not yet overstayed)
  visitors
    .filter(
      (v) =>
        v.status === "checked-in" &&
        Date.now() - v.checkInTime.getTime() > 4 * 3600000 &&
        !isOverstayedSync(v)
    )
    .forEach((v) => {
      actions.push({
        id: `long-${v.id}`,
        visitorId: v.id,
        title: `Extended Visit — Monitor`,
        description: `${v.firstName} ${v.surname} checked in ${formatDistanceToNow(v.checkInTime, { addSuffix: true })}. Visiting ${v.whomToVisit || "the facility"}.`,
        time: format(v.checkInTime, "HH:mm"),
        severity: "amber",
        icon: Clock,
        actions: [
          { label: "Check Out", variant: "outline", onClick: () => onCheckOut(v.id) },
        ],
      });
    });

  // Health declaration issues
  visitors
    .filter((v) => v.status === "checked-in" && !v.healthDeclaration)
    .forEach((v) => {
      actions.push({
        id: `health-${v.id}`,
        visitorId: v.id,
        title: `Compliance Screening Incomplete`,
        description: `${v.firstName} ${v.surname} hasn't completed their compliance declaration. This is required.`,
        time: formatDistanceToNow(v.checkInTime, { addSuffix: true }),
        severity: "yellow",
        icon: AlertTriangle,
        actions: [],
      });
    });

  // Overdue resident returns
  if (noReturnEnabled) {
    visitors
      .filter(
        (v) =>
          v.type === "resident" &&
          v.status === "checked-out" &&
          v.returnNotificationOptIn &&
          v.expectedReturnDate &&
          isReturnOverdue(v.expectedReturnDate, policy)
      )
      .forEach((v) => {
        const escalated = isReturnEscalated(v.expectedReturnDate!, policy);
        const named = recipientSummary(policy, "overdue");
        actions.push({
          id: `overdue-return-${v.id}`,
          visitorId: v.id,
          title: escalated ? `Resident Not Returned — Escalated` : `Resident Not Returned — Overdue`,
          description: `${v.firstName} ${v.surname} was expected back by ${format(v.expectedReturnDate!, "hh:mm a dd MMM")} (${formatDistanceToNow(v.expectedReturnDate!, { addSuffix: true })}). Reason: ${v.checkoutReason || "Not specified"}.${named ? ` Tell ${named}.` : ""}`,
          time: format(v.expectedReturnDate!, "dd MMM"),
          severity: "red",
          icon: Home,
          actions: [
            { label: "Escalate to Incident", variant: "destructive", onClick: () => setEscalateTarget(v) },
          ],
        });
      });
  }

  // Currently checked-in notifications
  visitors
    .filter(
      (v) =>
        v.status === "checked-in" &&
        Date.now() - v.checkInTime.getTime() <= 4 * 3600000
    )
    .forEach((v) => {
      actions.push({
        id: `checkin-${v.id}`,
        visitorId: v.id,
        title: `Active Visit`,
        description: `${v.firstName} ${v.surname} is safely on-site, visiting ${v.whomToVisit || "the facility"}.`,
        time: format(v.checkInTime, "HH:mm"),
        severity: "green",
        icon: Bell,
        actions: [
          { label: "Check Out", variant: "outline", onClick: () => onCheckOut(v.id) },
        ],
      });
    });

  const borderColorMap = {
    red: "border-l-destructive",
    amber: "border-l-warning",
    yellow: "border-l-warning/60",
    green: "border-l-success",
  };

  const bgColorMap = {
    red: "bg-destructive/[0.03]",
    amber: "bg-warning/[0.03]",
    yellow: "bg-warning/[0.02]",
    green: "bg-success/[0.02]",
  };

  const dotColorMap = {
    red: "bg-destructive",
    amber: "bg-warning",
    yellow: "bg-warning/70",
    green: "bg-success",
  };

  if (actions.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">All clear. No urgent actions right now.</p>
      </div>
    );
  }

  const overstayedActions = actions.filter((a) => a.id.startsWith("overstay-"));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">Action Centre</h2>
        <div className="flex items-center gap-3">
          {overstayedActions.length > 1 && onCheckOutAllOverstayed && (
            <Button
              variant="destructive"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={onCheckOutAllOverstayed}
            >
              <LogOut className="h-3 w-3" />
              Check Out All Overstayed ({overstayedActions.length})
            </Button>
          )}
          <button className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            View All ({actions.length})
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="space-y-3">
        {actions.slice(0, 5).map((action) => (
          <div
            key={action.id}
            className={`rounded-xl border border-border ${bgColorMap[action.severity]} border-l-4 ${borderColorMap[action.severity]} p-4`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1">
                <span className={`mt-1 h-2.5 w-2.5 rounded-full ${dotColorMap[action.severity]} shrink-0`} />
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <action.icon className="h-4 w-4 text-muted-foreground" />
                      <button
                        className="text-sm font-bold text-primary hover:underline text-left"
                        onClick={() => navigate(`/visitors/${action.visitorId}`)}
                      >
                        {action.title}
                      </button>
                    </div>
                  <p className="text-sm text-muted-foreground">{action.description}</p>
                  {action.actions.length > 0 && (
                    <div className="flex items-center gap-2 pt-2">
                      {action.actions.map((act) => (
                        <Button
                          key={act.label}
                          variant={act.variant}
                          size="sm"
                          className="h-7 text-xs gap-1"
                          onClick={act.onClick}
                        >
                          {act.variant === "default" && <LogOut className="h-3 w-3" />}
                          {act.variant === "destructive" && <ShieldAlert className="h-3 w-3" />}
                          {act.label}
                        </Button>
                      ))}
                      <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                        <X className="h-3 w-3" /> Dismiss
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">{action.time}</span>
            </div>
          </div>
        ))}
      </div>

      <EscalateIncidentDialog
        open={!!escalateTarget}
        onOpenChange={(o) => { if (!o) setEscalateTarget(null); }}
        visitorId={escalateTarget?.id || null}
        residentName={escalateTarget ? `${escalateTarget.firstName} ${escalateTarget.surname}` : ""}
        expectedReturnDate={escalateTarget?.expectedReturnDate || null}
        defaultDescription={
          escalateTarget
            ? `${escalateTarget.firstName} ${escalateTarget.surname} did not return from leave as expected. Reason for leave: ${escalateTarget.checkoutReason || "not specified"}.`
            : ""
        }
      />
    </div>
  );
}
