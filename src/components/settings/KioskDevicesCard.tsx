import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useSite } from "@/contexts/SiteContext";
import { useSectionAccess } from "@/components/settings/SettingsAccessContext";
import {
  Tablet, Plus, RefreshCw, PauseCircle, PlayCircle, Ban, Replace, Pencil, Copy, Clock,
} from "lucide-react";

interface DeviceRow {
  id: string;
  branch_id: string;
  name: string;
  status: string;
  last_seen_at: string | null;
  last_seen_version: string | null;
  last_checkin_at: string | null;
  token_expires_at: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Awaiting setup",
  active: "Active",
  suspended: "Paused",
  revoked: "Turned off",
};

function when(value: string | null) {
  if (!value) return "Never";
  return new Date(value).toLocaleString(undefined, {
    day: "2-digit", month: "short", hour: "numeric", minute: "2-digit", hour12: true,
  });
}

/**
 * Kiosk devices for this site. Each tablet is set up once with a code that can be used
 * once and lasts 15 minutes. The code and the device key are never shown again.
 */
export function KioskDevicesCard() {
  const { toast } = useToast();
  const { canEdit } = useSectionAccess();
  const { currentSiteId, currentSite } = useSite();
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<{ code: string; device: string } | null>(null);

  const load = useCallback(async () => {
    if (!currentSiteId) return;
    setLoading(true);
    const { data } = await (supabase as any)
      .from("kiosk_devices")
      .select("id, branch_id, name, status, last_seen_at, last_seen_version, last_checkin_at, token_expires_at")
      .eq("branch_id", currentSiteId)
      .order("created_at", { ascending: true });
    setDevices((data as DeviceRow[]) ?? []);
    setLoading(false);
  }, [currentSiteId]);

  useEffect(() => { void load(); }, [load]);

  const audit = async (action: string, detail: string) => {
    const { data: userData } = await supabase.auth.getUser();
    await supabase.from("audit_log").insert({
      action,
      performed_by: userData.user?.email || "Admin",
      user_id: userData.user?.id ?? null,
      records_affected: 1,
      change_reason: detail,
    });
  };

  const run = async (fn: string, args: Record<string, unknown>, ok: string, action: string, detail: string) => {
    if (!canEdit) return null;
    setBusy(true);
    const { data, error } = await (supabase as any).rpc(fn, args);
    setBusy(false);
    if (error) {
      toast({ title: "That did not work", description: error.message, variant: "destructive" });
      return null;
    }
    await audit(action, detail);
    toast({ title: ok });
    void load();
    return data;
  };

  const addDevice = async () => {
    if (!currentSiteId || !name.trim()) return;
    const data = await run(
      "kiosk_provision_device",
      { p_branch_id: currentSiteId, p_name: name.trim() },
      "Kiosk added",
      "kiosk_device_provisioned",
      `Kiosk "${name.trim()}" set up for ${currentSite?.name ?? "this site"}`
    );
    const row = Array.isArray(data) ? data[0] : data;
    if (row?.activation_code) setIssued({ code: row.activation_code, device: name.trim() });
    setName("");
  };

  const rotate = async (d: DeviceRow) => {
    const code = await run("kiosk_rotate_token", { p_device_id: d.id }, "New code issued",
      "kiosk_device_rotated", `New activation code issued for "${d.name}"`);
    if (typeof code === "string") setIssued({ code, device: d.name });
  };

  const replace = async (d: DeviceRow) => {
    const data = await run("kiosk_replace_device", { p_device_id: d.id, p_name: null },
      "Replacement kiosk created", "kiosk_device_replaced", `"${d.name}" replaced`);
    const row = Array.isArray(data) ? data[0] : data;
    if (row?.activation_code) setIssued({ code: row.activation_code, device: d.name });
  };

  const setStatus = (d: DeviceRow, status: string, label: string) =>
    run("kiosk_set_device_status", { p_device_id: d.id, p_status: status }, label,
      `kiosk_device_${status}`, `"${d.name}" ${label.toLowerCase()}`);

  const rename = async (d: DeviceRow) => {
    const next = window.prompt("New name for this kiosk", d.name);
    if (!next?.trim()) return;
    await run("kiosk_rename_device", { p_device_id: d.id, p_name: next.trim() }, "Kiosk renamed",
      "kiosk_device_renamed", `"${d.name}" renamed to "${next.trim()}"`);
  };

  return (
    <Card className="rounded-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Tablet className="h-4 w-4 text-primary" aria-hidden /> Kiosk devices
        </CardTitle>
        <CardDescription>
          Each tablet is set up once for this site with a code that can be used once and lasts 15 minutes.
          A kiosk cannot move to another site on its own.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {issued && (
          <div className="rounded-xl border border-primary/40 bg-primary/5 p-4 space-y-2">
            <p className="text-[13px] font-semibold text-foreground">
              Activation code for {issued.device} — shown once only
            </p>
            <div className="flex items-center gap-2">
              <code className="text-xl font-mono tracking-[0.2em] text-foreground">{issued.code}</code>
              <Button
                size="sm"
                variant="secondary"
                className="rounded-lg"
                onClick={() => { void navigator.clipboard?.writeText(issued.code); toast({ title: "Code copied" }); }}
              >
                <Copy className="h-4 w-4 mr-1.5" aria-hidden /> Copy code
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setIssued(null)}>Done</Button>
            </div>
            <p className="text-[12px] text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" aria-hidden /> Expires in 15 minutes. It cannot be shown again.
            </p>
          </div>
        )}

        <div className="flex items-end gap-3">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="kiosk-device-name" className="text-[13px]">Add a kiosk</Label>
            <Input
              id="kiosk-device-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Main entrance tablet"
              disabled={!canEdit}
            />
          </div>
          <Button onClick={addDevice} disabled={!canEdit || busy || !name.trim() || !currentSiteId} className="rounded-xl">
            <Plus className="h-4 w-4 mr-1.5" aria-hidden /> Add kiosk
          </Button>
        </div>

        {loading ? (
          <p className="text-[13px] text-muted-foreground">Loading kiosks…</p>
        ) : devices.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">No kiosks set up for this site yet.</p>
        ) : (
          <ul className="space-y-3">
            {devices.map((d) => (
              <li key={d.id} className="rounded-xl border border-border p-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{d.name}</p>
                    <p className="text-[12px] text-muted-foreground">
                      Last seen {when(d.last_seen_at)} · Last check-in {when(d.last_checkin_at)}
                      {d.last_seen_version ? ` · Version ${d.last_seen_version}` : ""}
                    </p>
                  </div>
                  <Badge variant={d.status === "active" ? "default" : "secondary"}>
                    {STATUS_LABEL[d.status] ?? d.status}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" className="rounded-lg" disabled={!canEdit || busy} onClick={() => rename(d)}>
                    <Pencil className="h-4 w-4 mr-1.5" aria-hidden /> Rename
                  </Button>
                  <Button size="sm" variant="secondary" className="rounded-lg" disabled={!canEdit || busy || d.status === "revoked"} onClick={() => rotate(d)}>
                    <RefreshCw className="h-4 w-4 mr-1.5" aria-hidden /> New code
                  </Button>
                  {d.status === "suspended" ? (
                    <Button size="sm" variant="secondary" className="rounded-lg" disabled={!canEdit || busy} onClick={() => setStatus(d, "active", "Kiosk resumed")}>
                      <PlayCircle className="h-4 w-4 mr-1.5" aria-hidden /> Resume
                    </Button>
                  ) : (
                    <Button size="sm" variant="secondary" className="rounded-lg" disabled={!canEdit || busy || d.status !== "active"} onClick={() => setStatus(d, "suspended", "Kiosk paused")}>
                      <PauseCircle className="h-4 w-4 mr-1.5" aria-hidden /> Pause
                    </Button>
                  )}
                  <Button size="sm" variant="secondary" className="rounded-lg" disabled={!canEdit || busy || d.status === "revoked"} onClick={() => setStatus(d, "revoked", "Kiosk turned off")}>
                    <Ban className="h-4 w-4 mr-1.5" aria-hidden /> Turn off
                  </Button>
                  <Button size="sm" variant="secondary" className="rounded-lg" disabled={!canEdit || busy} onClick={() => replace(d)}>
                    <Replace className="h-4 w-4 mr-1.5" aria-hidden /> Replace
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
