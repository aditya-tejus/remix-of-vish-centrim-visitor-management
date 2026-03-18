import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Wing {
  id: string;
  name: string;
  color: string;
  floor: string | null;
  sort_order: number;
  is_active: boolean;
  branch_id: string | null;
}

export function useWings() {
  return useQuery({
    queryKey: ["wings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wings")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return (data as unknown as Wing[]) || [];
    },
  });
}

export interface ResidentDetail {
  id: string;
  visitor_id: string;
  wing_id: string | null;
  room: string | null;
  care_level: string;
  key_worker: string | null;
  photo_url: string | null;
}

export function useResidentDetails() {
  return useQuery({
    queryKey: ["resident-details"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resident_details")
        .select("*");
      if (error) throw error;
      return (data as unknown as ResidentDetail[]) || [];
    },
  });
}
