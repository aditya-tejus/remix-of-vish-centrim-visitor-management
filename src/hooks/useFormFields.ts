import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { VisitorType } from "@/hooks/useHealthQuestions";

export interface FormField {
  id: string;
  field_key: string;
  label: string;
  field_type: string;
  required: boolean;
  sort_order: number;
  is_active: boolean;
  visitor_type: string;
}

export function useFormFields(visitorType?: VisitorType, prefix?: string) {
  return useQuery({
    queryKey: ["form-fields", visitorType || "all", prefix || "all"],
    queryFn: async () => {
      let query = supabase.from("form_fields" as any).select("*").order("sort_order");
      if (visitorType) query = query.eq("visitor_type", visitorType);
      const { data, error } = await query;
      if (error) throw error;
      let results = (data || []) as unknown as FormField[];
      if (prefix !== undefined) {
        results = results.filter((f) =>
          prefix ? f.field_key.startsWith(prefix) : !f.field_key.startsWith("companion_")
        );
      }
      return results;
    },
  });
}

export function useCompanionFields(visitorType?: VisitorType) {
  return useFormFields(visitorType, "companion_");
}

export function useFormFieldMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["form-fields"] });

  const create = useMutation({
    mutationFn: async (field: Omit<FormField, "id">) => {
      const { error } = await supabase
        .from("form_fields" as any)
        .insert(field as any);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, ...fields }: Partial<FormField> & { id: string }) => {
      const { error } = await supabase
        .from("form_fields" as any)
        .update({ ...fields, updated_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("form_fields" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { create, update, remove };
}
