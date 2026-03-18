import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Bell, Clock, Users, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function NotificationsTab() {
  const [noReturnEnabled, setNoReturnEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "no_return_notification_enabled")
        .maybeSingle();
      if (data) setNoReturnEnabled(data.value === "true");
      setLoading(false);
    };
    load();
  }, []);

  const toggleNoReturn = async (enabled: boolean) => {
    setNoReturnEnabled(enabled);
    const { error } = await supabase
      .from("settings")
      .upsert({ key: "no_return_notification_enabled", value: String(enabled) }, { onConflict: "key" });
    if (error) {
      toast.error("Failed to save setting");
      setNoReturnEnabled(!enabled);
    } else {
      toast.success(enabled ? "No-return notifications enabled" : "No-return notifications disabled");
    }
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground p-4">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4 text-primary" />
            Resident Return Notifications
          </CardTitle>
          <CardDescription className="text-xs">
            Get alerted when residents have not returned by their agreed return date.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-border p-4">
            <div className="space-y-1">
              <Label className="text-sm font-semibold">Enable No-Return Notifications</Label>
              <p className="text-xs text-muted-foreground">
                Master toggle — when enabled, the system will flag residents who haven't returned by their expected date.
              </p>
            </div>
            <Switch checked={noReturnEnabled} onCheckedChange={toggleNoReturn} />
          </div>

          <div className="rounded-xl border border-primary/15 bg-primary/[0.03] p-4 flex items-start gap-3">
            <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div className="space-y-1.5 text-xs text-muted-foreground">
              <p>
                <span className="font-semibold text-foreground">How it works:</span> When a resident is checked out with an expected return date, and the master toggle is enabled, a notification will appear in the Action Centre if they haven't returned by that date.
              </p>
              <p>
                <span className="font-semibold text-foreground">Privacy opt-in:</span> Each resident can opt in to return tracking during check-out. By default, this is unticked to respect privacy. Only opted-in residents will trigger notifications.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border p-4 space-y-3">
            <h4 className="text-xs font-semibold text-foreground flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              Notification Behaviour
            </h4>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                Notifications appear in the dashboard Action Centre
              </li>
              <li className="flex items-start gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                Only residents who opted in during check-out are tracked
              </li>
              <li className="flex items-start gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                Notifications clear automatically when the resident is checked back in
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
