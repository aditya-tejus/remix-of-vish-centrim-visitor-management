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

export function useStaffMembers() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStaff = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  return { staff, loading, refetch: fetchStaff };
}
