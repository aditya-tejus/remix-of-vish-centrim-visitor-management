import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ReturnNotifRecipient {
  id: string;
  name: string;
  role: string;
}

export interface ReturnNotificationPolicy {
  id?: string;
  branchId: string | null;
  overdueEnabled: boolean;
  graceMinutes: number;
  escalationMinutes: number;
  overdueStaff: ReturnNotifRecipient[];
  overdueEmails: string[];
  safeReturnEnabled: boolean;
  safeReturnStaff: ReturnNotifRecipient[];
  safeReturnEmails: string[];
  notifyNokOnReturn: boolean;
}

export function defaultReturnPolicy(branchId: string | null = null): ReturnNotificationPolicy {
  return {
    branchId,
    overdueEnabled: true,
    graceMinutes: 30,
    escalationMinutes: 0,
    overdueStaff: [],
    overdueEmails: [],
    safeReturnEnabled: false,
    safeReturnStaff: [],
    safeReturnEmails: [],
    notifyNokOnReturn: false,
  };
}

export function policyFromRow(row: any): ReturnNotificationPolicy {
  const timing = (row.notification_timing as any[]) || [];
  const graceTrigger = timing.find((t: any) => t?.direction === "after");
  const graceMinutes = graceTrigger
    ? Number(graceTrigger.amount) * (graceTrigger.unit === "hours" ? 60 : 1)
    : 30;

  const staffBlob = (row.notification_staff as any) || {};
  const emailBlob = (row.notification_emails as any) || {};

  return {
    id: row.id,
    branchId: row.branch_id ?? null,
    overdueEnabled: row.enabled ?? true,
    graceMinutes: Number.isFinite(graceMinutes) ? graceMinutes : 30,
    escalationMinutes: Number(staffBlob?.escalation_minutes ?? 0) || 0,
    overdueStaff: Array.isArray(staffBlob) ? staffBlob : staffBlob.overdue || [],
    overdueEmails: Array.isArray(emailBlob) ? emailBlob : emailBlob.overdue || [],
    safeReturnEnabled: staffBlob?.safe_return_enabled ?? false,
    safeReturnStaff: Array.isArray(staffBlob) ? [] : staffBlob.safe_return || [],
    safeReturnEmails: Array.isArray(emailBlob) ? [] : emailBlob.safe_return || [],
    notifyNokOnReturn: staffBlob?.notify_nok_on_return ?? false,
  };
}

export function policyToRow(p: ReturnNotificationPolicy) {
  return {
    branch_id: p.branchId,
    enabled: p.overdueEnabled,
    notification_emails: {
      overdue: p.overdueEmails,
      safe_return: p.safeReturnEmails,
    } as any,
    notification_staff: {
      overdue: p.overdueStaff,
      safe_return: p.safeReturnStaff,
      safe_return_enabled: p.safeReturnEnabled,
      notify_nok_on_return: p.notifyNokOnReturn,
      escalation_minutes: p.escalationMinutes,
    } as any,
    notification_timing: [
      { direction: "after", amount: p.graceMinutes, unit: "minutes" },
    ] as any,
    updated_at: new Date().toISOString(),
  };
}

/** Reads the effective return-notification policy: branch row, falling back to the all-sites row. */
export function useReturnNotificationPolicy(branchId?: string | null) {
  const [policy, setPolicy] = useState<ReturnNotificationPolicy | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase.from("branch_notification_settings").select("*");
    const rows = (data || []).map(policyFromRow);
    const branchRow = branchId ? rows.find((r) => r.branchId === branchId) : undefined;
    const allSites = rows.find((r) => r.branchId === null);
    setPolicy(branchRow || allSites || null);
    setLoading(false);
  }, [branchId]);

  useEffect(() => { load(); }, [load]);

  return { policy, loading, refetch: load };
}

/** True once the expected return time plus the configured grace period has passed. */
export function isReturnOverdue(expected: Date, policy: ReturnNotificationPolicy | null): boolean {
  if (!policy || !policy.overdueEnabled) return false;
  return Date.now() > expected.getTime() + policy.graceMinutes * 60000;
}

/** True once the escalation window has also passed (0 = escalation off). */
export function isReturnEscalated(expected: Date, policy: ReturnNotificationPolicy | null): boolean {
  if (!policy || !policy.overdueEnabled || !policy.escalationMinutes) return false;
  return Date.now() > expected.getTime() + (policy.graceMinutes + policy.escalationMinutes) * 60000;
}

export function recipientSummary(policy: ReturnNotificationPolicy | null, kind: "overdue" | "safe_return"): string {
  if (!policy) return "";
  const staff = kind === "overdue" ? policy.overdueStaff : policy.safeReturnStaff;
  const emails = kind === "overdue" ? policy.overdueEmails : policy.safeReturnEmails;
  const names = [...staff.map((s) => s.name), ...emails];
  if (names.length === 0) return "";
  if (names.length <= 2) return names.join(" and ");
  return `${names.slice(0, 2).join(", ")} +${names.length - 2} more`;
}
