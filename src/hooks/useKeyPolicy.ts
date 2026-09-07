import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type KeyEnforcement = "off" | "warn" | "block";

export interface KeyPolicy {
  /** Default loan period applied when a key or fob is issued. */
  defaultLoanPeriod: "none" | "2h" | "eod" | "24h" | "7d";
  /** Minutes after the due time before something counts as overdue. */
  graceMinutes: number;
  /** What happens at check-in when the person already holds an overdue item. */
  enforcement: KeyEnforcement;
  /** Who may extend a due-back date. */
  renewRole: "any" | "admin";
  /** Whether permanent holdings (resident's own key/fob) can be recorded. */
  permanentAllowed: boolean;
}

export const DEFAULT_KEY_POLICY: KeyPolicy = {
  defaultLoanPeriod: "eod",
  graceMinutes: 0,
  enforcement: "off",
  renewRole: "any",
  permanentAllowed: true,
};

const SETTING_KEYS = [
  "key_default_loan_period",
  "key_overdue_grace_minutes",
  "key_overdue_enforcement",
  "key_renew_role",
  "key_permanent_allowed",
];

export function parseKeyPolicy(rows: { key: string; value: string }[] | null | undefined): KeyPolicy {
  const map: Record<string, string> = {};
  (rows || []).forEach((r) => { map[r.key] = r.value; });
  return {
    defaultLoanPeriod: (map.key_default_loan_period as KeyPolicy["defaultLoanPeriod"]) || DEFAULT_KEY_POLICY.defaultLoanPeriod,
    graceMinutes: Number(map.key_overdue_grace_minutes ?? DEFAULT_KEY_POLICY.graceMinutes) || 0,
    enforcement: (map.key_overdue_enforcement as KeyEnforcement) || DEFAULT_KEY_POLICY.enforcement,
    renewRole: (map.key_renew_role as KeyPolicy["renewRole"]) || DEFAULT_KEY_POLICY.renewRole,
    permanentAllowed: (map.key_permanent_allowed ?? "true") !== "false",
  };
}

export async function fetchKeyPolicy(): Promise<KeyPolicy> {
  const { data } = await supabase.from("settings").select("key, value").in("key", SETTING_KEYS);
  return parseKeyPolicy(data as any);
}

/** Turns the configured default loan period into a concrete due-back date. */
export function dueDateFromPolicy(policy: KeyPolicy, from = new Date()): Date | null {
  const d = new Date(from);
  switch (policy.defaultLoanPeriod) {
    case "2h": d.setHours(d.getHours() + 2); return d;
    case "eod": d.setHours(17, 0, 0, 0); return d;
    case "24h": d.setDate(d.getDate() + 1); return d;
    case "7d": d.setDate(d.getDate() + 7); return d;
    default: return null;
  }
}

export function useKeyPolicy() {
  const [policy, setPolicy] = useState<KeyPolicy>(DEFAULT_KEY_POLICY);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    const p = await fetchKeyPolicy();
    setPolicy(p);
    setLoading(false);
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  return { policy, loading, refetch };
}
