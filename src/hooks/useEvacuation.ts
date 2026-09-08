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

export type EmergencyState = "draft" | "active" | "paused" | "resolved" | "reviewed";

export interface EvacuationDrill {
  id: string;
  title: string;
  status: string;
  state: EmergencyState;
  event_class: "drill" | "real";
  branch_id: string | null;
  area_id: string | null;
  activated_by: string | null;
  snapshot_at: string | null;
  review_notes: string | null;
  reviewed_at: string | null;
  started_at: string;
  ended_at: string | null;
  started_by: string;
  notes: string;
  total_people: number;
  accounted_for: number;
  unaccounted_reason: string | null;
  event_type: string;
  created_at: string;
}


export interface EvacuationAttendance {
  id: string;
  drill_id: string;
  person_name: string;
  person_type: string;
  visitor_id: string | null;
  parent_visitor_id: string | null;
  companion_index: number | null;
  assistance_level: string | null;
  contact_phone: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  area_label: string | null;
  room_label: string | null;
  responsible_staff: string | null;
  associated_with: string | null;

  evacuation_point_id: string | null;
  status: string;
  marked_safe_at: string | null;
  marked_by: string | null;
  notes: string;
}

/** Anyone who can appear on a roll call, including named companions. */
export interface RollCallSeed {
  name: string;
  type: string;
  visitorId?: string | null;
  companionIndex?: number | null;
  assistanceLevel?: string;
  contactPhone?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  area?: string;
  room?: string;
  responsibleStaff?: string;
  associatedWith?: string;
}


export type AttendanceStatus =
  | "safe"
  | "safe_elsewhere"
  | "not_located"
  | "assistance_required"
  | "unaccounted"
  | "evacuated_offsite";

export const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
  safe: "Safe",
  safe_elsewhere: "Safe elsewhere",
  not_located: "Not located",
  assistance_required: "Assistance required",
  unaccounted: "Not accounted for",
  evacuated_offsite: "Evacuated off-site",
};

/** Statuses that count towards "everyone accounted for". */
export const ACCOUNTED_STATUSES: AttendanceStatus[] = ["safe", "safe_elsewhere", "evacuated_offsite"];

