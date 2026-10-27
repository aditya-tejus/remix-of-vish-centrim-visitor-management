import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSite } from "@/contexts/SiteContext";


export interface Resident {
  id: string;
  visitorId: string;
  firstName: string;
  surname: string;
  name: string;
  room: string;
  wing: string;
  wingId: string | null;
  careLevel: string;
  keyWorker: string | null;
  photoUrl: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  mobilityLevel: string;
  dolsLpsFlag: boolean;
  riskAssessmentLevel: string;
  medicationNotes: string | null;
  mobilityAids: string[];
  notes: string | null;
  email: string;
  mobile: string;
  savedStatus?: string;
  checkOutTime?: Date | null;
  expectedReturnDate?: Date;
  checkoutReason?: string;
  leaveType?: string;
  accompaniedByName?: string;
  comments?: string;
}

interface UseResidentsOptions {
  /** Kiosk / unauthenticated context: never request contact details. */
  publicMode?: boolean;
  enabled?: boolean;
  /** Kiosk context: the site this device belongs to. Results never cross sites. */
  siteId?: string | null;
}

export function useResidents(options: UseResidentsOptions = {}) {
  const { publicMode = false, enabled = true, siteId = null } = options;
  const { currentSiteId, isLegacySite } = useSite();
  const [residents, setResidents] = useState<Resident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const revision = useRef(0);

  const fetchResidents = useCallback(async () => {
    const request = ++revision.current;
    setResidents([]);
    // Public devices cannot discover residents, even behind a search box.
    if (publicMode || !enabled || !currentSiteId) { setLoading(false); return; }
    setLoading(true); setError(null);

    const contactCols = "email, mobile,";

    let query = supabase
      .from("visitors")
      .select(`
        id, first_name, surname, status, check_out_time, expected_return_date, checkout_reason, leave_type, accompanied_by_name, comments, ${contactCols}
        resident_details (
          id, room, wing_id, care_level, key_worker, photo_url,
          emergency_contact_name, emergency_contact_phone,
          mobility_level, dols_lps_flag, risk_assessment_level,
          medication_notes, mobility_aids, notes,
          wing:wings ( id, name )
        )
      `)
      .eq("type", "resident");

    // Site isolation: residents belong to one site. Records with no site are only
    // visible on the original/legacy site so they are never mixed into newer sites.
    if (currentSiteId) {
      query = isLegacySite
        ? query.or(`branch_id.eq.${currentSiteId},branch_id.is.null`)
        : query.eq("branch_id", currentSiteId);
    }

    const { data, error } = await query.order("first_name");


    if (request !== revision.current) return;
    if (error) setError("Resident records could not be loaded. Please try again.");
    if (!error && data) {
      const mapped: Resident[] = data.map((v: any) => {
        const rd = v.resident_details;
        const wingRel = Array.isArray(rd?.wing) ? rd?.wing?.[0] : rd?.wing;
        return {
          id: rd?.id || v.id,
          visitorId: v.id,
          firstName: v.first_name,
          surname: v.surname,
          name: `${v.first_name} ${v.surname}`,
          room: rd?.room ? `Room ${rd.room}` : "",
          wing: wingRel?.name || "",
          wingId: rd?.wing_id || null,
          careLevel: rd?.care_level || "standard",
          keyWorker: rd?.key_worker || null,
          photoUrl: rd?.photo_url || null,
          emergencyContactName: rd?.emergency_contact_name || null,
          emergencyContactPhone: rd?.emergency_contact_phone || null,
          mobilityLevel: rd?.mobility_level || "",
          dolsLpsFlag: rd?.dols_lps_flag || false,
          riskAssessmentLevel: rd?.risk_assessment_level || "standard",
          medicationNotes: rd?.medication_notes || null,
          mobilityAids: rd?.mobility_aids || [],
          notes: rd?.notes || null,
          email: v.email || "",
          mobile: v.mobile || "",
          savedStatus: v.status,
          checkOutTime: v.check_out_time ? new Date(v.check_out_time) : null,
          expectedReturnDate: v.expected_return_date ? new Date(v.expected_return_date) : undefined,
          checkoutReason: v.checkout_reason ?? undefined,
          leaveType: v.leave_type ?? undefined,
          accompaniedByName: v.accompanied_by_name ?? undefined,
          comments: v.comments ?? "",
        };
      });
      setResidents(mapped);
    }
    setLoading(false);
  }, [publicMode, enabled, siteId, currentSiteId, isLegacySite]);

  useEffect(() => {
    void fetchResidents();
    return () => { revision.current++; };
  }, [fetchResidents]);

  return { residents, loading, error, refetch: fetchResidents };
}
