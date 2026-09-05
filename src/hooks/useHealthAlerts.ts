import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Counts today's kiosk check-ins that were blocked by health screening,
 * so reception can be alerted that somebody needs assistance.
 */
export function useHealthAlerts() {
  return useQuery({
    queryKey: ["health-alerts"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const { count, error } = await supabase
        .from("audit_log")
        .select("id", { count: "exact", head: true })
        .eq("action", "kiosk_health_block")
        .gte("created_at", start.toISOString());
      if (error) return 0;
      return count ?? 0;
    },
  });
}
