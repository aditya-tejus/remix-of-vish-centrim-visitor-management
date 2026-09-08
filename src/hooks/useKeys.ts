import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchKeyPolicy, KeyPolicy, DEFAULT_KEY_POLICY } from "@/hooks/useKeyPolicy";
import { useSite } from "@/contexts/SiteContext";

export type KeyStatus =
  | "available"
  | "issued"
  | "permanent"
  | "overdue"
  | "lost"
  | "damaged"
  | "awaiting_replacement"
  | "retired";

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
  /** A resident's own key or fob — never due back, never overdue. */
  isPermanent: boolean;
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
  /** True when the key is out past its expected return time (plus grace). */
  overdue: boolean;
  lostAt: Date | null;
  lostNotes: string | null;
  replacedByKeyId: string | null;
  /** Serial or engraved number, where the item carries one. */
  serialNumber: string | null;
  damagedAt: Date | null;
  damagedNotes: string | null;
  /** The lost or damaged item this copy was created to replace. */
  replacesKeyId: string | null;
  branchId: string | null;
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
  isPermanent: !!r.is_permanent,
});

/** Shared overdue rule so every surface agrees: permanent holdings never expire. */
export function isIssueOverdue(issue: { expectedReturn: Date | null; isPermanent: boolean }, graceMinutes: number, now = Date.now()) {
  if (issue.isPermanent || !issue.expectedReturn) return false;
  return issue.expectedReturn.getTime() + graceMinutes * 60000 < now;
}

/** Records who did what to a key, so the register can always be explained. */
async function logKeyAction(action: string, details: Record<string, unknown>, reason?: string | null) {
  const { data: auth } = await supabase.auth.getUser();
  const { data: profile } = auth.user
    ? await supabase.from("profiles").select("display_name").eq("user_id", auth.user.id).maybeSingle()
    : { data: null as any };
  await supabase.from("audit_log").insert({
    action,
    performed_by: profile?.display_name || auth.user?.email || "Unknown staff",
    user_id: auth.user?.id ?? null,
    records_affected: 1,
    change_reason: reason || null,
    details: details as any,
  });
}

