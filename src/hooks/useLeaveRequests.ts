import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LeaveRequest {
  id: string;
  visitor_id: string | null;
  resident_name: string;
  resident_room: string | null;
  resident_wing: string | null;
  leave_type: string | null;
  reason: string | null;
  expected_departure: string | null;
  expected_return: string | null;
  companions: any[];
  comments: string;
  source: string;
  external_reference: string | null;
  status: "pending" | "approved" | "rejected";
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
}

export function useLeaveRequests(statusFilter?: string) {
  return useQuery({
    queryKey: ["leave-requests", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("leave_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (statusFilter) {
        query = query.eq("status", statusFilter);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data as unknown as LeaveRequest[]) || [];
    },
  });
}

export function useLeaveRequestMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["leave-requests"] });

  const create = useMutation({
    mutationFn: async (req: Omit<LeaveRequest, "id" | "created_at" | "updated_at" | "reviewed_by" | "reviewed_at" | "review_notes" | "status">) => {
      const { error } = await supabase.from("leave_requests").insert(req as any);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const approve = useMutation({
    mutationFn: async ({ id, reviewed_by, review_notes }: { id: string; reviewed_by: string; review_notes?: string }) => {
      const { error } = await supabase
        .from("leave_requests")
        .update({
          status: "approved",
          reviewed_by,
          reviewed_at: new Date().toISOString(),
          review_notes: review_notes || null,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const reject = useMutation({
    mutationFn: async ({ id, reviewed_by, review_notes }: { id: string; reviewed_by: string; review_notes?: string }) => {
      const { error } = await supabase
        .from("leave_requests")
        .update({
          status: "rejected",
          reviewed_by,
          reviewed_at: new Date().toISOString(),
          review_notes: review_notes || null,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("leave_requests").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { create, approve, reject, remove };
}

export function useLeaveApprovalSetting() {
  const [mode, setMode] = useState<"auto" | "manual">("manual");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("settings")
      .select("value")
      .eq("key", "leave_approval_mode")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value) setMode(data.value as "auto" | "manual");
        setLoading(false);
      });
  }, []);

  const updateMode = useCallback(async (newMode: "auto" | "manual") => {
    setMode(newMode);
    const { data: existing } = await supabase
      .from("settings")
      .select("id")
      .eq("key", "leave_approval_mode")
      .maybeSingle();
    if (existing) {
      await supabase.from("settings").update({ value: newMode, updated_at: new Date().toISOString() }).eq("key", "leave_approval_mode");
    } else {
      await supabase.from("settings").insert({ key: "leave_approval_mode", value: newMode });
    }
  }, []);

  return { mode, loading, updateMode };
}
