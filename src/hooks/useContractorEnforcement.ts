import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { CredentialType, SupplierCredentialRecord } from "@/lib/contractorCredentials";

/**
 * The configurable list of contractor credentials (Settings > Contractor
 * credentials). Which ones are required before check-in is stored on each
 * credential type, not in a global setting.
 */
export function useCredentialTypes() {
  const [types, setTypes] = useState<CredentialType[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    const { data } = await supabase
      .from("credential_types")
      .select("*")
      .order("sort_order");
    setTypes((data as CredentialType[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  const activeTypes = types.filter((t) => t.is_active);

  return { types, activeTypes, loading, refetch };
}

/** Expiry dates and document references recorded against one supplier. */
export function useSupplierCredentials(supplierId: string | null | undefined) {
  const [records, setRecords] = useState<SupplierCredentialRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (!supplierId) { setRecords([]); return; }
    setLoading(true);
    const { data } = await supabase
      .from("supplier_credentials")
      .select("credential_type_id, expiry_date, reference")
      .eq("supplier_id", supplierId);
    setRecords((data as SupplierCredentialRecord[]) || []);
    setLoading(false);
  }, [supplierId]);

  useEffect(() => { refetch(); }, [refetch]);

  const save = useCallback(
    async (credentialTypeId: string, fields: { expiry_date?: string | null; reference?: string | null }) => {
      if (!supplierId) return;
      const existing = records.find((r) => r.credential_type_id === credentialTypeId);
      const payload = {
        supplier_id: supplierId,
        credential_type_id: credentialTypeId,
        expiry_date: fields.expiry_date !== undefined ? (fields.expiry_date || null) : (existing?.expiry_date ?? null),
        reference: fields.reference !== undefined ? (fields.reference || null) : (existing?.reference ?? null),
      };
      const { error } = await supabase
        .from("supplier_credentials")
        .upsert(payload, { onConflict: "supplier_id,credential_type_id" });
      if (error) throw error;
      setRecords((prev) => {
        const next = prev.filter((r) => r.credential_type_id !== credentialTypeId);
        return [...next, { credential_type_id: credentialTypeId, expiry_date: payload.expiry_date, reference: payload.reference }];
      });
    },
    [supplierId, records]
  );

  return { records, loading, refetch, save };
}
