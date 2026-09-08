import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell, Info } from "lucide-react";

export function NotificationsTab() {
  return (
    <div className="space-y-6">
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
