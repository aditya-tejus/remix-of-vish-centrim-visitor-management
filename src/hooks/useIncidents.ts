import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type IncidentPriority = "priority_1" | "priority_2";

export interface ResidentIncident {
  id: string;
  visitor_id: string | null;
  resident_name: string;
  incident_type: string;
  priority: IncidentPriority;
  description: string;
  reported_at: string;
  reported_by: string;
  reported_by_user_id: string | null;
  expected_return_date: string | null;
  status: string;
  resolution_notes: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface NewIncidentInput {
  visitorId: string | null;
  residentName: string;
  priority: IncidentPriority;
  description: string;
  reportedAt: Date;
  expectedReturnDate?: Date | null;
  incidentType?: string;
}

export function useIncidents(status?: string) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["resident-incidents", status],
    queryFn: async () => {
      let q = supabase
        .from("resident_incidents" as any)
        .select("*")
        .order("reported_at", { ascending: false });
      if (status) q = q.eq("status", status);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as ResidentIncident[];
    },
  });

  const createIncident = useMutation({
    mutationFn: async (input: NewIncidentInput) => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;
      const reportedBy =
        (user?.user_metadata?.display_name as string) || user?.email || "Staff";

      const { data, error } = await supabase
        .from("resident_incidents" as any)
        .insert({
          visitor_id: input.visitorId,
          resident_name: input.residentName,
          incident_type: input.incidentType || "resident_absent",
          priority: input.priority,
          description: input.description,
          reported_at: input.reportedAt.toISOString(),
          reported_by: reportedBy,
          reported_by_user_id: user?.id || null,
          expected_return_date: input.expectedReturnDate
            ? input.expectedReturnDate.toISOString()
            : null,
          status: "open",
        } as any)
        .select()
        .single();
      if (error) throw error;

      await supabase.from("audit_log").insert({
        action: "resident_incident_reported",
        details: {
          incident_id: (data as any)?.id,
          resident: input.residentName,
          priority: input.priority,
          incident_type: input.incidentType || "resident_absent",
        },
        records_affected: 1,
        performed_by: reportedBy,
        user_id: user?.id || null,
      } as any);

      return data as unknown as ResidentIncident;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["resident-incidents"] }),
  });

  const resolveIncident = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const { error } = await supabase
        .from("resident_incidents" as any)
        .update({
          status: "closed",
          resolution_notes: notes,
          resolved_at: new Date().toISOString(),
        } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["resident-incidents"] }),
  });

  return { ...query, createIncident, resolveIncident };
}
