import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FeedbackSurvey {
  id: string;
  title: string;
  description: string;
  assigned_types: string[];
  trigger_point: string;
  source: string;
  external_url: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface FeedbackQuestion {
  id: string;
  question: string;
  category: string;
  is_active: boolean;
  sort_order: number;
  visitor_type: string;
  survey_id: string | null;
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
  survey_id: string | null;
}

// ─── Surveys ───

export function useFeedbackSurveys(activeOnly = false) {
  return useQuery({
    queryKey: ["feedback-surveys", activeOnly],
    queryFn: async () => {
      let query = supabase.from("feedback_surveys" as any).select("*").order("sort_order");
      if (activeOnly) query = query.eq("is_active", true);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as FeedbackSurvey[];
    },
  });
}

export function useSurveyMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["feedback-surveys"] });

  const addSurvey = useMutation({
    mutationFn: async (s: { title: string; description?: string; assigned_types: string[]; trigger_point?: string; source?: string; external_url?: string }) => {
      const { data, error } = await supabase.from("feedback_surveys" as any).insert(s as any).select().single();
      if (error) throw error;
      return data as unknown as FeedbackSurvey;
    },
    onSuccess: invalidate,
  });

  const updateSurvey = useMutation({
    mutationFn: async ({ id, ...fields }: Partial<FeedbackSurvey> & { id: string }) => {
      const { error } = await supabase.from("feedback_surveys" as any).update({ ...fields, updated_at: new Date().toISOString() } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const deleteSurvey = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("feedback_surveys" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { addSurvey, updateSurvey, deleteSurvey };
}

// ─── Questions ───

export function useFeedbackQuestions(activeOnly = false, surveyId?: string) {
  return useQuery({
    queryKey: ["feedback-questions", activeOnly, surveyId],
    queryFn: async () => {
      let query = supabase.from("feedback_questions" as any).select("*").order("sort_order");
      if (activeOnly) query = query.eq("is_active", true);
      if (surveyId) query = query.eq("survey_id", surveyId);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as FeedbackQuestion[];
    },
  });
}

export function useFeedbackResponses(limit = 100, surveyId?: string) {
  return useQuery({
    queryKey: ["feedback-responses", limit, surveyId],
    queryFn: async () => {
      let query = supabase
        .from("feedback_responses" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (surveyId) query = query.eq("survey_id", surveyId);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as FeedbackResponse[];
    },
  });
}

export function useFeedbackMutations() {
  const qc = useQueryClient();

  const submitFeedback = useMutation({
    mutationFn: async (responses: { visitor_id?: string; visitor_name: string; visitor_type: string; question_id: string; rating: number; comment?: string; survey_id?: string }[]) => {
      const { error } = await supabase
        .from("feedback_responses" as any)
        .insert(responses as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["feedback-responses"] }),
  });

  const addQuestion = useMutation({
    mutationFn: async (q: { question: string; category?: string; visitor_type?: string; survey_id?: string }) => {
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
