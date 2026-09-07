import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface OpenKeyIssue {
  id: string;
  keyId: string;
  keyLabel: string;
  propertyLabel: string | null;
  issuedToName: string;
  issuedToType: string;
  visitorId: string | null;
  issuedAt: Date;
  expectedReturn: Date | null;
  overdue: boolean;
}

/**
 * Live view of every key that is currently out (not returned).
 * Used to flag key holding on visit records without duplicating status on the visit row.
 */
export function useOpenKeyIssues() {
  const [openIssues, setOpenIssues] = useState<OpenKeyIssue[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOpen = useCallback(async () => {
    const [{ data: issueRows }, { data: keyRows }] = await Promise.all([
      (supabase.from("key_issues" as any) as any).select("*").is("returned_at", null),
      (supabase.from("property_keys" as any) as any).select("id,key_label,property_label"),
    ]);

    const keyMap = new Map<string, { label: string; property: string | null }>(
      ((keyRows as any[]) || []).map((k) => [k.id, { label: k.key_label, property: k.property_label }])
    );

    const now = Date.now();
    setOpenIssues(
      ((issueRows as any[]) || []).map((r) => {
        const expected = r.expected_return ? new Date(r.expected_return) : null;
        return {
          id: r.id,
          keyId: r.key_id,
          keyLabel: keyMap.get(r.key_id)?.label || "Key",
          propertyLabel: keyMap.get(r.key_id)?.property ?? null,
          issuedToName: r.issued_to_name,
          issuedToType: r.issued_to_type,
          visitorId: r.visitor_id,
          issuedAt: new Date(r.issued_at),
          expectedReturn: expected,
          overdue: !!(expected && expected.getTime() < now),
        };
      })
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchOpen();
  }, [fetchOpen]);

  const issuesForVisitor = useCallback(
    (visitorId?: string | null) => (visitorId ? openIssues.filter((i) => i.visitorId === visitorId) : []),
    [openIssues]
  );

  const recordReturn = useCallback(
    async (issue: OpenKeyIssue, returnedTo?: string | null, conditionNotes?: string | null) => {
      const { error } = await (supabase.from("key_issues" as any) as any)
        .update({
          returned_at: new Date().toISOString(),
          returned_to: returnedTo || null,
          condition_notes: conditionNotes || null,
        })
        .eq("id", issue.id);
      if (!error) {
        await (supabase.from("property_keys" as any) as any)
          .update({ status: "available" })
          .eq("id", issue.keyId);
      }
      await fetchOpen();
      return error;
    },
    [fetchOpen]
  );

  return { openIssues, loading, refetch: fetchOpen, issuesForVisitor, recordReturn };
}
