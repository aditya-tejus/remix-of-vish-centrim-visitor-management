import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { kioskRpc } from "@/lib/kioskRpc";
import {
  documentStoragePath,
  type ComplianceRow,
  type QueueRow,
  type ReviewDecision,
} from "@/lib/contractorDocuments";

const BUCKET = "contractor-documents";
/** Links are deliberately short lived and requested again each time. */
const SIGNED_URL_SECONDS = 120;

/* ------------------------------------------------------------------ */
/* Authoritative status                                                */
/* ------------------------------------------------------------------ */

export async function fetchComplianceStatus(params: {
  personId?: string | null;
  supplierId?: string | null;
  branchId: string | null;
  category?: string | null;
}): Promise<ComplianceRow[]> {
  if (!params.branchId || (!params.personId && !params.supplierId)) return [];
  const { data, error } = await supabase.rpc("contractor_compliance_status", {
    p_person_id: params.personId ?? null,
    p_supplier_id: params.supplierId ?? null,
    p_branch_id: params.branchId,
    p_category: params.category ?? null,
  } as any);
  if (error) return [];
  return (data as unknown as ComplianceRow[]) || [];
}

/** Profile and check-in both read the server's verdict, never their own. */
export function useComplianceStatus(params: {
  personId?: string | null;
  supplierId?: string | null;
  branchId: string | null;
  category?: string | null;
}) {
  const [rows, setRows] = useState<ComplianceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const { personId, supplierId, branchId, category } = params;

  const refetch = useCallback(async () => {
    setLoading(true);
    setRows(await fetchComplianceStatus({ personId, supplierId, branchId, category }));
    setLoading(false);
  }, [personId, supplierId, branchId, category]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { rows, loading, refetch };
}

/* ------------------------------------------------------------------ */
/* Submission                                                          */
/* ------------------------------------------------------------------ */

export interface SubmitInput {
  branchId: string;
  credentialTypeId: string;
  credentialKey: string;
  holderScope: "person" | "company";
  personId?: string | null;
  supplierId?: string | null;
  file?: File | null;
  issueDate?: string | null;
  expiryDate?: string | null;
  documentNumber?: string | null;
  source?: string;
}

/**
 * Uploads the evidence and records it as awaiting review. Nothing here can
 * make a document count as verified.
 */
export async function submitContractorDocument(input: SubmitInput): Promise<string> {
  const holderId = input.holderScope === "person" ? input.personId : input.supplierId;
  if (!holderId) throw new Error("No contractor or company selected");

  let path: string | null = null;
  if (input.file) {
    path = documentStoragePath({
      branchId: input.branchId,
      holderScope: input.holderScope,
      holderId,
      credentialKey: input.credentialKey,
      fileName: input.file.name,
      uid: crypto.randomUUID(),
    });
    const { error } = await supabase.storage.from(BUCKET).upload(path, input.file, { upsert: false });
    if (error) throw error;
  }

  const { data, error } = await supabase.rpc("contractor_document_submit", {
    p_branch_id: input.branchId,
    p_credential_type_id: input.credentialTypeId,
    p_holder_scope: input.holderScope,
    p_person_id: input.personId ?? null,
    p_supplier_id: input.supplierId ?? null,
    p_storage_path: path,
    p_file_name: input.file?.name ?? null,
    p_mime_type: input.file?.type ?? null,
    p_file_size: input.file?.size ?? null,
    p_issue_date: input.issueDate || null,
    p_expiry_date: input.expiryDate || null,
    p_document_number: input.documentNumber || null,
    p_source: input.source || "upload",
  } as any);
  if (error) throw error;
  return data as unknown as string;
}

/* ------------------------------------------------------------------ */
/* Review                                                              */
/* ------------------------------------------------------------------ */

export async function reviewContractorDocument(input: {
  documentId: string;
  decision: ReviewDecision;
  reasonCode?: string | null;
  notes?: string | null;
  confirmedExpiry?: string | null;
  nextAction?: string | null;
}): Promise<void> {
  const { error } = await supabase.rpc("contractor_document_review", {
    p_document_id: input.documentId,
    p_decision: input.decision,
    p_reason_code: input.reasonCode || null,
    p_notes: input.notes || null,
    p_confirmed_expiry: input.confirmedExpiry || null,
    p_next_action: input.nextAction || null,
  } as any);
  if (error) throw error;
}

/** Asks the server for the file location, then mints a short-lived link. */
export async function openContractorDocument(documentId: string): Promise<string | null> {
  const { data: path, error } = await supabase.rpc("contractor_document_path", {
    p_document_id: documentId,
  } as any);
  if (error || !path) return null;
  const { data } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path as unknown as string, SIGNED_URL_SECONDS);
  return data?.signedUrl || null;
}

