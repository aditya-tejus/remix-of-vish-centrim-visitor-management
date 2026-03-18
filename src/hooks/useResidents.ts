import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

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

export function useResidents() {
  const [residents, setResidents] = useState<Resident[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchResidents = useCallback(async () => {
    const { data, error } = await supabase
      .from("visitors")
      .select(`
        id, first_name, surname, email, mobile, address,
        resident_details (
          id, room, wing_id, care_level, key_worker, photo_url,
          emergency_contact_name, emergency_contact_phone,
          mobility_level, dols_lps_flag, risk_assessment_level,
          medication_notes, mobility_aids, notes
        )
      `)
      .eq("type", "resident")
      .order("first_name");

    if (!error && data) {
      const mapped: Resident[] = data.map((v: any) => {
        const rd = v.resident_details;
        const addressParts = (v.address || "").split(",").map((s: string) => s.trim());
        const wingFromAddress = addressParts.find((p: string) => p.toLowerCase().includes("wing")) || "";
        return {
          id: rd?.id || v.id,
          visitorId: v.id,
          firstName: v.first_name,
          surname: v.surname,
          name: `${v.first_name} ${v.surname}`,
          room: rd?.room ? `Room ${rd.room}` : addressParts[0] || "",
          wing: wingFromAddress,
          wingId: rd?.wing_id || null,
          careLevel: rd?.care_level || "standard",
          keyWorker: rd?.key_worker || null,
          photoUrl: rd?.photo_url || null,
          emergencyContactName: rd?.emergency_contact_name || null,
          emergencyContactPhone: rd?.emergency_contact_phone || null,
          mobilityLevel: rd?.mobility_level || "independent",
          dolsLpsFlag: rd?.dols_lps_flag || false,
          riskAssessmentLevel: rd?.risk_assessment_level || "standard",
          medicationNotes: rd?.medication_notes || null,
          mobilityAids: rd?.mobility_aids || [],
          notes: rd?.notes || null,
          email: v.email,
          mobile: v.mobile,
        };
      });
      setResidents(mapped);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchResidents();
  }, [fetchResidents]);

  return { residents, loading, refetch: fetchResidents };
}
