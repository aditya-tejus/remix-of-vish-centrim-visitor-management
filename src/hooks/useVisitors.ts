import { fetchOverstayHours, isOverstayedSync } from "@/hooks/useOverstayPolicy";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Visitor, CompanionDetail } from "@/types/visitor";
import { toast } from "@/hooks/use-toast";
import { policyFromRow } from "@/hooks/useReturnNotificationPolicy";
import { useSite } from "@/contexts/SiteContext";


interface DbVisitor {
  id: string;
  first_name: string;
  surname: string;
  email: string;
  mobile: string;
  type: string;
  check_in_time: string;
  check_out_time: string | null;
  whom_to_visit: string;
  address: string;
  status: string;
  health_declaration: boolean;
  additional_visitors: number;
  companion_details: CompanionDetail[] | null;
  comments: string;
  body_temperature: number | null;
  health_answers: Record<string, boolean>;
  privacy_acknowledged: boolean;
  created_at: string;
  expected_return_date: string | null;
  checkout_reason: string | null;
  return_notification_opt_in: boolean;
  leave_type: string | null;
  accompanied_by: string | null;
  accompanied_by_name: string | null;
  qr_code: string | null;
  person_qr: string | null;
  group_id: string | null;
  visited_resident_ids: string[] | null;
}

function dbToVisitor(row: DbVisitor): Visitor {
  return {
    id: row.id,
    firstName: row.first_name,
    surname: row.surname,
    email: row.email || "",
    mobile: row.mobile || "",
    type: row.type as Visitor["type"],
    checkInTime: new Date(row.check_in_time),
    checkOutTime: row.check_out_time ? new Date(row.check_out_time) : null,
    whomToVisit: row.whom_to_visit || "",
    address: row.address || "",
    status: row.status as Visitor["status"],
    healthDeclaration: row.health_declaration,
    additionalVisitors: row.additional_visitors,
    companionDetails: (row.companion_details as CompanionDetail[]) || [],
    comments: row.comments || "",
    bodyTemperature: row.body_temperature ?? undefined,
    retentionExpiry: new Date(Date.now() + 86400000 * 60),
    acknowledgedPrivacy: row.privacy_acknowledged,
    expectedReturnDate: row.expected_return_date ? new Date(row.expected_return_date) : undefined,
    checkoutReason: row.checkout_reason ?? undefined,
    returnNotificationOptIn: row.return_notification_opt_in ?? false,
    leaveType: row.leave_type ?? undefined,
    accompaniedBy: row.accompanied_by ?? undefined,
    accompaniedByName: row.accompanied_by_name ?? undefined,
    healthAnswers: row.health_answers ?? undefined,
    qrCode: row.qr_code ?? undefined,
    personQr: row.person_qr ?? undefined,
    groupId: row.group_id ?? undefined,
    visitedResidentIds: row.visited_resident_ids ?? [],
  };
}

interface UseVisitorsOptions {
  /** Kiosk / unauthenticated context: request only non-sensitive columns. */
  publicMode?: boolean;
  /** Kiosk: the site this kiosk belongs to, so arrivals are recorded at the right place. */
  siteId?: string | null;
  /** Called when a check-in could not be saved, so the screen can stay honest. */
  onSaveError?: () => void;
}

