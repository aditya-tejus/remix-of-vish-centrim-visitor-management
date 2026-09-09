import { useState, useEffect, useCallback } from "react";
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
}

interface UseResidentsOptions {
  /** Kiosk / unauthenticated context: never request contact details. */
  publicMode?: boolean;
}

export function useResidents(options: UseResidentsOptions = {}) {
  const { publicMode = false } = options;
  const { currentSiteId, isLegacySite } = useSite();
  const [residents, setResidents] = useState<Resident[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchResidents = useCallback(async () => {
    // Kiosk: name, room and area only — no contact, care, clinical or risk information.
    if (publicMode) {
      const { data, error } = await supabase.rpc("kiosk_resident_directory" as any, { p_search: null });
      if (!error && data) {
        setResidents(
          (data as any[]).map((r) => ({
            id: r.visitor_id,
            visitorId: r.visitor_id,
            firstName: r.first_name,
            surname: r.surname,
            name: `${r.first_name} ${r.surname}`,
            room: r.room ? `Room ${r.room}` : "",
            wing: r.area_name || "",
            wingId: null,
            careLevel: "standard",
            keyWorker: null,
            photoUrl: null,
            emergencyContactName: null,
            emergencyContactPhone: null,
            mobilityLevel: "",
            dolsLpsFlag: false,
            riskAssessmentLevel: "standard",
            medicationNotes: null,
            mobilityAids: [],
            notes: null,
            email: "",
            mobile: "",
          }))
        );
      }
      setLoading(false);
      return;
    }

    const contactCols = "email, mobile,";

    let query = supabase
      .from("visitors")
      .select(`
        id, first_name, surname, ${contactCols}
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
        };
      });
      setResidents(mapped);
    }
    setLoading(false);
  }, [publicMode]);

  useEffect(() => {
    fetchResidents();
  }, [fetchResidents]);

  return { residents, loading, refetch: fetchResidents };
}
