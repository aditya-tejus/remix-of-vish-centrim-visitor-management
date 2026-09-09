/**
 * NOT IN USE (Phase 7E).
 *
 * This screen is not reachable from Settings. Its controls are covered by the
 * per-visitor-type screens that Settings does show, so keeping it visible would
 * mean the same decision existed in two places. The file is kept, unchanged in
 * behaviour, so nothing is lost if a control here still needs a home.
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, Info } from "lucide-react";
import { currentDeliveryStatus, DELIVERY_LABELS } from "@/lib/notificationDelivery";

export function NotificationsTab() {
  const delivery = currentDeliveryStatus();

  return (
    <div className="space-y-6">
      <Card className="border-warning/30 bg-warning/[0.04]">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            Email and text sending is not switched on
            <Badge variant="outline" className="text-[10px] border-warning/40 text-warning">{delivery.label}</Badge>
          </CardTitle>
          <CardDescription className="text-xs">
            Alerts are raised in the app and written to the record with who should have been told and when. Nothing is
            emailed or texted out yet, so treat the recipient lists below as the plan, not as proof anyone was contacted.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-xs text-muted-foreground">{delivery.detail}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {(["created", "queued", "delivered", "failed", "not_configured"] as const).map((state) => (
              <Badge
                key={state}
                variant="outline"
                className={`text-[10px] ${state === delivery.state ? "border-primary/40 text-primary" : "text-muted-foreground opacity-60"}`}
              >
                {DELIVERY_LABELS[state]}
              </Badge>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Only the highlighted state is possible today. The others become available when a sending channel is connected.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4 text-primary" />
            Resident Return Notifications
          </CardTitle>
          <CardDescription className="text-xs">
            Alerts for residents who have not returned by their expected time, and confirmations when they get back.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border border-primary/15 bg-primary/[0.03] p-4 flex items-start gap-3">
            <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div className="space-y-1.5 text-xs text-muted-foreground">
              <p>
                <span className="font-semibold text-foreground">Where to set this up:</span> Residents &rarr; Return
                Notifications. That is where you switch overdue alerts on, choose the grace period and escalation, and
                name who should be told.
              </p>
              <p>
                <span className="font-semibold text-foreground">Privacy opt-in:</span> Each resident can opt in to
                return tracking during check-out. By default this is unticked. Only opted-in residents trigger alerts.
              </p>
              <p>
                <span className="font-semibold text-foreground">How alerts show:</span> Overdue residents appear in the
                dashboard Action Centre and clear automatically once they are marked as returned.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