export function useVisitors(options: UseVisitorsOptions = {}) {
  const { publicMode = false, siteId: kioskSiteId = null, onSaveError } = options;
  const { currentSiteId, isLegacySite } = useSite();
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);


  const fetchVisitors = useCallback(async () => {
    // Kiosk (unauthenticated) reads go through a narrow server function that returns
    // presence only — never visit history or personal details.
    if (publicMode) {
      // Scoped to the kiosk's own site so one building never lists another's people.
      const { data, error } = await supabase.rpc("kiosk_presence_list" as any, {
        p_branch_id: kioskSiteId ?? currentSiteId ?? null,
      });
      if (error) {
        setError("We could not reach the system. Please try again.");
      } else if (data) {
        setError(null);
        setVisitors((data as unknown as DbVisitor[]).map(dbToVisitor));
      }
      setLoading(false);
      return;
    }

    // Fetch today's visitors + any still checked-in + any checked-out residents (for away/leave tracking)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    let query = supabase
      .from("visitors")
      .select("*")
      .or(`check_in_time.gte.${todayStart.toISOString()},status.eq.checked-in,and(type.eq.resident,status.eq.checked-out)`);
    // Only this site's people. Records saved before sites existed have no site
    // of their own, so they stay with the original legacy site.
    if (currentSiteId) {
      query = isLegacySite
        ? query.or(`branch_id.eq.${currentSiteId},branch_id.is.null`)
        : query.eq("branch_id", currentSiteId);
    }
    const { data, error } = await query
      .order("check_in_time", { ascending: false })
      .limit(500);
    if (error) {
      setError("We could not load today's visits. Please try again.");
    } else if (data) {
      setError(null);
      setVisitors((data as unknown as DbVisitor[]).map(dbToVisitor));
      setLastUpdated(new Date());
    }
    setLoading(false);

  }, [publicMode, currentSiteId, isLegacySite]);



  // Load the per-type "too long on site" thresholds once so counts everywhere agree.
  useEffect(() => { fetchOverstayHours(); }, []);

  useEffect(() => {
    fetchVisitors();

    // The kiosk has no read access to the visitors table, so it cannot use realtime.
    if (publicMode) {
      const poll = setInterval(fetchVisitors, 20000);
      return () => clearInterval(poll);
    }

    // Realtime subscription
    const channel = supabase
      .channel("visitors-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "visitors" },
        () => {
          fetchVisitors();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };

  }, [fetchVisitors]);

  /**
   * Saves a check-in. Returns the optimistic record plus a promise that settles
   * when the server has confirmed it, so a form can stay open until it is safe
   * to close and can offer a retry with the entered details still on screen.
   */
  const submitVisitor = (visitor: Omit<Visitor, "id">): { visitor: Visitor; saved: Promise<Visitor> } => {
    const tempId = crypto.randomUUID();
    const newVisitor: Visitor = { ...visitor, id: tempId };
    // Optimistic update
    setVisitors((prev) => [newVisitor, ...prev]);


    const payload: Record<string, unknown> = {
      first_name: visitor.firstName,
      surname: visitor.surname,
      email: visitor.email,
      mobile: visitor.mobile,
      type: visitor.type,
      check_in_time: visitor.checkInTime.toISOString(),
      whom_to_visit: visitor.whomToVisit,
      address: visitor.address,
      status: visitor.status,
      health_declaration: visitor.healthDeclaration,
      additional_visitors: visitor.additionalVisitors,
      companion_details: (visitor.companionDetails || []) as any,
      comments: visitor.comments,
      body_temperature: visitor.bodyTemperature ?? null,
      privacy_acknowledged: visitor.acknowledgedPrivacy,
      health_answers: (visitor.healthAnswers || {}) as any,
      contractor_screening: (visitor.contractorScreening || {}) as any,
      supplier_id: visitor.supplierId ?? null,
      qr_code: visitor.qrCode ?? null,
      person_qr: visitor.personQr ?? null,
      group_id: visitor.groupId ?? null,
      visited_resident_ids: visitor.visitedResidentIds?.length ? visitor.visitedResidentIds : null,
      branch_id: (publicMode ? kioskSiteId : currentSiteId) ?? null,

    };

    // Columns only staff (authenticated) may write
    if (!publicMode) {
      Object.assign(payload, {
        expected_return_date: visitor.expectedReturnDate?.toISOString() ?? null,
        checkout_reason: visitor.checkoutReason ?? null,
        return_notification_opt_in: visitor.returnNotificationOptIn ?? false,
        leave_type: visitor.leaveType ?? null,
        accompanied_by: visitor.accompaniedBy ?? null,
        accompanied_by_name: visitor.accompaniedByName ?? null,
      });
    }

    const failed = (error: unknown) => {
      // Roll back the optimistic row and let the caller know it did not save
      setVisitors((prev) => prev.filter((v) => v.id !== tempId));
      toast({
        title: "Could not save this check-in",
        description: "Please check the connection and try again, or ask a staff member for help.",
        variant: "destructive",
      });
      console.error("Failed to save visitor record", error);
      onSaveError?.();
      return new Error("check-in-not-saved");
    };

    const settle = (realId: string) => {
      setVisitors((prev) => prev.map((v) => (v.id === tempId ? { ...v, id: realId } : v)));
      return { ...newVisitor, id: realId };
    };

    if (publicMode) {
      // Kiosk: purpose-specific server function. The kiosk has no table access.
      const saved = Promise.resolve(supabase
        .rpc("kiosk_check_in" as any, { p_payload: payload as any })
        .then(({ data, error }) => {
          const row = Array.isArray(data) ? (data[0] as any) : (data as any);
          if (error || !row?.visitor_id) throw failed(error);
          return settle(row.visitor_id as string);
        }));
      return { visitor: newVisitor, saved };
    }

    // Staff: direct insert, guarded by site-scoped policies
    const saved = Promise.resolve(supabase
      .from("visitors")
      .insert(payload as any)
      .select("id, qr_code")
      .single()
      .then(({ data, error }) => {
        if (error || !data) throw failed(error);
        return settle((data as any).id as string);
      }));

    return { visitor: newVisitor, saved };
  };

  /** Fire-and-forget check-in, kept for callers that do not await the save. */
  const addVisitor = (visitor: Omit<Visitor, "id">): Visitor => {
    const { visitor: optimistic, saved } = submitVisitor(visitor);
    saved.catch(() => undefined);
    return optimistic;
  };

  /** Check-in that resolves only once the record is safely stored. */
  const addVisitorAsync = async (visitor: Omit<Visitor, "id">): Promise<Visitor> => {
    const { saved } = submitVisitor(visitor);
    return saved;
  };


  const markResidentAway = async (visitorId: string, details: {
    expectedReturnDate?: Date;
    checkoutReason?: string;
    leaveType?: string;
    accompaniedBy?: string;
    accompaniedByName?: string;
    comments?: string;
    returnNotificationOptIn?: boolean;
    companionDetails?: CompanionDetail[];
  }) => {
    const now = new Date();
    // Optimistic update
    setVisitors((prev) =>
      prev.map((v) =>
        v.id === visitorId
          ? {
              ...v,
              checkOutTime: now,
              status: "checked-out" as const,
              expectedReturnDate: details.expectedReturnDate,
              checkoutReason: details.checkoutReason ?? null,
              leaveType: details.leaveType,
              accompaniedBy: details.accompaniedBy,
              accompaniedByName: details.accompaniedByName,
              comments: details.comments || v.comments,
              returnNotificationOptIn: details.returnNotificationOptIn ?? false,
              companionDetails: details.companionDetails || v.companionDetails,
              additionalVisitors: details.companionDetails?.length || 0,
            }
          : v
      )
    );

    const updateData: Record<string, unknown> = {
      check_out_time: now.toISOString(),
      status: "checked-out",
      expected_return_date: details.expectedReturnDate?.toISOString() ?? null,
      checkout_reason: details.checkoutReason ?? null,
      leave_type: details.leaveType ?? null,
      accompanied_by: details.accompaniedBy ?? null,
      accompanied_by_name: details.accompaniedByName ?? null,
      return_notification_opt_in: details.returnNotificationOptIn ?? false,
    };
    if (details.comments) updateData.comments = details.comments;
    if (details.companionDetails) {
      updateData.companion_details = details.companionDetails;
      updateData.additional_visitors = details.companionDetails.length;
    }

    if (publicMode) {
      // Kiosk: narrow server function, no direct table write.
      await supabase.rpc("kiosk_resident_leave" as any, {
        p_visitor_id: visitorId,
        p_time: now.toISOString(),
        p_leave_type: details.leaveType ?? null,
        p_expected_return: details.expectedReturnDate?.toISOString() ?? null,
        p_accompanied_by_name: details.accompaniedByName ?? null,
        p_reason: details.checkoutReason ?? null,
      });
      return;
    }
    await supabase.from("visitors").update(updateData).eq("id", visitorId);

  };

  const checkOutVisitor = async (
    id: string,
    reason?: string,
    timeOverride?: string,
    companionOutcome?: {
      /** Omitted on the kiosk, which cannot read companion names. */
      companionDetails?: CompanionDetail[];
      remainingCompanions: number;
      /** False when companions stay behind — the visit stays open for them. */
      everyoneLeft: boolean;
      note?: string;
    }
  ) => {
    const checkOutTime = timeOverride ? (() => { const now = new Date(); const [h, m] = timeOverride.split(":").map(Number); now.setHours(h, m, 0, 0); return now; })() : new Date();
    const stillOpen = companionOutcome ? !companionOutcome.everyoneLeft : false;
    // Kept so the row can be put back exactly as it was if the save fails.
    const previous = visitors.find((v) => v.id === id) ?? null;

    setVisitors((prev) =>
      prev.map((v) =>
        v.id === id
          ? {
              ...v,
              checkOutTime: stillOpen ? v.checkOutTime : checkOutTime,
              status: stillOpen ? ("checked-in" as const) : ("checked-out" as const),
              checkoutReason: reason || null,
              companionDetails: companionOutcome?.companionDetails ?? v.companionDetails,
              additionalVisitors: companionOutcome
                ? companionOutcome.remainingCompanions
                : v.additionalVisitors,
            }
          : v
      )
    );

    const updateData: Record<string, unknown> = stillOpen
      ? {}
      : { check_out_time: checkOutTime.toISOString(), status: "checked-out" };
    if (reason) updateData.checkout_reason = reason;
    if (companionOutcome) {
      if (companionOutcome.companionDetails) {
        updateData.companion_details = companionOutcome.companionDetails as any;
      }
      updateData.additional_visitors = companionOutcome.remainingCompanions;
    }

    const rollBack = (error: unknown) => {
      if (previous) setVisitors((prev) => prev.map((v) => (v.id === id ? previous : v)));
      console.error("Failed to record this departure", error);
      throw new Error("check-out-not-saved");
    };

    if (publicMode) {
      if (!stillOpen) {
        const { error } = await supabase.rpc("kiosk_check_out" as any, {
          p_visitor_id: id,
          p_time: checkOutTime.toISOString(),
        });
        if (error) rollBack(error);
      }
    } else {
      const { error } = await supabase
        .from("visitors")
        .update(updateData)
        .eq("id", id);
      if (error) rollBack(error);
    }


  };

  const checkInReturn = async (id: string, returnComment?: string, timeOverride?: string) => {
    const checkInTime = timeOverride ? (() => { const now = new Date(); const [h, m] = timeOverride.split(":").map(Number); now.setHours(h, m, 0, 0); return now; })() : new Date();
    setVisitors((prev) =>
      prev.map((v) =>
        v.id === id ? { ...v, checkInTime, status: "checked-in" as const, comments: returnComment ? `${v.comments ? v.comments + "\n" : ""}Return: ${returnComment}` : v.comments } : v
      )
    );
    const updateData: Record<string, unknown> = { check_in_time: checkInTime.toISOString(), status: "checked-in" };
    if (returnComment) {
      if (publicMode) {
        // Kiosk cannot read existing comments — append-only note
        updateData.comments = `Return: ${returnComment}`;
      } else {
        const { data: current } = await supabase.from("visitors").select("comments").eq("id", id).single();
        const existing = (current?.comments as string) || "";
        updateData.comments = existing ? `${existing}\nReturn: ${returnComment}` : `Return: ${returnComment}`;
      }

    }
    if (publicMode) {
      await supabase.rpc("kiosk_resident_return" as any, {
        p_visitor_id: id,
        p_time: checkInTime.toISOString(),
      });
    } else {
      await supabase.from("visitors").update(updateData).eq("id", id);
    }


    // Record the safe-return confirmation for the audit trail when configured.
    if (!publicMode) {
      try {
        const { data: rows } = await supabase.from("branch_notification_settings").select("*");
        const policies = (rows || []).map(policyFromRow);
        const policy = policies.find((p) => p.branchId === null) || policies[0];
        if (policy?.safeReturnEnabled) {
          const person = visitors.find((v) => v.id === id);
          const named = [
            ...policy.safeReturnStaff.map((s) => s.name),
            ...policy.safeReturnEmails,
            ...(policy.notifyNokOnReturn ? ["next-of-kin"] : []),
          ];
          await supabase.from("audit_log").insert({
            action: "return_notification_sent",
            performed_by: "System",
            records_affected: 1,
            change_reason: `Safe return confirmed${person ? ` for ${person.firstName} ${person.surname}` : ""}${named.length ? ` — notify ${named.join(", ")}` : ""}`,
            details: { visitor_id: id, recipients: named } as any,
          });
        }
      } catch {
        // Audit logging must never block a resident return being recorded.
      }
    }
  };

  const deleteVisitor = async (id: string) => {
    setVisitors((prev) => prev.filter((v) => v.id !== id));
    await supabase.from("visitors").delete().eq("id", id);
  };

  const checkOutAllOverstayed = async () => {
    const overstayed = visitors.filter(
      isOverstayedSync
    );
    if (overstayed.length === 0) return;
    const ids = overstayed.map((v) => v.id);
    setVisitors((prev) =>
      prev.map((v) =>
        ids.includes(v.id) ? { ...v, checkOutTime: new Date(), status: "checked-out" as const } : v
      )
    );
    await supabase
      .from("visitors")
      .update({ check_out_time: new Date().toISOString(), status: "checked-out" })
      .in("id", ids);
  };

  const checkedInCount = visitors.filter((v) => v.status === "checked-in").length;
  const totalToday = visitors.length;
  const overstayedCount = visitors.filter(
    isOverstayedSync
  ).length;

  return {
    visitors,
    loading,
    error,
    refresh: fetchVisitors,
    addVisitor,
    addVisitorAsync,
    /** Last successful read of the list, so the desk can see how fresh it is. */
    lastUpdated,

    markResidentAway,
    checkOutVisitor,
    checkInReturn,
    checkOutAllOverstayed,
    deleteVisitor,
    checkedInCount,
    totalToday,
    overstayedCount,
  };
}
