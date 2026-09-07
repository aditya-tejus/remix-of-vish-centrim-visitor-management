import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type KeyStatus = "available" | "issued" | "overdue" | "lost" | "retired";

export interface KeyIssue {
  id: string;
  keyId: string;
  issuedToName: string;
  issuedToType: string;
  visitorId: string | null;
  supplierId: string | null;
  /** Set when the holder is a staff member picked from the staff list. */
  issuedToStaffId: string | null;
  issuedAt: Date;
  issuedBy: string | null;
  expectedReturn: Date | null;
  returnedAt: Date | null;
  returnedTo: string | null;
  conditionNotes: string | null;
  notes: string | null;
}

export interface PropertyKey {
  id: string;
  keyLabel: string;
  keyType: string;
  propertyLabel: string;
  residentVisitorId: string | null;
  residentName: string | null;
  copyNumber: number | null;
  storageLocation: string | null;
  status: KeyStatus;
  notes: string | null;
  isActive: boolean;
  /** The open (not yet returned) issue, if the key is currently out. */
  currentIssue: KeyIssue | null;
  /** True when the key is out past its expected return time. */
  overdue: boolean;
}

const mapIssue = (r: any): KeyIssue => ({
  id: r.id,
  keyId: r.key_id,
  issuedToName: r.issued_to_name,
  issuedToType: r.issued_to_type,
  visitorId: r.visitor_id,
  supplierId: r.supplier_id,
  issuedToStaffId: r.issued_to_staff_id ?? null,
  issuedAt: new Date(r.issued_at),
  issuedBy: r.issued_by,
  expectedReturn: r.expected_return ? new Date(r.expected_return) : null,
  returnedAt: r.returned_at ? new Date(r.returned_at) : null,
  returnedTo: r.returned_to,
  conditionNotes: r.condition_notes,
  notes: r.notes,
});

export function useKeys() {
  const [keys, setKeys] = useState<PropertyKey[]>([]);
  const [issues, setIssues] = useState<KeyIssue[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: keyRows }, { data: issueRows }] = await Promise.all([
      (supabase.from("property_keys" as any) as any)
        .select("*")
        .eq("is_active", true)
        .order("property_label", { ascending: true }),
      (supabase.from("key_issues" as any) as any)
        .select("*")
        .order("issued_at", { ascending: false })
        .limit(1000),
    ]);

    const allIssues: KeyIssue[] = (issueRows || []).map(mapIssue);
    setIssues(allIssues);

    const now = Date.now();
    setKeys(
      ((keyRows as any[]) || []).map((r) => {
        const open = allIssues.find((i) => i.keyId === r.id && !i.returnedAt) || null;
        const overdue = !!(open?.expectedReturn && open.expectedReturn.getTime() < now);
        const status: KeyStatus = r.status === "lost" || r.status === "retired"
          ? r.status
          : open
            ? (overdue ? "overdue" : "issued")
            : "available";
        return {
          id: r.id,
          keyLabel: r.key_label,
          keyType: r.key_type,
          propertyLabel: r.property_label,
          residentVisitorId: r.resident_visitor_id,
          residentName: r.resident_name,
          copyNumber: r.copy_number,
          storageLocation: r.storage_location,
          status,
          notes: r.notes,
          isActive: r.is_active,
          currentIssue: open,
          overdue,
        };
      })
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const addKey = async (input: {
    keyLabel: string;
    keyType: string;
    propertyLabel: string;
    residentVisitorId?: string | null;
    residentName?: string | null;
    copyNumber?: number | null;
    storageLocation?: string | null;
    notes?: string | null;
    /** Create this many identical keys, numbered copy 1..n. */
    copies?: number;
  }) => {
    const count = Math.min(Math.max(input.copies ?? 1, 1), 20);
    const base = {
      key_label: input.keyLabel,
      key_type: input.keyType,
      property_label: input.propertyLabel,
      resident_visitor_id: input.residentVisitorId || null,
      resident_name: input.residentName || null,
      storage_location: input.storageLocation || null,
      notes: input.notes || null,
      status: "available",
    };
    const rows = count > 1
      ? Array.from({ length: count }, (_, i) => ({ ...base, copy_number: i + 1 }))
      : [{ ...base, copy_number: input.copyNumber ?? null }];

    const { error } = await (supabase.from("property_keys" as any) as any).insert(rows);
    await fetchAll();
    return error;
  };


  const issueKey = async (input: {
    keyId: string;
    issuedToName: string;
    issuedToType: string;
    visitorId?: string | null;
    supplierId?: string | null;
    issuedToStaffId?: string | null;
    expectedReturn?: Date | null;
    issuedBy?: string | null;
    notes?: string | null;
  }) => {
    const { error } = await (supabase.from("key_issues" as any) as any).insert({
      key_id: input.keyId,
      issued_to_name: input.issuedToName,
      issued_to_type: input.issuedToType,
      visitor_id: input.visitorId || null,
      supplier_id: input.supplierId || null,
      issued_to_staff_id: input.issuedToStaffId || null,
      expected_return: input.expectedReturn ? input.expectedReturn.toISOString() : null,
      issued_by: input.issuedBy || null,
      notes: input.notes || null,
    });
    if (!error) {
      await (supabase.from("property_keys" as any) as any).update({ status: "issued" }).eq("id", input.keyId);
    }
    await fetchAll();
    return error;
  };

  const returnKey = async (input: {
    issueId: string;
    keyId: string;
    returnedTo?: string | null;
    conditionNotes?: string | null;
    returnedAt?: Date;
  }) => {
    const { error } = await (supabase.from("key_issues" as any) as any)
      .update({
        returned_at: (input.returnedAt || new Date()).toISOString(),
        returned_to: input.returnedTo || null,
        condition_notes: input.conditionNotes || null,
      })
      .eq("id", input.issueId);
    if (!error) {
      await (supabase.from("property_keys" as any) as any).update({ status: "available" }).eq("id", input.keyId);
    }
    await fetchAll();
    return error;
  };

  const setKeyStatus = async (keyId: string, status: KeyStatus) => {
    await (supabase.from("property_keys" as any) as any).update({ status }).eq("id", keyId);
    await fetchAll();
  };

  const historyFor = (keyId: string) => issues.filter((i) => i.keyId === keyId);

  return { keys, issues, loading, refetch: fetchAll, addKey, issueKey, returnKey, setKeyStatus, historyFor };
}
