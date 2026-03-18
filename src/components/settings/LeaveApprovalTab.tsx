import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Zap } from "lucide-react";
import { useLeaveApprovalSetting } from "@/hooks/useLeaveRequests";
import { useToast } from "@/hooks/use-toast";

export function LeaveApprovalTab() {
  const { mode, loading, updateMode } = useLeaveApprovalSetting();
  const { toast } = useToast();

  const handleToggle = async () => {
    const newMode = mode === "auto" ? "manual" : "auto";
    await updateMode(newMode);
    toast({ title: `Leave approval set to ${newMode}` });
  };

  return (
    <Card>
      <CardHeader>
         <CardTitle className="text-base flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          Checkout Request Approval
        </CardTitle>
        <CardDescription className="text-xs">
          Configure how checkout requests from residents or external systems are processed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Approval Mode */}
        <div className="rounded-xl border border-border p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-sm font-semibold">Approval Mode</Label>
               <p className="text-xs text-muted-foreground">
                 {mode === "auto"
                   ? "Checkout requests are automatically approved and moved to check-out."
                   : "Checkout requests require manual review before being processed."}
               </p>
            </div>
            <Badge variant={mode === "auto" ? "default" : "secondary"} className="text-[10px] shrink-0">
              {mode === "auto" ? "Auto" : "Manual"}
            </Badge>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-muted/30 p-3">
            <div className="flex items-center gap-2">
              {mode === "auto" ? (
                <Zap className="h-4 w-4 text-amber-500" />
              ) : (
                <ShieldCheck className="h-4 w-4 text-primary" />
              )}
              <span className="text-xs font-medium text-foreground">
                {mode === "auto" ? "Auto-approve incoming requests" : "Require manual approval"}
              </span>
            </div>
            <Switch
              checked={mode === "auto"}
              onCheckedChange={handleToggle}
              disabled={loading}
            />
          </div>
        </div>

        {/* Info cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-border p-3 space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Manual Mode</p>
            <p className="text-xs text-muted-foreground">
              Requests appear in the Review queue. Staff must approve or reject before checkout proceeds.
            </p>
          </div>
          <div className="rounded-xl border border-border p-3 space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Auto Mode</p>
            <p className="text-xs text-muted-foreground">
              Requests are instantly approved and the resident is checked out automatically.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
