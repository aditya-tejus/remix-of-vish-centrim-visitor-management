import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

export interface EvacuationPoint {
  id: string;
  name: string;
  description: string;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
}

export interface EvacuationDrill {
  id: string;
  title: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  started_by: string;
  notes: string;
  total_people: number;
  accounted_for: number;
  created_at: string;
}

export interface EvacuationAttendance {
  id: string;
  drill_id: string;
  person_name: string;
  person_type: string;
  visitor_id: string | null;
  evacuation_point_id: string | null;
  status: string;
  marked_safe_at: string | null;
  marked_by: string | null;
  notes: string;
}

export function useEvacuationPoints() {
  return useQuery({
    queryKey: ["evacuation-points"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("evacuation_points" as any)
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return (data || []) as unknown as EvacuationPoint[];
    },
  });
}

export function useEvacuationDrills(status?: string) {
  return useQuery({
    queryKey: ["evacuation-drills", status],
    queryFn: async () => {
      let query = supabase.from("evacuation_drills" as any).select("*").order("started_at", { ascending: false });
      if (status) query = query.eq("status", status);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as EvacuationDrill[];
    },
  });
}

export function useEvacuationAttendance(drillId?: string) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["evacuation-attendance", drillId],
    queryFn: async () => {
      if (!drillId) return [];
      const { data, error } = await supabase
        .from("evacuation_attendance" as any)
        .select("*")
        .eq("drill_id", drillId)
        .order("person_name");
      if (error) throw error;
      return (data || []) as unknown as EvacuationAttendance[];
    },
    enabled: !!drillId,
  });

  // Real-time subscription
  useEffect(() => {
    if (!drillId) return;
    const channel = supabase
      .channel(`evacuation-${drillId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "evacuation_attendance", filter: `drill_id=eq.${drillId}` }, () => {
        qc.invalidateQueries({ queryKey: ["evacuation-attendance", drillId] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "evacuation_drills" }, () => {
        qc.invalidateQueries({ queryKey: ["evacuation-drills"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [drillId, qc]);

  return query;
}

export function useEvacuationMutations() {
  const qc = useQueryClient();
  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["evacuation-drills"] });
    qc.invalidateQueries({ queryKey: ["evacuation-attendance"] });
  };

  const startDrill = useMutation({
    mutationFn: async ({ title, people }: { title: string; people: { name: string; type: string; visitor_id?: string }[] }) => {
      const { data: drill, error } = await supabase
        .from("evacuation_drills" as any)
        .insert({ title, total_people: people.length, status: "active" } as any)
        .select()
        .single();
      if (error) throw error;
      const drillId = (drill as any).id;
      
      if (people.length > 0) {
        const rows = people.map((p) => ({
          drill_id: drillId,
          person_name: p.name,
          person_type: p.type,
          visitor_id: p.visitor_id || null,
          status: "unaccounted",
        }));
        const { error: attError } = await supabase
          .from("evacuation_attendance" as any)
          .insert(rows as any);
        if (attError) throw attError;
      }
      return drill as unknown as EvacuationDrill;
    },
    onSuccess: invalidateAll,
  });

  const markSafe = useMutation({
    mutationFn: async ({ id, pointId }: { id: string; pointId?: string }) => {
      const { error } = await supabase
        .from("evacuation_attendance" as any)
        .update({
          status: "safe",
          marked_safe_at: new Date().toISOString(),
          evacuation_point_id: pointId || null,
        } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidateAll,
  });

  const markUnsafe = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("evacuation_attendance" as any)
        .update({ status: "unaccounted", marked_safe_at: null, evacuation_point_id: null } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidateAll,
  });

  const endDrill = useMutation({
    mutationFn: async ({ drillId, accounted }: { drillId: string; accounted: number }) => {
      const { error } = await supabase
        .from("evacuation_drills" as any)
        .update({ status: "completed", ended_at: new Date().toISOString(), accounted_for: accounted } as any)
        .eq("id", drillId);
      if (error) throw error;
    },
    onSuccess: invalidateAll,
  });

  // Adds someone who arrived after the roll call started
  const addAttendee = useMutation({
    mutationFn: async ({ drillId, name, type, visitorId, safe }: { drillId: string; name: string; type: string; visitorId?: string; safe?: boolean }) => {
      const { data, error } = await supabase
        .from("evacuation_attendance" as any)
        .insert({
          drill_id: drillId,
          person_name: name,
          person_type: type,
          visitor_id: visitorId || null,
          status: safe ? "safe" : "unaccounted",
          marked_safe_at: safe ? new Date().toISOString() : null,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as EvacuationAttendance;
    },
    onSuccess: invalidateAll,
  });

  // Points mutations

  const addPoint = useMutation({
    mutationFn: async (point: { name: string; description?: string }) => {
      const { error } = await supabase.from("evacuation_points" as any).insert(point as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["evacuation-points"] }),
  });

  const updatePoint = useMutation({
    mutationFn: async ({ id, ...fields }: Partial<EvacuationPoint> & { id: string }) => {
      const { error } = await supabase.from("evacuation_points" as any).update(fields as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["evacuation-points"] }),
  });

  const deletePoint = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("evacuation_points" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["evacuation-points"] }),
  });

  return { startDrill, markSafe, markUnsafe, endDrill, addAttendee, addPoint, updatePoint, deletePoint };
}
