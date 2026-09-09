import { supabase } from "@/integrations/supabase/client";
import { kioskDeviceToken } from "@/lib/kioskDevice";

/**
 * Every kiosk request goes through here. The device key is added by this helper and the
 * site is worked out on the server from that key, so a kiosk cannot ask for another
 * site's people even if the request is tampered with.
 */
export async function kioskRpc<T = unknown>(fn: string, args: Record<string, unknown> = {}) {
  const token = kioskDeviceToken();
  if (!token) {
    return { data: null as T | null, error: { message: "device_not_bound" } as { message: string } };
  }
  const { data, error } = await (supabase as any).rpc(fn, { p_token: token, ...args });
  return { data: data as T | null, error: error as { message: string } | null };
}

/** True when the server refused the request because this device is no longer allowed. */
export function isDeviceRefusal(error: { message?: string } | null | undefined) {
  const m = error?.message ?? "";
  return (
    m.includes("device_not_bound") ||
    m.includes("device_not_recognised") ||
    m.includes("device_suspended") ||
    m.includes("device_revoked") ||
    m.includes("device_pending") ||
    m.includes("device_expired")
  );
}
