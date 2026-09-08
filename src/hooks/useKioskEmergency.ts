import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Kiosk emergency access.
 *
 * The kiosk never reads the emergency tables. Everything goes through
 * purpose-built server functions that check the staff PIN, lock out after
 * repeated failures, and return only the fields needed to account for people.
 */
export interface KioskRollCallRow {
  attendance_id: string;
  drill_id: string;
  drill_title: string;
  drill_state: string;
  event_class: string;
  person_name: string;
  person_type: string;
  location_label: string | null;
  contact_phone: string | null;
  status: string;
  assistance_level: string | null;
  marked_safe_at: string | null;
}

export function useKioskEmergency(pin: string | null) {
  const [rows, setRows] = useState<KioskRollCallRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!pin) return;
    setLoading(true);
    const { data, error } = await (supabase as any).rpc("kiosk_emergency_rollcall", { p_pin: pin });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setError(null);
    setRows((data || []) as KioskRollCallRow[]);
  }, [pin]);

  useEffect(() => {
    void refresh();
    if (!pin) return;
    const timer = window.setInterval(() => void refresh(), 15000);
    return () => window.clearInterval(timer);
  }, [pin, refresh]);

  const mark = useCallback(
    async (attendanceId: string, status: string, markedBy?: string, reason?: string) => {
      if (!pin) return false;
      const { error } = await (supabase as any).rpc("kiosk_emergency_mark", {
        p_pin: pin,
        p_attendance_id: attendanceId,
        p_status: status,
        p_marked_by: markedBy || "Kiosk (PIN)",
        p_reason: reason || null,
      });
      if (error) {
        setError(error.message);
        return false;
      }
      await refresh();
      return true;
    },
    [pin, refresh]
  );

  return { rows, loading, error, refresh, mark };
}
