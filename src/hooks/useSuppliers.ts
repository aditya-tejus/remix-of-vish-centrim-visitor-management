import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Supplier {
  id: string;
  name: string;
  abn: string | null;
  company_number: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
}

export function useSuppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("suppliers_min")
      .select("*")
      .eq("is_active", true)
      .order("name")
      .then(({ data }) => {
        if (data) setSuppliers(data as Supplier[]);
        setLoading(false);
      });
  }, []);

  return { suppliers, loading };
}
