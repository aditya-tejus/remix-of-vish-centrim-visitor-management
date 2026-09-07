import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type QuestionOwnerScope = "company" | "person" | "visit";
export type QuestionAnsweredBy = "contractor" | "staff";
export type QuestionInputType = "yesno" | "text" | "select";

export interface ContractorQuestion {
  id: string;
  key: string;
  label: string;
  input_type: QuestionInputType;
  options: string[] | null;
  owner_scope: QuestionOwnerScope;
  answered_by: QuestionAnsweredBy;
  /** null = the answer never lapses */
  validity_days: number | null;
  required: boolean;
  blocks_on_no: boolean;
  jurisdiction: "ALL" | "AU" | "UK";
  is_active: boolean;
  sort_order: number;
}

export interface ContractorAnswer {
  id: string;
  question_id: string;
  supplier_id: string | null;
  person_id: string | null;
  answer: any;
  answered_by: string | null;
  answered_at: string;
  expires_at: string | null;
}

const table = () => supabase.from("contractor_questions" as any);
const answersTable = () => supabase.from("contractor_question_answers" as any);

export function useContractorQuestionTypes() {
  const [questions, setQuestions] = useState<ContractorQuestion[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    const { data } = await table().select("*").order("sort_order", { ascending: true });
    setQuestions(((data as any[]) || []) as ContractorQuestion[]);
    setLoading(false);
  }, []);

  useEffect(() => { void refetch(); }, [refetch]);

  return { questions, loading, refetch };
}

export function isAnswerCurrent(a: ContractorAnswer | undefined): boolean {
  if (!a) return false;
  if (a.answer === null || a.answer === undefined || a.answer === "") return false;
  if (!a.expires_at) return true;
  return new Date(a.expires_at).getTime() > Date.now();
}

export function questionApplies(q: ContractorQuestion, jurisdiction: "AU" | "UK") {
  return q.is_active && (q.jurisdiction === "ALL" || q.jurisdiction === jurisdiction);
}

/**
 * Resolves the screening questions for one contractor visit: which are already
 * answered and still current (company or person level), and which still need an
 * answer today.
 */
export function useContractorQuestions(params: {
  jurisdiction: "AU" | "UK";
  supplierId?: string | null;
  personId?: string | null;
}) {
  const { jurisdiction, supplierId, personId } = params;
  const { questions: allQuestions, loading } = useContractorQuestionTypes();
  const [answers, setAnswers] = useState<ContractorAnswer[]>([]);

  const loadAnswers = useCallback(async () => {
    if (!supplierId && !personId) { setAnswers([]); return; }
    const filters: string[] = [];
    if (supplierId) filters.push(`supplier_id.eq.${supplierId}`);
    if (personId) filters.push(`person_id.eq.${personId}`);
    const { data } = await answersTable().select("*").or(filters.join(","));
    setAnswers(((data as any[]) || []) as ContractorAnswer[]);
  }, [supplierId, personId]);

  useEffect(() => { void loadAnswers(); }, [loadAnswers]);

  const questions = useMemo(
    () => allQuestions.filter((q) => questionApplies(q, jurisdiction)),
    [allQuestions, jurisdiction]
  );

  const answerFor = useCallback(
    (q: ContractorQuestion) =>
      answers.find((a) =>
        a.question_id === q.id &&
        (q.owner_scope === "company" ? a.supplier_id === supplierId : a.person_id === personId)
      ),
    [answers, supplierId, personId]
  );

  const remembered = questions.filter((q) => q.owner_scope !== "visit");
  const onFile = remembered.filter((q) => isAnswerCurrent(answerFor(q)));
  const outstanding = remembered.filter((q) => {
    if (isAnswerCurrent(answerFor(q))) return false;
    if (q.owner_scope === "company" && !supplierId) return false;
    if (q.owner_scope === "person" && !personId) return false;
    return true;
  });
  const visitQuestions = questions.filter((q) => q.owner_scope === "visit");

  /** Stores a remembered answer against the company or the worker. */
  const saveAnswer = useCallback(
    async (q: ContractorQuestion, value: any, answeredBy: string) => {
      const targetId = q.owner_scope === "company" ? supplierId : personId;
      if (!targetId) return;
      const expires_at = q.validity_days
        ? new Date(Date.now() + q.validity_days * 86400000).toISOString()
        : null;
      const row: Record<string, any> = {
        question_id: q.id,
        supplier_id: q.owner_scope === "company" ? supplierId : null,
        person_id: q.owner_scope === "person" ? personId : null,
        answer: value,
        answered_by: answeredBy,
        answered_at: new Date().toISOString(),
        expires_at,
      };
      const existing = answerFor(q);
      if (existing) {
        await answersTable().update(row).eq("id", existing.id);
      } else {
        await answersTable().insert(row);
      }
      await loadAnswers();
    },
    [supplierId, personId, answerFor, loadAnswers]
  );

  return { loading, questions, remembered, onFile, outstanding, visitQuestions, answerFor, saveAnswer, reload: loadAnswers };
}