/* ------------------------------------------------------------------ */
/* Queue and history                                                   */
/* ------------------------------------------------------------------ */

const QUEUE_SELECT = `
  id, branch_id, credential_type_id, holder_scope, status, version,
  submitted_by, submitted_at, expiry_date, issue_date, document_number,
  file_name, mime_type, source, person_id, supplier_id,
  credential_types ( label, short_label ),
  contractor_people ( first_name, surname ),
  suppliers_min ( name )
`;

function toQueueRow(r: any): QueueRow {
  return {
    id: r.id,
    branch_id: r.branch_id,
    credential_type_id: r.credential_type_id,
    holder_scope: r.holder_scope,
    holder_name:
      r.holder_scope === "person"
        ? `${r.contractor_people?.first_name ?? ""} ${r.contractor_people?.surname ?? ""}`.trim() || "Unnamed contractor"
        : r.suppliers_min?.name || "Company",
    company_name: r.suppliers_min?.name ?? null,
    type_label: r.credential_types?.label || "Document",
    status: r.status,
    version: r.version,
    submitted_by: r.submitted_by,
    submitted_at: r.submitted_at,
    expiry_date: r.expiry_date,
  };
}

/** Everything awaiting a decision at the sites this reviewer works at. */
export function useDocumentQueue(branchId: string | null) {
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    let q = supabase.from("contractor_documents").select(QUEUE_SELECT).order("submitted_at", { ascending: true }).limit(500);
    if (branchId) q = q.eq("branch_id", branchId);
    const { data } = await q;
    setRows(((data as any[]) || []).map(toQueueRow));
    setLoading(false);
  }, [branchId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { rows, loading, refetch };
}

export interface DocumentDetail {
  id: string;
  branch_id: string;
  credential_type_id: string;
  type_label: string;
  holder_scope: "person" | "company";
  holder_name: string;
  company_name: string | null;
  status: string;
  version: number;
  issue_date: string | null;
  expiry_date: string | null;
  document_number: string | null;
  file_name: string | null;
  source: string;
  submitted_by: string;
  submitted_at: string;
  person_id: string | null;
  supplier_id: string | null;
}

export interface ReviewRecord {
  id: string;
  document_id: string;
  decision: string;
  reviewer_label: string;
  reason_code: string | null;
  notes: string | null;
  confirmed_expiry: string | null;
  created_at: string;
}

