import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface WatchlistEntry {
  id: string;
  first_name: string;
  surname: string;
  photo_url: string | null;
  reason: string;
  instructions: string | null;
  alert_type: "soft" | "hard";
  added_by: string;
  is_active: boolean;
  created_at: string;
}

export function useWatchlist() {
  const qc = useQueryClient();

  const query = useQuery({
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
    mutationFn: async (entry: Omit<WatchlistEntry, "id" | "created_at" | "is_active" | "photo_url">) => {
      const { error } = await supabase.from("visitor_watchlist").insert(entry as any);
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

  const checkVisitor = (firstName: string, surname: string): WatchlistEntry | null => {
    if (!query.data) return null;
    const name = `${firstName} ${surname}`.toLowerCase();
    return query.data.find(
      (e) => `${e.first_name} ${e.surname}`.toLowerCase() === name
    ) || null;
  };

  return { ...query, addEntry, removeEntry, checkVisitor };
}
