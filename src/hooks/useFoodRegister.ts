import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FoodRecord, mapFoodRow } from "@/lib/foodRegister";

export interface FoodFilters {
  from?: string; // yyyy-MM-dd
  to?: string; // yyyy-MM-dd
  residentVisitorId?: string; // "" = all
  visitorName?: string; // free text on brought_by_name
  search?: string; // free text across food / notes / names
}

export function useFoodRegister(filters: FoodFilters) {
  const [records, setRecords] = useState<FoodRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const { from, to, residentVisitorId, visitorName, search } = filters;

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("food_register")
      .select("*")
      .order("recorded_at", { ascending: false })
      .limit(500);

    if (from) query = query.gte("recorded_at", new Date(`${from}T00:00:00`).toISOString());
    if (to) query = query.lte("recorded_at", new Date(`${to}T23:59:59`).toISOString());
    if (residentVisitorId) query = query.eq("resident_visitor_id", residentVisitorId);
    if (visitorName?.trim()) query = query.ilike("brought_by_name", `%${visitorName.trim()}%`);
    if (search?.trim()) {
      const q = search.trim();
      query = query.or(
        `food_description.ilike.%${q}%,notes.ilike.%${q}%,resident_name.ilike.%${q}%,brought_by_name.ilike.%${q}%`
      );
    }

    const { data, error } = await query;
    if (!error && data) setRecords(data.map(mapFoodRow));
    setLoading(false);
  }, [from, to, residentVisitorId, visitorName, search]);

  useEffect(() => {
    const t = setTimeout(fetchRecords, 200);
    return () => clearTimeout(t);
  }, [fetchRecords]);

  return { records, loading, refetch: fetchRecords };
}
