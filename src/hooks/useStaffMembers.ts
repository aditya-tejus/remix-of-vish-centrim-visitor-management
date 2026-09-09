import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface StaffMember {
  id: string;
  firstName: string;
  surname: string;
  name: string;
  role: string;
  department: string | null;
  phone: string | null;
  email: string | null;
  isActive: boolean;
}

interface UseStaffMembersOptions {
  /** Kiosk / unauthenticated context: name and department only. */
  publicMode?: boolean;
  /** Kiosk context: the site this device belongs to. Results never cross sites. */
  siteId?: string | null;
}

export function useStaffMembers({ publicMode = false, siteId = null }: UseStaffMembersOptions = {}) {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStaff = useCallback(async () => {
    if (publicMode) {
      const { data, error } = await supabase.rpc("kiosk_staff_directory" as any, {
        p_search: null,
        p_branch_id: siteId ?? null,
      });
      if (!error && data) {
        setStaff(
          (data as any[]).map((s) => ({
            id: s.id,
            firstName: s.first_name,
            surname: s.surname,
            name: `${s.first_name} ${s.surname}`,
            role: "",
            department: s.department,
            phone: null,
            email: null,
            isActive: true,
          }))
        );
      }
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("staff_members")
      .select("*")
      .eq("is_active", true)
      .order("first_name");

    if (!error && data) {
      setStaff(
        data.map((s: any) => ({
          id: s.id,
          firstName: s.first_name,
          surname: s.surname,
          name: `${s.first_name} ${s.surname}`,
          role: s.role,
          department: s.department,
          phone: s.phone,
          email: s.email,
          isActive: s.is_active,
        }))
      );
    }
    setLoading(false);
  }, [publicMode]);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  return { staff, loading, refetch: fetchStaff };
}
