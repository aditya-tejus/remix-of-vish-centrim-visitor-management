import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type VisitorType = "visitor" | "contractor" | "resident" | "staff";

export interface HealthQuestion {
  id: string;
  question: string;
  type: "yesno" | "text" | "textarea" | "select" | "checkbox" | "file";
  required: boolean;
  placeholder: string | null;
  options: string[];
  sort_order: number;
  is_active: boolean;
  visitor_type: VisitorType;
  /** Outcome rules (all optional — questions without rules behave as before). */
  expected_answer?: string | null;
  warning_answers?: string[];
  severity?: "info" | "warning" | "critical";
  staff_message?: string | null;
  outcome_action?: "none" | "flag" | "block";
}

export interface VaccinationField {
  id: string;
  name: string;
  label: string;
  field_type: "date" | "text" | "select" | "file";
  options: string[];
  required: boolean;
  sort_order: number;
  is_active: boolean;
  visitor_type: VisitorType;
}

export function useHealthQuestions(visitorType?: VisitorType) {
  return useQuery({
    queryKey: ["health-questions", visitorType || "all"],
    queryFn: async () => {
      let query = supabase.from("health_questions").select("*").order("sort_order");
      if (visitorType) query = query.eq("visitor_type", visitorType);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map((d: any) => ({
        ...d,
        options: Array.isArray(d.options) ? d.options : [],
        warning_answers: Array.isArray(d.warning_answers) ? d.warning_answers : [],
      })) as HealthQuestion[];
    },
  });
}

export function useActiveHealthQuestions(visitorType?: VisitorType) {
  return useQuery({
    queryKey: ["health-questions", "active", visitorType || "all"],
    queryFn: async () => {
      let query = supabase.from("health_questions").select("*").eq("is_active", true).order("sort_order");
      if (visitorType) query = query.eq("visitor_type", visitorType);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map((d: any) => ({
        ...d,
        options: Array.isArray(d.options) ? d.options : [],
        warning_answers: Array.isArray(d.warning_answers) ? d.warning_answers : [],
      })) as HealthQuestion[];
    },
  });
}

export function useVaccinationFields(visitorType?: VisitorType) {
  return useQuery({
    queryKey: ["vaccination-fields", visitorType || "all"],
    queryFn: async () => {
      let query = supabase.from("vaccination_fields").select("*").order("sort_order");
      if (visitorType) query = query.eq("visitor_type", visitorType);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map((d: any) => ({
        ...d,
        options: Array.isArray(d.options) ? d.options : [],
      })) as VaccinationField[];
    },
  });
}

export function useActiveVaccinationFields(visitorType?: VisitorType) {
  return useQuery({
    queryKey: ["vaccination-fields", "active", visitorType || "all"],
    queryFn: async () => {
      let query = supabase.from("vaccination_fields").select("*").eq("is_active", true).order("sort_order");
      if (visitorType) query = query.eq("visitor_type", visitorType);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map((d: any) => ({
        ...d,
        options: Array.isArray(d.options) ? d.options : [],
      })) as VaccinationField[];
    },
  });
}

export function useHealthQuestionMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["health-questions"] });

  const add = useMutation({
    mutationFn: async (q: Omit<HealthQuestion, "id" | "is_active">) => {
      const { error } = await supabase.from("health_questions").insert({
        question: q.question,
        type: q.type,
        required: q.required,
        placeholder: q.placeholder,
        options: q.options as any,
        sort_order: q.sort_order,
        visitor_type: q.visitor_type,
        expected_answer: q.expected_answer ?? null,
        warning_answers: (q.warning_answers ?? []) as any,
        severity: q.severity ?? "info",
        staff_message: q.staff_message ?? null,
        outcome_action: q.outcome_action ?? "none",
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, ...q }: Partial<HealthQuestion> & { id: string }) => {
      const updates: any = { ...q, updated_at: new Date().toISOString() };
      if (updates.options) updates.options = updates.options as any;
      const { error } = await supabase.from("health_questions").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("health_questions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { add, update, remove };
}

export function useVaccinationFieldMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["vaccination-fields"] });

  const add = useMutation({
    mutationFn: async (f: Omit<VaccinationField, "id" | "is_active">) => {
      const { error } = await supabase.from("vaccination_fields").insert({
        name: f.name,
        label: f.label,
        field_type: f.field_type,
        options: f.options as any,
        required: f.required,
        sort_order: f.sort_order,
        visitor_type: f.visitor_type,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, ...f }: Partial<VaccinationField> & { id: string }) => {
      const updates: any = { ...f, updated_at: new Date().toISOString() };
      if (updates.options) updates.options = updates.options as any;
      const { error } = await supabase.from("vaccination_fields").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vaccination_fields").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { add, update, remove };
}
