import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { PersonCredentialRecord } from "@/lib/contractorCredentials";

export interface ContractorPerson {
  id: string;
  first_name: string;
  surname: string;
  mobile: string | null;
  email: string | null;
  supplier_id: string | null;
  person_qr: string | null;
  is_active: boolean;
}

const digits = (v: string) => (v || "").replace(/\D/g, "");

/**
 * Finds the individual contractor worker (not the company). Matching is on
 * mobile number first — it is the one thing a tradesperson always has with
 * them — then falls back to an exact name match.
 */
export async function findContractorPerson(params: {
  firstName?: string;
  surname?: string;
  mobile?: string;
  qr?: string;
}): Promise<ContractorPerson | null> {
  const mobile = digits(params.mobile || "");
  const first = (params.firstName || "").trim();
  const last = (params.surname || "").trim();
  const qr = (params.qr || "").trim().toUpperCase();

  // The kiosk is not signed in and cannot read the contractor register directly.
  // It asks a narrow server function for identity only.
  const { data: session } = await supabase.auth.getSession();
  if (!session?.session) {
    const { data } = await supabase.rpc("kiosk_contractor_lookup" as any, {
      p_mobile: mobile || null,
      p_qr: qr || null,
      p_first: first || null,
      p_last: last || null,
    });
    const row = (data as any[])?.[0];
    if (!row) return null;
    return {
      id: row.person_id,
      first_name: row.first_name,
      surname: row.surname,
      mobile: null,
      email: null,
      supplier_id: row.supplier_id,
      person_qr: null,
      is_active: true,
      notes: null,
    } as unknown as ContractorPerson;
  }

  if (qr) {
    const { data } = await supabase.from("contractor_people").select("*").eq("person_qr", qr).maybeSingle();
    if (data) return data as ContractorPerson;
  }

  if (mobile.length >= 6) {
    const { data } = await supabase.from("contractor_people").select("*").limit(200);
    const match = (data as ContractorPerson[] | null)?.find((p) => digits(p.mobile || "") === mobile);
    if (match) return match;
  }

  if (first && last) {
    const { data } = await supabase
      .from("contractor_people")
      .select("*")
      .ilike("first_name", first)
      .ilike("surname", last)
      .limit(1);
    const match = (data as ContractorPerson[] | null)?.[0];
    if (match) return match;
  }

  return null;
}

export async function upsertContractorPerson(input: {
  id?: string | null;
  firstName: string;
  surname: string;
  mobile?: string | null;
  email?: string | null;
  supplierId?: string | null;
}): Promise<ContractorPerson | null> {
  if (input.id) {
    const { data } = await supabase
      .from("contractor_people")
      .update({
        mobile: input.mobile || null,
        email: input.email || null,
        supplier_id: input.supplierId || null,
      })
      .eq("id", input.id)
      .select()
      .maybeSingle();
    return (data as ContractorPerson) || null;
  }
  const { data } = await supabase
    .from("contractor_people")
    .insert({
      first_name: input.firstName.trim(),
      surname: input.surname.trim(),
      mobile: input.mobile || null,
      email: input.email || null,
      supplier_id: input.supplierId || null,
    })
    .select()
    .maybeSingle();
  return (data as ContractorPerson) || null;
}

/** Personal compliance records for one contractor worker. */
export function usePersonCredentials(personId: string | null | undefined) {
  const [records, setRecords] = useState<PersonCredentialRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (!personId) {
      setRecords([]);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("contractor_credentials")
      .select(
        "credential_type_id, expiry_date, reference, document_path, verification_status, uploaded_by, uploaded_at, verified_by, verified_at"
      )
      .eq("person_id", personId);
    setRecords((data as PersonCredentialRecord[]) || []);
    setLoading(false);
  }, [personId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const save = useCallback(
    async (
      credentialTypeId: string,
      fields: Partial<Omit<PersonCredentialRecord, "credential_type_id">>
    ) => {
      if (!personId) return;
      const existing = records.find((r) => r.credential_type_id === credentialTypeId);
      const payload = {
        person_id: personId,
        credential_type_id: credentialTypeId,
        expiry_date: fields.expiry_date !== undefined ? fields.expiry_date || null : existing?.expiry_date ?? null,
        reference: fields.reference !== undefined ? fields.reference || null : existing?.reference ?? null,
        document_path:
          fields.document_path !== undefined ? fields.document_path || null : existing?.document_path ?? null,
        verification_status: fields.verification_status ?? existing?.verification_status ?? "pending",
        uploaded_by: fields.uploaded_by !== undefined ? fields.uploaded_by : existing?.uploaded_by ?? null,
        uploaded_at: fields.uploaded_at !== undefined ? fields.uploaded_at : existing?.uploaded_at ?? null,
        verified_by: fields.verified_by !== undefined ? fields.verified_by : existing?.verified_by ?? null,
        verified_at: fields.verified_at !== undefined ? fields.verified_at : existing?.verified_at ?? null,
      };
      const { error } = await supabase
        .from("contractor_credentials")
        .upsert(payload, { onConflict: "person_id,credential_type_id" });
      if (error) throw error;
      await refetch();
    },
    [personId, records, refetch]
  );

  /** Staff confirmation — the only thing that makes a personal check count as valid. */
  const verify = useCallback(
    async (credentialTypeId: string, verifiedBy: string, expiry?: string | null) => {
      await save(credentialTypeId, {
        verification_status: "verified",
        verified_by: verifiedBy,
        verified_at: new Date().toISOString(),
        ...(expiry !== undefined ? { expiry_date: expiry } : {}),
      });
      await supabase.from("audit_log").insert({
        action: "contractor_credential_verified",
        performed_by: verifiedBy,
        records_affected: 1,
        details: { person_id: personId, credential_type_id: credentialTypeId, expiry_date: expiry ?? null } as any,
      });
    },
    [save, personId]
  );

  return { records, loading, refetch, save, verify };
}

const BUCKET = "contractor-documents";

/** Uploads a compliance document. Kiosk uploads land in a write-only folder. */
export async function uploadContractorDocument(
  file: File,
  opts: { personId: string; credentialTypeId: string; kiosk?: boolean }
): Promise<string | null> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${opts.kiosk ? "kiosk-uploads/" : ""}${opts.personId}/${opts.credentialTypeId}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
  if (error) throw error;
  return path;
}

/** Short-lived link so signed-in staff can open a document. */
export async function contractorDocumentUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 300);
  return data?.signedUrl || null;
}

/** How the site handles a contractor whose mandatory checks are not current. */
export function useContractorEntryPolicy() {
  const [policy, setPolicy] = useState<"unsupervised" | "provisional" | "reception">("unsupervised");

  useEffect(() => {
    supabase
      .from("settings")
      .select("value")
      .eq("key", "contractor_entry_on_fail")
      .maybeSingle()
      .then(({ data }) => {
        const v = data?.value;
        if (v === "unsupervised" || v === "provisional" || v === "reception") setPolicy(v);
      });
  }, []);

  return policy;
}
