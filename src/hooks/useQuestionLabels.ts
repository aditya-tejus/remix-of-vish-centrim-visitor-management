import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Check-in answers are stored against question IDs. This resolves those IDs to
 * the question text so screening records read like a record, not a list of
 * database keys. Inactive/removed questions are included so old visits still
 * make sense during an audit or complaint review.
 */
let cache: Record<string, string> | null = null;
let inflight: Promise<Record<string, string>> | null = null;

async function loadLabels(): Promise<Record<string, string>> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    const map: Record<string, string> = {};
    const [questions, fields] = await Promise.all([
      supabase.from("health_questions").select("id, question"),
      supabase.from("form_fields").select("id, field_key, label"),
    ]);
    (questions.data || []).forEach((q: any) => { map[q.id] = q.question; });
    (fields.data || []).forEach((f: any) => {
      map[f.id] = f.label;
      if (f.field_key) map[f.field_key] = f.label;
    });
    cache = map;
    return map;
  })();
  return inflight;
}

export function useQuestionLabels() {
  const [labels, setLabels] = useState<Record<string, string>>(cache || {});
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    let active = true;
    loadLabels().then((map) => {
      if (!active) return;
      setLabels(map);
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const labelFor = (key: string) => {
    if (labels[key]) return labels[key];
    // Old question that no longer exists — keep the record readable.
    const looksLikeId = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(key);
    if (looksLikeId) return "Question no longer in use";
    return key.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  };

  return { labels, labelFor, loading };
}