function seedColumns(p: RollCallSeed) {
  const isCompanion = p.companionIndex != null;
  return {
    person_name: p.name,
    person_type: p.type,
    visitor_id: isCompanion ? null : p.visitorId || null,
    parent_visitor_id: isCompanion ? p.visitorId || null : null,
    companion_index: isCompanion ? p.companionIndex : null,
    assistance_level: p.assistanceLevel || null,
    contact_phone: p.contactPhone || null,
    emergency_contact_name: p.emergencyContactName || null,
    emergency_contact_phone: p.emergencyContactPhone || null,
    area_label: p.area || null,
    room_label: p.room || null,
    responsible_staff: p.responsibleStaff || null,
    associated_with: p.associatedWith || null,
  };
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
      // "active" means the event is still being worked on, paused included.
      if (status === "active") query = query.in("state", ["draft", "active", "paused"]);
      else if (status) query = query.eq("state", status);
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
    mutationFn: async ({
      title,
      people,
      eventType,
      eventClass,
      branchId,
      areaId,
    }: {
      title: string;
      people: RollCallSeed[];
      eventType?: string;
      eventClass?: "drill" | "real";
      branchId?: string | null;
      areaId?: string | null;
    }) => {
      const now = new Date().toISOString();
      const { data: userData } = await supabase.auth.getUser();
      const { data: drill, error } = await supabase
        .from("evacuation_drills" as any)
        .insert({
          title,
          total_people: people.length,
          state: "active",
          event_class: eventClass || (eventType === "drill" ? "drill" : "real"),
          event_type: eventType || "drill",
          branch_id: branchId || null,
          area_id: areaId || null,
          activated_by: userData?.user?.id || null,
          // The snapshot is taken once; later check-ins do not rewrite it.
          snapshot_at: now,
        } as any)
        .select()
        .single();
      if (error) throw error;
      const drillId = (drill as any).id;

      if (people.length > 0) {
        const rows = people.map((p) => ({
          drill_id: drillId,
          status: "unaccounted",
          ...seedColumns(p),
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
    mutationFn: async ({ id, pointId, status, markedBy, note }: { id: string; pointId?: string; status?: AttendanceStatus; markedBy?: string; note?: string }) => {
      const next = status || "safe";
      const { error } = await supabase
        .from("evacuation_attendance" as any)
        .update({
          status: next,
          marked_by: markedBy || null,
          marked_safe_at: new Date().toISOString(),
          evacuation_point_id: pointId || null,
          ...(note !== undefined ? { note } : {}),
        } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidateAll,
  });

  /** Undoing an outcome is a correction: the reason is stored with the audit entry. */
  const markUnsafe = useMutation({
    mutationFn: async (input: string | { id: string; reason?: string; drillId?: string; personName?: string }) => {
      const id = typeof input === "string" ? input : input.id;
      const reason = typeof input === "string" ? undefined : input.reason;
      const { error } = await supabase
        .from("evacuation_attendance" as any)
        .update({ status: "unaccounted", marked_safe_at: null, evacuation_point_id: null } as any)
        .eq("id", id);
      if (error) throw error;
      if (reason) {
        const { data: latest } = await supabase
          .from("emergency_actions" as any)
          .select("id")
          .eq("attendance_id", id)
          .order("created_at", { ascending: false })
          .limit(1);
        const actionId = (latest as any[])?.[0]?.id;
        if (actionId) {
          await supabase.from("emergency_actions" as any).update({ reason, action: "correction" } as any).eq("id", actionId);
        }
      }
    },
    onSuccess: invalidateAll,
  });

  /** Moves the emergency event between draft, active, paused, resolved and reviewed. */
  const setEmergencyState = useMutation({
    mutationFn: async ({ drillId, state, accounted, reason, reviewNotes }: { drillId: string; state: EmergencyState; accounted?: number; reason?: string; reviewNotes?: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      const patch: Record<string, unknown> = { state };
      if (accounted != null) patch.accounted_for = accounted;
      if (reason) patch.unaccounted_reason = reason;
      if (reviewNotes !== undefined) patch.review_notes = reviewNotes;
      if (state === "resolved") patch.ended_at = new Date().toISOString();
      if (state === "reviewed") {
        patch.reviewed_at = new Date().toISOString();
        patch.reviewed_by = userData?.user?.id || null;
      }
      const { error } = await supabase.from("evacuation_drills" as any).update(patch as any).eq("id", drillId);
      if (error) throw error;
      await (supabase as any).rpc("log_audit", {
        _action: `emergency.${state}`,
        _details: { drill_id: drillId, accounted: accounted ?? null },
        _records: 1,
        _reason: reason || null,
      });
    },
    onSuccess: invalidateAll,
  });

  const endDrill = useMutation({
    mutationFn: async ({ drillId, accounted, reason }: { drillId: string; accounted: number; reason?: string }) => {
      const { error } = await supabase
        .from("evacuation_drills" as any)
        .update({ state: "resolved", ended_at: new Date().toISOString(), accounted_for: accounted, unaccounted_reason: reason || null } as any)
        .eq("id", drillId);
      if (error) throw error;
      await (supabase as any).rpc("log_audit", {
        _action: "emergency.resolved",
        _details: { drill_id: drillId, accounted },
        _records: 1,
        _reason: reason || null,
      });
    },
    onSuccess: invalidateAll,
  });


  // Adds someone who arrived after the roll call started
  const addAttendee = useMutation({
    mutationFn: async ({ drillId, person, status, pointId, markedBy }: { drillId: string; person: RollCallSeed; status?: AttendanceStatus; pointId?: string; markedBy?: string }) => {
      const { data, error } = await supabase
        .from("evacuation_attendance" as any)
        .insert({
          drill_id: drillId,
          ...seedColumns(person),
          status: status || "unaccounted",
          marked_safe_at: status && status !== "unaccounted" ? new Date().toISOString() : null,
          marked_by: markedBy || null,
          evacuation_point_id: pointId || null,
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