export function useKeys() {
  const { currentSiteId } = useSite();
  const [keys, setKeys] = useState<PropertyKey[]>([]);
  const [issues, setIssues] = useState<KeyIssue[]>([]);
  const [policy, setPolicy] = useState<KeyPolicy>(DEFAULT_KEY_POLICY);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: keyRows }, { data: issueRows }, keyPolicy] = await Promise.all([
      (() => {
        let q = (supabase.from("property_keys" as any) as any)
          .select("*")
          .eq("is_active", true);
        if (currentSiteId) q = q.eq("branch_id", currentSiteId);
        return q.order("property_label", { ascending: true });
      })(),
      (() => {
        let q = (supabase.from("key_issues" as any) as any).select("*");
        if (currentSiteId) q = q.eq("branch_id", currentSiteId);
        return q
          .order("issued_at", { ascending: false })
          .limit(1000);
      })(),
      fetchKeyPolicy(),
    ]);

    const allIssues: KeyIssue[] = (issueRows || []).map(mapIssue);
    setIssues(allIssues);
    setPolicy(keyPolicy);

    const now = Date.now();
    setKeys(
      ((keyRows as any[]) || []).map((r) => {
        const open = allIssues.find((i) => i.keyId === r.id && !i.returnedAt) || null;
        const overdue = !!open && isIssueOverdue(open, keyPolicy.graceMinutes, now);
        const status: KeyStatus = ["lost", "retired", "damaged", "awaiting_replacement"].includes(r.status)
          ? r.status
          : open
            ? (open.isPermanent ? "permanent" : overdue ? "overdue" : "issued")
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
          lostAt: r.lost_at ? new Date(r.lost_at) : null,
          lostNotes: r.lost_notes ?? null,
          replacedByKeyId: r.replaced_by_key_id ?? null,
          serialNumber: r.serial_number ?? null,
          damagedAt: r.damaged_at ? new Date(r.damaged_at) : null,
          damagedNotes: r.damaged_notes ?? null,
          replacesKeyId: r.replaces_key_id ?? null,
          branchId: r.branch_id ?? null,
        };
      })
    );
    setLoading(false);
  }, [currentSiteId]);

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
    serialNumber?: string | null;
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
      serial_number: input.serialNumber || null,
      status: "available",
      ...(currentSiteId ? { branch_id: currentSiteId } : {}),
    };
    const rows = count > 1
      ? Array.from({ length: count }, (_, i) => ({ ...base, copy_number: i + 1 }))
      : [{ ...base, copy_number: input.copyNumber ?? null }];

    const { error } = await (supabase.from("property_keys" as any) as any).insert(rows);
    if (!error) {
      await logKeyAction("key_added", {
        label: input.keyLabel,
        type: input.keyType,
        property: input.propertyLabel,
        copies: count,
      });
    }
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
    isPermanent?: boolean;
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
      expected_return: input.isPermanent || !input.expectedReturn ? null : input.expectedReturn.toISOString(),
      is_permanent: !!input.isPermanent,
      issued_by: input.issuedBy || null,
      notes: input.notes || null,
      ...(currentSiteId ? { branch_id: currentSiteId } : {}),
    });
    if (!error) {
      await (supabase.from("property_keys" as any) as any).update({ status: "issued" }).eq("id", input.keyId);
      await logKeyAction("key_issued", {
        key_id: input.keyId,
        holder: input.issuedToName,
        holder_type: input.issuedToType,
        permanent: !!input.isPermanent,
        due: input.expectedReturn?.toISOString() ?? null,
      });
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
      await logKeyAction("key_returned", {
        key_id: input.keyId,
        received_by: input.returnedTo || null,
        condition: input.conditionNotes || null,
      });
    }
    await fetchAll();
    return error;
  };

  /** Extend the due-back date, or convert the holding to permanent. */
  const renewIssue = async (input: {
    issueId: string;
    keyLabel: string;
    holderName: string;
    newDue: Date | null;
    makePermanent?: boolean;
    reason?: string | null;
    performedBy?: string | null;
  }) => {
    const { error } = await (supabase.from("key_issues" as any) as any)
      .update({
        expected_return: input.makePermanent || !input.newDue ? null : input.newDue.toISOString(),
        is_permanent: !!input.makePermanent,
      })
      .eq("id", input.issueId);

    if (!error) {
      await supabase.from("audit_log").insert({
        action: "key_renewed",
        details: {
          key: input.keyLabel,
          holder: input.holderName,
          new_due: input.makePermanent ? "permanent" : input.newDue?.toISOString() || null,
        } as any,
        change_reason: input.reason || null,
        records_affected: 1,
        performed_by: input.performedBy || "staff",
      });
    }
    await fetchAll();
    return error;
  };

  /**
   * Mark a key or fob as lost. Optionally creates a replacement copy for the
   * same property/resident, numbered as the next copy in that set.
   */
  const markLost = async (input: {
    key: PropertyKey;
    notes?: string | null;
    replace?: boolean;
    performedBy?: string | null;
  }) => {
    const { key } = input;
    let replacementId: string | null = null;

    if (input.replace) {
      const siblings = keys.filter(
        (k) =>
          k.keyType === key.keyType &&
          k.propertyLabel === key.propertyLabel &&
          (k.residentVisitorId || null) === (key.residentVisitorId || null)
      );
      const nextCopy = Math.max(0, ...siblings.map((k) => k.copyNumber || 0)) + 1;
      const { data, error: insertError } = await (supabase.from("property_keys" as any) as any)
        .insert({
          key_label: key.keyLabel,
          key_type: key.keyType,
          property_label: key.propertyLabel,
          resident_visitor_id: key.residentVisitorId,
          resident_name: key.residentName,
          storage_location: key.storageLocation,
          copy_number: nextCopy,
          notes: `Replacement for copy ${key.copyNumber ?? "—"} reported lost`,
          serial_number: null,
          replaces_key_id: key.id,
          status: "available",
          ...(currentSiteId ? { branch_id: currentSiteId } : {}),
        })
        .select("id")
        .maybeSingle();
      if (insertError) return insertError;
      replacementId = (data as any)?.id ?? null;
    }

    // Close any open handover as "not returned — lost".
    const open = key.currentIssue;
    if (open) {
      await (supabase.from("key_issues" as any) as any)
        .update({
          returned_at: new Date().toISOString(),
          condition_notes: `Not returned — reported lost${input.notes ? `: ${input.notes}` : ""}`,
        })
        .eq("id", open.id);
    }

    const { error } = await (supabase.from("property_keys" as any) as any)
      .update({
        status: "lost",
        lost_at: new Date().toISOString(),
        lost_notes: input.notes || null,
        replaced_by_key_id: replacementId,
      })
      .eq("id", key.id);

    if (!error) {
      await supabase.from("audit_log").insert({
        action: "key_reported_lost",
        details: {
          key: key.keyLabel,
          copy: key.copyNumber,
          property: key.propertyLabel,
          replacement_created: !!replacementId,
        } as any,
        change_reason: input.notes || null,
        records_affected: 1,
        performed_by: input.performedBy || "staff",
      });
    }
    await fetchAll();
    return error;
  };

  /**
   * Record an item as damaged. Optionally puts a fresh copy in the cabinet with
   * the next copy number, exactly like a lost item.
   */
  const markDamaged = async (input: {
    key: PropertyKey;
    notes?: string | null;
    replace?: boolean;
    performedBy?: string | null;
  }) => {
    const { key } = input;
    let replacementId: string | null = null;

    if (input.replace) {
      const siblings = keys.filter(
        (k) =>
          k.keyType === key.keyType &&
          k.propertyLabel === key.propertyLabel &&
          (k.residentVisitorId || null) === (key.residentVisitorId || null)
      );
      const nextCopy = Math.max(0, ...siblings.map((k) => k.copyNumber || 0)) + 1;
      const { data, error: insertError } = await (supabase.from("property_keys" as any) as any)
        .insert({
          key_label: key.keyLabel,
          key_type: key.keyType,
          property_label: key.propertyLabel,
          resident_visitor_id: key.residentVisitorId,
          resident_name: key.residentName,
          storage_location: key.storageLocation,
          copy_number: nextCopy,
          notes: `Replacement for copy ${key.copyNumber ?? "—"} reported damaged`,
          replaces_key_id: key.id,
          status: "available",
          ...(currentSiteId ? { branch_id: currentSiteId } : {}),
        })
        .select("id")
        .maybeSingle();
      if (insertError) return insertError;
      replacementId = (data as any)?.id ?? null;
    }

    if (key.currentIssue) {
      await (supabase.from("key_issues" as any) as any)
        .update({
          returned_at: new Date().toISOString(),
          condition_notes: `Returned damaged${input.notes ? `: ${input.notes}` : ""}`,
        })
        .eq("id", key.currentIssue.id);
    }

    const { error } = await (supabase.from("property_keys" as any) as any)
      .update({
        status: replacementId ? "damaged" : "awaiting_replacement",
        damaged_at: new Date().toISOString(),
        damaged_notes: input.notes || null,
        replaced_by_key_id: replacementId,
      })
      .eq("id", key.id);

    if (!error) {
      await logKeyAction(
        "key_reported_damaged",
        { key: key.keyLabel, copy: key.copyNumber, replacement_created: !!replacementId },
        input.notes || null
      );
    }
    await fetchAll();
    return error;
  };

  const setKeyStatus = async (keyId: string, status: KeyStatus) => {
    await (supabase.from("property_keys" as any) as any).update({ status }).eq("id", keyId);
    await fetchAll();
  };

  const historyFor = (keyId: string) => issues.filter((i) => i.keyId === keyId);

  return {
    keys, issues, loading, policy,
    refetch: fetchAll,
    addKey, issueKey, returnKey, renewIssue, markLost, markDamaged, setKeyStatus, historyFor,
  };
}
