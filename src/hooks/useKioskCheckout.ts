import { useEffect, useRef, useState } from "react";
import { kioskRpc } from "@/lib/kioskRpc";
import { normalizeCheckoutCode, normalizeCheckoutName, validCheckoutName, validCheckoutCode, type CheckoutLookup } from "@/lib/kioskCheckoutPolicy";

export function useKioskCheckoutName(name: string) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let stale = false;
    setMessage(""); setBusy(false);
    if (!validCheckoutName(name)) return;
    setBusy(true);
    const timer = window.setTimeout(async () => {
      try {
        const { error } = await kioskRpc("kioskd_checkout_name", { p_query: normalizeCheckoutName(name) });
        if (!stale) setMessage(error ? "We could not connect. Try again or ask reception." : "Please use your visitor card or ask reception to help you sign out.");
      } catch { if (!stale) setMessage("We could not connect. Try again or ask reception."); }
      finally { if (!stale) setBusy(false); }
    }, 350);
    return () => { stale = true; window.clearTimeout(timer); };
  }, [name]);
  return { busy, message };
}

export function useKioskCheckout() {
  const lock = useRef(false);
  const [saving, setSaving] = useState(false);
  const lookup = async (code: string): Promise<CheckoutLookup> => {
    if (!validCheckoutCode(code)) return { state: "invalid_input" };
    const { data, error } = await kioskRpc<CheckoutLookup>("kioskd_checkout_lookup", { p_code: normalizeCheckoutCode(code) });
    if (error || !data) throw new Error("lookup_failed");
    return data;
  };
  const depart = async (code: string, ids: string[]) => {
    if (lock.current) return false;
    lock.current = true; setSaving(true);
    try {
      const { data, error } = await kioskRpc<{ saved: boolean }>("kioskd_checkout_submit", { p_code: normalizeCheckoutCode(code), p_party_ids: ids });
      if (error || data?.saved !== true) throw new Error("departure_not_saved");
      return true;
    } finally { lock.current = false; setSaving(false); }
  };
  return { lookup, depart, saving };
}