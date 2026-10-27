import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSite } from "@/contexts/SiteContext";
import { usePermissions } from "@/hooks/usePermissions";
import { assertSavedMovement } from "@/lib/residentMovement";
import type { Resident } from "@/hooks/useResidents";

/** Dedicated staff contract: exact retries, atomic audit and no optimistic presence. */
export function useResidentMovement(onSaved: () => void | Promise<void>) {
  const { currentSiteId } = useSite();
  const { can, loading } = usePermissions();
  const siteRef = useRef(currentSiteId); siteRef.current = currentSiteId;
  const busy = useRef(false);
  const attempt = useRef<{ fingerprint: string; request: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const save = async (resident: Pick<Resident, "visitorId" | "savedStatus">, action: "leave" | "return", details: Record<string, unknown>) => {
    if (busy.current) throw new Error("A movement is already being saved.");
    const site = currentSiteId;
    if (!site || loading || !can(action === "leave" ? "checkout.perform" : "checkin.create")) throw new Error("Select a site and ask an authorised staff member.");
    const fingerprint = JSON.stringify([site, resident.visitorId, action, resident.savedStatus, details]);
    if (attempt.current && attempt.current.fingerprint !== fingerprint) throw new Error("An earlier save is unconfirmed. Retry the unchanged form or refresh before starting another movement.");
    if (!attempt.current) attempt.current = { fingerprint, request: crypto.randomUUID() };
    busy.current = true; setSaving(true);
    try {
      const { data, error } = await supabase.rpc("staff_resident_movement", { p_site: site, p_resident: resident.visitorId, p_request: attempt.current.request, p_action: action, p_expected_status: resident.savedStatus ?? "", p_details: details as never });
      if (error) throw new Error("The movement was not confirmed. Retry the unchanged form or refresh.");
      assertSavedMovement(data, resident.visitorId, site, action);
      if (siteRef.current !== site) throw new Error("The site changed. Refresh to check the saved movement at the original site.");
      attempt.current = null;
      await onSaved();
      return data;
    } finally { busy.current = false; setSaving(false); }
  };
  return { save, saving };
}