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
  /** Short guidance shown under the field at the desk. */
  help_text?: string | null;
  /** Read-only fields show a saved value but cannot be typed into. */
  is_editable?: boolean;
  /** Choices for a choice list. */
  options?: unknown;
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

/** Every configuration change to check-in fields is written to the audit trail. */
async function logFieldChange(action: string, details: Record<string, unknown>) {
  const { data: auth } = await supabase.auth.getUser();
  await supabase.from("audit_log").insert({
    action,
    performed_by: auth.user?.email || "Staff",
    user_id: auth.user?.id ?? null,
    records_affected: 1,
    details: details as any,
    change_reason: "Check-in field configuration changed",
  });
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
      await logFieldChange("form_field_created", { field_key: field.field_key, visitor_type: field.visitor_type, label: field.label });
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
      await logFieldChange("form_field_updated", { field_id: id, changes: fields });
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
      await logFieldChange("form_field_deleted", { field_id: id });
    },
    onSuccess: invalidate,
  });

  return { create, update, remove };
}
