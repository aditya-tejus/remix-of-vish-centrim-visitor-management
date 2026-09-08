import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/** Named staff actions. These mirror the database permission list exactly. */
export type Permission =
  | "presence.view"
  | "checkin.create"
  | "checkout.perform"
  | "person.edit"
  | "screening.view"
  | "assistance.view"
  | "credentials.view"
  | "emergency.activate"
  | "emergency.mark_safe"
  | "emergency.export"
  | "watchlist.manage"
  | "privacy.manage"
  | "data.export"
  | "data.erase"
  | "settings.administer";

export const PERMISSION_LABELS: Record<Permission, string> = {
  "presence.view": "See who is on site",
  "checkin.create": "Check someone in",
  "checkout.perform": "Check someone out",
  "person.edit": "Edit a person's details",
  "screening.view": "View screening answers",
  "assistance.view": "View resident assistance information",
  "credentials.view": "View contractor documents",
  "emergency.activate": "Activate an emergency",
  "emergency.mark_safe": "Mark people safe",
  "emergency.export": "Export an emergency snapshot",
  "watchlist.manage": "Manage the watchlist",
  "privacy.manage": "Manage privacy and retention",
  "data.export": "Export visitor data",
  "data.erase": "Erase visitor data",
  "settings.administer": "Administer settings",
};

export const ALL_PERMISSIONS = Object.keys(PERMISSION_LABELS) as Permission[];

/** Permissions granted to the signed-in person's role. */
export function usePermissions() {
  const { role, loading: authLoading } = useAuth();

  const { data = [], isLoading } = useQuery({
    queryKey: ["role-permissions", role],
    enabled: !!role,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("role_permissions" as any)
        .select("permission")
        .eq("role", role as any);
      if (error) throw error;
      return ((data || []) as any[]).map((r) => r.permission as Permission);
    },
  });

  const can = (permission: Permission) => data.includes(permission);

  return { permissions: data, can, loading: authLoading || isLoading, role };
}
