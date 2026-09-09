import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { clearKioskDevice, KioskDeviceRecord, loadKioskDevice, saveKioskDevice } from "@/lib/kioskDevice";

export type KioskDeviceState = "loading" | "unbound" | "active" | "blocked" | "offline";

interface KioskDeviceContextValue {
  state: KioskDeviceState;
  siteId: string | null;
  siteName: string | null;
  deviceName: string | null;
  /** Why the kiosk is blocked, in words a member of staff can act on. */
  blockedReason: string | null;
  activate: (code: string) => Promise<{ ok: boolean; message?: string }>;
  refresh: () => void;
  /** Removes the stored key so the tablet asks to be set up again. */
  forget: () => Promise<void>;
}

const Ctx = createContext<KioskDeviceContextValue>({
  state: "loading",
  siteId: null,
  siteName: null,
  deviceName: null,
  blockedReason: null,
  activate: async () => ({ ok: false }),
  refresh: () => {},
  forget: async () => {},
});

const HEARTBEAT_MS = 10 * 60 * 1000;
const APP_VERSION = "8D";

function refusalMessage(message: string): string | null {
  if (message.includes("device_suspended")) return "This kiosk has been paused. Please ask a staff member.";
  if (message.includes("device_revoked")) return "This kiosk has been turned off. Please ask a staff member.";
  if (message.includes("device_expired")) return "This kiosk needs setting up again. Please ask a staff member.";
  if (message.includes("device_not_recognised")) return "This kiosk is no longer recognised. Please ask a staff member.";
  return null;
}

export function KioskDeviceProvider({ children }: { children: ReactNode }) {
  const [record, setRecord] = useState<KioskDeviceRecord | null>(null);
  const [state, setState] = useState<KioskDeviceState>("loading");
  const [blockedReason, setBlockedReason] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  const check = useCallback(async () => {
    const stored = await loadKioskDevice();
    if (!stored?.token) {
      setRecord(null);
      setState("unbound");
      return;
    }
    setRecord(stored);
    const { data, error } = await (supabase as any).rpc("kiosk_device_context", {
      p_token: stored.token,
      p_version: APP_VERSION,
    });
    if (error) {
      const refused = refusalMessage(error.message ?? "");
      if (refused) {
        setBlockedReason(refused);
        setState("blocked");
      } else {
        // Network or server trouble: keep the bound site and let the offline queue work.
        setState("offline");
      }
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      setBlockedReason("This kiosk is no longer recognised. Please ask a staff member.");
      setState("blocked");
      return;
    }
    const next: KioskDeviceRecord = {
      token: stored.token,
      deviceId: row.device_id,
      siteId: row.branch_id,
      siteName: row.site_name,
      deviceName: row.device_name,
    };
    await saveKioskDevice(next);
    setRecord(next);
    setBlockedReason(null);
    setState("active");
  }, []);

  useEffect(() => {
    check();
  }, [check, tick]);

  useEffect(() => {
    const id = setInterval(check, HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [check]);

  const activate = useCallback(async (code: string) => {
    const clean = code.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    if (clean.length !== 12) return { ok: false, message: "Enter the full 12-character code." };
    const { data, error } = await (supabase as any).rpc("kiosk_activate", {
      p_code: clean,
      p_version: APP_VERSION,
    });
    if (error) {
      if ((error.message ?? "").includes("too_many_attempts")) {
        return { ok: false, message: "Too many attempts. Please wait and ask for a new code." };
      }
      return { ok: false, message: "That code cannot be used. Ask an administrator for a new one." };
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.token) return { ok: false, message: "That code cannot be used. Ask an administrator for a new one." };
    const next: KioskDeviceRecord = {
      token: row.token,
      deviceId: row.device_id,
      siteId: row.branch_id,
      siteName: row.site_name,
      deviceName: row.device_name,
    };
    await saveKioskDevice(next);
    setRecord(next);
    setBlockedReason(null);
    setState("active");
    return { ok: true };
  }, []);

  const forget = useCallback(async () => {
    await clearKioskDevice();
    setRecord(null);
    setState("unbound");
  }, []);

  const value = useMemo<KioskDeviceContextValue>(
    () => ({
      state,
      siteId: record?.siteId ?? null,
      siteName: record?.siteName ?? null,
      deviceName: record?.deviceName ?? null,
      blockedReason,
      activate,
      refresh,
      forget,
    }),
    [state, record, blockedReason, activate, refresh, forget]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useKioskDevice = () => useContext(Ctx);
