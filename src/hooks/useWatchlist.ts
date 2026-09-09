import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { kioskRpc } from "@/lib/kioskRpc";

export type WatchlistReasonCategory =
  | "court_order"
  | "family_dispute"
  | "infection_control"
  | "behavioural"
  | "other";

export const WATCHLIST_REASON_CATEGORIES: { value: WatchlistReasonCategory; label: string }[] = [
  { value: "court_order", label: "Court order / legal restriction" },
  { value: "family_dispute", label: "Family dispute" },
  { value: "infection_control", label: "Infection control" },
  { value: "behavioural", label: "Behavioural concern" },
  { value: "other", label: "Other" },
];

export interface WatchlistEntry {
  id: string;
  first_name: string;
  surname: string;
  date_of_birth: string | null;
  photo_url: string | null;
  reason: string;
  reason_category: WatchlistReasonCategory | null;
  review_date: string | null;
  instructions: string | null;
  alert_type: "soft" | "hard";
  added_by: string;
  is_active: boolean;
  created_at: string;
}

/** A confirmed hit requires name AND date of birth. A name-only hit needs staff confirmation. */
export interface WatchlistMatch {
  entry: WatchlistEntry;
  matchType: "confirmed" | "near";
}

function normaliseName(first: string, last: string) {
  return `${first} ${last}`.trim().toLowerCase().replace(/\s+/g, " ");
}

interface UseWatchlistOptions {
  /** Kiosk / unauthenticated context: the register itself is never readable. */
  publicMode?: boolean;
  /** Kiosk context: only this site's entries are checked. */
  siteId?: string | null;
}

export function useWatchlist({ publicMode = false, siteId = null }: UseWatchlistOptions = {}) {
  const qc = useQueryClient();

  const query = useQuery({
    enabled: !publicMode,
    queryKey: ["watchlist"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visitor_watchlist")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as unknown as WatchlistEntry[]) || [];
    },
  });

  const addEntry = useMutation({
    mutationFn: async (
      entry: Omit<WatchlistEntry, "id" | "created_at" | "is_active" | "photo_url">
    ) => {
      const { error } = await supabase.from("visitor_watchlist").insert(entry as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["watchlist"] }),
  });

  const updateEntry = useMutation({
    mutationFn: async ({ id, ...fields }: Partial<WatchlistEntry> & { id: string }) => {
      const { error } = await supabase
        .from("visitor_watchlist")
        .update({ ...fields, updated_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["watchlist"] }),
  });

  const removeEntry = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("visitor_watchlist")
        .update({ is_active: false, updated_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["watchlist"] }),
  });

  /** Places a visit record under legal hold so retention cleanup never removes it. */
  const flagMatchedVisit = useMutation({
    mutationFn: async (visitorId: string) => {
      const { error } = await supabase
        .from("visitors")
        .update({ legal_hold: true } as any)
        .eq("id", visitorId);
      if (error) throw error;
    },
  });

  const checkVisitor = (
    firstName: string,
    surname: string,
    dateOfBirth?: string | null
  ): WatchlistMatch | null => {
    if (!query.data) return null;
    const name = normaliseName(firstName, surname);
    if (!name) return null;
    const nameMatches = query.data.filter(
      (e) => normaliseName(e.first_name, e.surname) === name
    );
    if (nameMatches.length === 0) return null;

    if (dateOfBirth) {
      const exact = nameMatches.find((e) => e.date_of_birth && e.date_of_birth === dateOfBirth);
      if (exact) return { entry: exact, matchType: "confirmed" };
    }
    // Name matched but the date of birth was not supplied or did not match —
    // staff must confirm identity rather than the system auto-matching.
    return { entry: nameMatches[0], matchType: "near" };
  };

  /** Entries whose review date has passed (or was never set) — these need renewing or removing. */
  const entriesDueReview = (query.data || []).filter((e) => {
    if (!e.review_date) return true;
    return new Date(`${e.review_date}T23:59:59`).getTime() < Date.now();
  });

  /**
   * Kiosk-safe check. The kiosk cannot read the watchlist register, so it asks the
   * server for a decision only — never the reason, instructions or history.
   */
  const checkVisitorRemote = async (
    firstName: string,
    surname: string
  ): Promise<WatchlistMatch | null> => {
    if (!firstName?.trim() || !surname?.trim()) return null;
    const { data, error } = await kioskRpc<any[]>("kioskd_watchlist_check", {
      p_first: firstName,
      p_last: surname,
    });
    const row = (data as any[])?.[0];
    if (error || !row?.is_match) return null;
    const entry: WatchlistEntry = {
      id: "kiosk-match",
      first_name: firstName,
      surname,
      date_of_birth: null,
      photo_url: null,
      reason: "Please speak to a staff member before continuing.",
      reason_category: null,
      review_date: null,
      instructions: null,
      alert_type: (row.alert_type === "soft" ? "soft" : "hard"),
      added_by: "",
      is_active: true,
      created_at: new Date().toISOString(),
    };
    return { entry, matchType: "near" };
  };

  return { ...query, addEntry, updateEntry, removeEntry, checkVisitor, checkVisitorRemote, flagMatchedVisit, entriesDueReview };
}
