import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePermissions, ALL_PERMISSIONS, PERMISSION_LABELS, Permission } from "@/hooks/usePermissions";
import { KeyRound } from "lucide-react";

const ROLES = ["admin", "staff", "user"] as const;
type Role = (typeof ROLES)[number];

const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrator",
  staff: "Staff",
  user: "Limited access",
};

/** Which actions each role can perform. Administrators keep every action. */
export function PermissionMatrixCard() {
  const { toast } = useToast();
  const { can } = usePermissions();
  const editable = can("settings.administer");
  const [grants, setGrants] = useState<Record<string, boolean>>({});

  const load = async () => {
    const { data } = await supabase.from("role_permissions" as any).select("role, permission");
    const map: Record<string, boolean> = {};
    ((data as any[]) || []).forEach((r) => { map[`${r.role}:${r.permission}`] = true; });
    setGrants(map);
  };

  useEffect(() => { void load(); }, []);

  const toggle = async (role: Role, permission: Permission, next: boolean) => {
    const key = `${role}:${permission}`;
    setGrants((prev) => ({ ...prev, [key]: next }));
    const { error } = next
      ? await supabase.from("role_permissions" as any).insert({ role, permission } as any)
      : await supabase.from("role_permissions" as any).delete().eq("role", role).eq("permission", permission);
    if (error) {
      setGrants((prev) => ({ ...prev, [key]: !next }));
      toast({ title: "Could not change access", description: error.message, variant: "destructive" });
      return;
    }
    await (supabase as any).rpc("log_audit", {
      _action: next ? "permission.granted" : "permission.revoked",
      _details: { role, permission },
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><KeyRound className="h-4 w-4 text-primary" /> What each role can do</CardTitle>
        <CardDescription>
          Applies everywhere — desktop and kiosk. People only see sites they have been given access to.
          {!editable && " Only administrators can change this."}
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="py-2 pr-4 font-medium text-muted-foreground">Action</th>
              {ROLES.map((r) => (
                <th key={r} className="py-2 px-3 font-medium text-muted-foreground">{ROLE_LABELS[r]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ALL_PERMISSIONS.map((p) => (
              <tr key={p} className="border-b border-border/60">
                <td className="py-2 pr-4 text-foreground">{PERMISSION_LABELS[p]}</td>
                {ROLES.map((r) => (
                  <td key={r} className="py-2 px-3">
                    <Switch
                      checked={r === "admin" ? true : !!grants[`${r}:${p}`]}
                      disabled={!editable || r === "admin"}
                      onCheckedChange={(v) => toggle(r, p, v)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
