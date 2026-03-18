import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LeaveType {
  id: string;
  name: string;
  emoji: string;
  description: string;
  color: string;
  is_active: boolean;
  sort_order: number;
}

export function useLeaveTypes() {
  return useQuery({
    queryKey: ["leave-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leave_types")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as LeaveType[];
    },
  });
}

export function useActiveLeaveTypes() {
  return useQuery({
    queryKey: ["leave-types", "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leave_types")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as LeaveType[];
    },
  });
}

export function useLeaveTypeMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["leave-types"] });

  const add = useMutation({
    mutationFn: async (lt: Omit<LeaveType, "id">) => {
      const { error } = await supabase.from("leave_types").insert(lt);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, ...fields }: Partial<LeaveType> & { id: string }) => {
      const { error } = await supabase.from("leave_types").update({ ...fields, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("leave_types").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { add, update, remove };
}
