import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FeedbackQuestion {
  id: string;
  question: string;
  category: string;
  is_active: boolean;
  sort_order: number;
  visitor_type: string;
}

export interface FeedbackResponse {
  id: string;
  visitor_id: string | null;
  visitor_name: string;
  visitor_type: string;
  question_id: string;
  rating: number;
  comment: string;
  created_at: string;
}

export function useFeedbackQuestions(activeOnly = false, visitorType?: string) {
  return useQuery({
    queryKey: ["feedback-questions", activeOnly, visitorType],
    queryFn: async () => {
      let query = supabase.from("feedback_questions" as any).select("*").order("sort_order");
      if (activeOnly) query = query.eq("is_active", true);
      if (visitorType) query = query.eq("visitor_type", visitorType);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as FeedbackQuestion[];
    },
  });
}

export function useFeedbackResponses(limit = 100) {
  return useQuery({
    queryKey: ["feedback-responses", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feedback_responses" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data || []) as unknown as FeedbackResponse[];
    },
  });
}

export function useFeedbackMutations() {
  const qc = useQueryClient();

  const submitFeedback = useMutation({
    mutationFn: async (responses: { visitor_id?: string; visitor_name: string; visitor_type: string; question_id: string; rating: number; comment?: string }[]) => {
      const { error } = await supabase
        .from("feedback_responses" as any)
        .insert(responses as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["feedback-responses"] }),
  });

  const addQuestion = useMutation({
    mutationFn: async (q: { question: string; category?: string; visitor_type?: string }) => {
      const { error } = await supabase.from("feedback_questions" as any).insert(q as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["feedback-questions"] }),
  });

  const updateQuestion = useMutation({
    mutationFn: async ({ id, ...fields }: Partial<FeedbackQuestion> & { id: string }) => {
      const { error } = await supabase.from("feedback_questions" as any).update({ ...fields, updated_at: new Date().toISOString() } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["feedback-questions"] }),
  });

  const deleteQuestion = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("feedback_questions" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["feedback-questions"] }),
  });

  return { submitFeedback, addQuestion, updateQuestion, deleteQuestion };
}