/** Full version history for one holder and document type — nothing deleted. */
export function useDocumentHistory(document: DocumentDetail | null) {
  const [versions, setVersions] = useState<DocumentDetail[]>([]);
  const [reviews, setReviews] = useState<ReviewRecord[]>([]);

  const refetch = useCallback(async () => {
    if (!document) {
      setVersions([]);
      setReviews([]);
      return;
    }
    const holderColumn = document.holder_scope === "person" ? "person_id" : "supplier_id";
    const holderId = document.holder_scope === "person" ? document.person_id : document.supplier_id;
    const { data } = await supabase
      .from("contractor_documents")
      .select(QUEUE_SELECT)
      .eq("credential_type_id", document.credential_type_id)
      .eq("branch_id", document.branch_id)
      .eq(holderColumn, holderId as string)
      .order("version", { ascending: false });
    const rows = (data as any[]) || [];
    setVersions(rows.map(toDetail));
    const ids = rows.map((r) => r.id);
    if (ids.length) {
      const { data: rv } = await supabase
        .from("contractor_document_reviews")
        .select("id, document_id, decision, reviewer_label, reason_code, notes, confirmed_expiry, created_at")
        .in("document_id", ids)
        .order("created_at", { ascending: false });
      setReviews((rv as ReviewRecord[]) || []);
    } else {
      setReviews([]);
    }
  }, [document]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { versions, reviews, refetch };
}

export function toDetail(r: any): DocumentDetail {
  const q = toQueueRow(r);
  return {
    id: r.id,
    branch_id: r.branch_id,
    credential_type_id: r.credential_type_id,
    type_label: q.type_label,
    holder_scope: r.holder_scope,
    holder_name: q.holder_name,
    company_name: q.company_name,
    status: r.status,
    version: r.version,
    issue_date: r.issue_date ?? null,
    expiry_date: r.expiry_date ?? null,
    document_number: r.document_number ?? null,
    file_name: r.file_name ?? null,
    source: r.source,
    submitted_by: r.submitted_by,
    submitted_at: r.submitted_at,
    person_id: r.person_id ?? null,
    supplier_id: r.supplier_id ?? null,
  };
}

/** One document with everything the reviewer needs, by id. */
export async function fetchDocumentDetail(id: string): Promise<DocumentDetail | null> {
  const { data } = await supabase.from("contractor_documents").select(QUEUE_SELECT).eq("id", id).maybeSingle();
  return data ? toDetail(data) : null;
}

/* ------------------------------------------------------------------ */
/* Site requirements                                                   */
/* ------------------------------------------------------------------ */

export interface DocumentRequirement {
  id: string;
  branch_id: string | null;
  credential_type_id: string;
  contractor_category: string | null;
  is_mandatory: boolean;
  grace_days: number;
  block_on_fail: boolean;
}

export function useDocumentRequirements(branchId: string | null) {
  const [rows, setRows] = useState<DocumentRequirement[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("contractor_document_requirements")
      .select("id, branch_id, credential_type_id, contractor_category, is_mandatory, grace_days, block_on_fail");
    setRows(((data as DocumentRequirement[]) || []).filter((r) => !branchId || r.branch_id === branchId || r.branch_id === null));
    setLoading(false);
  }, [branchId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const save = useCallback(
    async (input: {
      credentialTypeId: string;
      isMandatory: boolean;
      graceDays: number;
      blockOnFail: boolean;
      category?: string | null;
    }) => {
      if (!branchId) throw new Error("No site selected");
      const existing = rows.find(
        (r) =>
          r.branch_id === branchId &&
          r.credential_type_id === input.credentialTypeId &&
          (r.contractor_category ?? null) === (input.category ?? null)
      );
      if (existing) {
        const { error } = await supabase
          .from("contractor_document_requirements")
          .update({
            is_mandatory: input.isMandatory,
            grace_days: input.graceDays,
            block_on_fail: input.blockOnFail,
          })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("contractor_document_requirements").insert({
          branch_id: branchId,
          credential_type_id: input.credentialTypeId,
          contractor_category: input.category ?? null,
          is_mandatory: input.isMandatory,
          grace_days: input.graceDays,
          block_on_fail: input.blockOnFail,
        });
        if (error) throw error;
      }
      await refetch();
    },
    [branchId, rows, refetch]
  );

  return { rows, loading, refetch, save };
}

/* ------------------------------------------------------------------ */
/* Server verdict used by check-in (reception and kiosk)               */
/* ------------------------------------------------------------------ */

export interface ContractorVerdict {
  blocked: boolean;
  reason: string | null;
  outstanding: string[];
  awaitingReview: number;
  loading: boolean;
}

/**
 * The compliance answer used at check-in. It always comes from the server —
 * the kiosk derives its site from the bound device, reception from its site —
 * so nothing on screen can talk the gate into opening.
 */
export function useContractorVerdict(params: {
  personId?: string | null;
  supplierId?: string | null;
  branchId: string | null;
  kiosk?: boolean;
  category?: string | null;
}): ContractorVerdict {
  const { personId, supplierId, branchId, kiosk, category } = params;
  const [state, setState] = useState<Omit<ContractorVerdict, "loading">>({
    blocked: false, reason: null, outstanding: [], awaitingReview: 0,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!personId && !supplierId) {
      setState({ blocked: false, reason: null, outstanding: [], awaitingReview: 0 });
      return;
    }
    setLoading(true);
    (async () => {
      let rows: Array<{ label: string; status: string; blocking: boolean; mandatory: boolean }> = [];
      if (kiosk) {
        const { data } = await kioskRpc<any[]>("kioskd_contractor_compliance", {
          p_person_id: personId ?? null,
          p_supplier_id: supplierId ?? null,
          p_category: category ?? null,
        });
        rows = (data as any[]) || [];
      } else if (branchId) {
        rows = (await fetchComplianceStatus({ personId, supplierId, branchId, category })) as any[];
      }
      if (cancelled) return;
      const blockingRows = rows.filter((r) => r.blocking);
      setState({
        blocked: blockingRows.length > 0,
        reason: blockingRows.length
          ? `${blockingRows.map((r) => r.label).join(", ")} must be verified before this contractor works unsupervised.`
          : null,
        outstanding: rows
          .filter((r) => r.mandatory && !["valid", "expiring", "not_required"].includes(r.status))
          .map((r) => r.label),
        awaitingReview: rows.filter((r) => r.status === "pending").length,
      });
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [personId, supplierId, branchId, kiosk, category]);

  return { ...state, loading };
}
