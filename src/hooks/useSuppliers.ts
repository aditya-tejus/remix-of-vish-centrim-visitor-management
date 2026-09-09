import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Supplier {
  id: string;
  name: string;
  abn: string | null;
  company_number: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  /** UK: Disclosure and Barring Service check */
  dbs_expiry_date?: string | null;
  dbs_reference?: string | null;
  /** AU: Aged Care Worker Screening clearance */
  acws_expiry_date?: string | null;
  acws_reference?: string | null;
  insurance_expiry_date?: string | null;
  insurance_reference?: string | null;
}

interface UseSuppliersOptions {
  /** Kiosk / unauthenticated context: supplier name only, no credential data. */
  publicMode?: boolean;
  /** Kiosk context: the site this device belongs to. Results never cross sites. */
  siteId?: string | null;
}

export function useSuppliers({ publicMode = false, siteId = null }: UseSuppliersOptions = {}) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSuppliers = useCallback(async () => {
    if (publicMode) {
      const { data } = await supabase.rpc("kiosk_supplier_directory" as any, {
        p_branch_id: siteId ?? null,
      });
      if (data) {
        setSuppliers(
          (data as any[]).map((s) => ({
            id: s.id,
            name: s.name,
            abn: null,
            company_number: null,
            contact_name: null,
            contact_phone: null,
            contact_email: null,
          }))
        );
      }
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("suppliers_min")
      .select("*")
      .eq("is_active", true)
      .order("name");
    if (data) setSuppliers(data as Supplier[]);
    setLoading(false);
  }, [publicMode]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  /** Records/updates a credential expiry date and document reference on the supplier. */
  const updateCredential = useCallback(
    async (supplierId: string, fields: Partial<Supplier>) => {
      const { data, error } = await supabase
        .from("suppliers_min")
        .update({ ...fields, updated_at: new Date().toISOString() } as any)
        .eq("id", supplierId)
        .select()
        .single();
      if (error) throw error;
      setSuppliers((prev) => prev.map((s) => (s.id === supplierId ? (data as Supplier) : s)));
      return data as Supplier;
    },
    []
  );

  return { suppliers, loading, refetch: fetchSuppliers, updateCredential };
}
