import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Visitor, CompanionDetail } from "@/types/visitor";

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
}

function dbToVisitor(row: DbVisitor): Visitor {
  return {
    id: row.id,
    firstName: row.first_name,
    surname: row.surname,
    email: row.email,
    mobile: row.mobile,
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
  };
}

export function useVisitors() {
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchVisitors = useCallback(async () => {
    // Only fetch today's visitors + any still checked-in (no date limit for active visitors)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { data, error } = await supabase
      .from("visitors")
      .select("*")
      .or(`check_in_time.gte.${todayStart.toISOString()},status.eq.checked-in`)
      .order("check_in_time", { ascending: false })
      .limit(500);
    if (!error && data) {
      setVisitors((data as unknown as DbVisitor[]).map(dbToVisitor));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchVisitors();

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

  const addVisitor = (visitor: Omit<Visitor, "id">): Visitor => {
    const tempId = crypto.randomUUID();
    const newVisitor: Visitor = { ...visitor, id: tempId };
    // Optimistic update
    setVisitors((prev) => [newVisitor, ...prev]);

    // Insert into DB
    supabase
      .from("visitors")
      .insert({
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
        expected_return_date: visitor.expectedReturnDate?.toISOString() ?? null,
        checkout_reason: visitor.checkoutReason ?? null,
        return_notification_opt_in: visitor.returnNotificationOptIn ?? false,
        leave_type: visitor.leaveType ?? null,
        accompanied_by: visitor.accompaniedBy ?? null,
        accompanied_by_name: visitor.accompaniedByName ?? null,
      })
      .select()
      .single()
      .then(({ data }) => {
        if (data) {
          // Replace temp ID with real one
          const real = dbToVisitor(data as unknown as DbVisitor);
          setVisitors((prev) =>
            prev.map((v) => (v.id === tempId ? real : v))
          );
        }
      });

    return newVisitor;
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

    await supabase.from("visitors").update(updateData).eq("id", visitorId);
  };

  const checkOutVisitor = async (id: string, reason?: string) => {
    setVisitors((prev) =>
      prev.map((v) =>
        v.id === id ? { ...v, checkOutTime: new Date(), status: "checked-out" as const, checkoutReason: reason || null } : v
      )
    );
    const updateData: Record<string, unknown> = { check_out_time: new Date().toISOString(), status: "checked-out" };
    if (reason) updateData.checkout_reason = reason;
    await supabase
      .from("visitors")
      .update(updateData)
      .eq("id", id);
  };

  const checkInReturn = async (id: string, returnComment?: string) => {
    setVisitors((prev) =>
      prev.map((v) =>
        v.id === id ? { ...v, checkInTime: new Date(), status: "checked-in" as const, comments: returnComment ? `${v.comments ? v.comments + "\n" : ""}Return: ${returnComment}` : v.comments } : v
      )
    );
    const updateData: Record<string, unknown> = { check_in_time: new Date().toISOString(), status: "checked-in" };
    if (returnComment) {
      const { data: current } = await supabase.from("visitors").select("comments").eq("id", id).single();
      const existing = (current?.comments as string) || "";
      updateData.comments = existing ? `${existing}\nReturn: ${returnComment}` : `Return: ${returnComment}`;
    }
    await supabase.from("visitors").update(updateData).eq("id", id);
  };

  const deleteVisitor = async (id: string) => {
    setVisitors((prev) => prev.filter((v) => v.id !== id));
    await supabase.from("visitors").delete().eq("id", id);
  };

  const checkOutAllOverstayed = async () => {
    const overstayed = visitors.filter(
      (v) => v.status === "checked-in" && Date.now() - v.checkInTime.getTime() > 8 * 3600000
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
    (v) => v.status === "checked-in" && Date.now() - v.checkInTime.getTime() > 8 * 3600000
  ).length;

  return {
    visitors,
    loading,
    addVisitor,
    checkOutVisitor,
    checkInReturn,
    checkOutAllOverstayed,
    deleteVisitor,
    checkedInCount,
    totalToday,
    overstayedCount,
  };
}
