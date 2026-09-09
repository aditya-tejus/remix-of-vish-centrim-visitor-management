
-- ---------------------------------------------------------------- helpers
CREATE OR REPLACE FUNCTION public.contractor_docs_can_view(_branch uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL
     AND public.has_permission(auth.uid(), 'contractor.credentials.view')
     AND (_branch IS NULL OR public.user_can_access_site(_branch))
$$;

CREATE OR REPLACE FUNCTION public.contractor_docs_can_manage(_branch uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL
     AND public.has_permission(auth.uid(), 'contractor.credentials.manage')
     AND (_branch IS NULL OR public.user_can_access_site(_branch))
$$;

-- ---------------------------------------------------------------- schema
ALTER TABLE public.credential_types
  ADD COLUMN IF NOT EXISTS contractor_category text[];

CREATE TABLE IF NOT EXISTS public.contractor_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.branches(id),
  credential_type_id uuid NOT NULL REFERENCES public.credential_types(id),
  holder_scope text NOT NULL CHECK (holder_scope IN ('person','company')),
  person_id uuid REFERENCES public.contractor_people(id),
  supplier_id uuid REFERENCES public.suppliers_min(id),
  storage_path text,
  file_name text,
  mime_type text,
  file_size integer,
  issue_date date,
  expiry_date date,
  document_number text,
  source text NOT NULL DEFAULT 'upload' CHECK (source IN ('upload','email','in_person','portal')),
  submitted_by text NOT NULL,
  submitted_by_user_id uuid,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 1,
  supersedes_document_id uuid REFERENCES public.contractor_documents(id),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','verified','rejected','expired','superseded','not_required')),
  is_current boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contractor_documents_holder_ck CHECK (
    (holder_scope = 'person'  AND person_id IS NOT NULL) OR
    (holder_scope = 'company' AND supplier_id IS NOT NULL)
  )
);

GRANT SELECT, INSERT ON public.contractor_documents TO authenticated;
GRANT ALL ON public.contractor_documents TO service_role;
ALTER TABLE public.contractor_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View contractor documents at my sites"
  ON public.contractor_documents FOR SELECT TO authenticated
  USING (public.contractor_docs_can_view(branch_id));

CREATE POLICY "Submit contractor documents at my sites"
  ON public.contractor_documents FOR INSERT TO authenticated
  WITH CHECK (public.contractor_docs_can_manage(branch_id) AND status = 'pending');

CREATE UNIQUE INDEX IF NOT EXISTS contractor_documents_current_uq
  ON public.contractor_documents (branch_id, credential_type_id, COALESCE(person_id, supplier_id))
  WHERE is_current;

CREATE INDEX IF NOT EXISTS contractor_documents_status_idx
  ON public.contractor_documents (status, branch_id, submitted_at);

CREATE TRIGGER contractor_documents_touch
  BEFORE UPDATE ON public.contractor_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.contractor_document_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.contractor_documents(id) ON DELETE CASCADE,
  decision text NOT NULL CHECK (decision IN ('approved','rejected','not_required')),
  reviewer_user_id uuid,
  reviewer_label text NOT NULL,
  reason_code text,
  notes text,
  confirmed_expiry date,
  next_action text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.contractor_document_reviews TO authenticated;
GRANT ALL ON public.contractor_document_reviews TO service_role;
ALTER TABLE public.contractor_document_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View contractor document decisions at my sites"
  ON public.contractor_document_reviews FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.contractor_documents d
    WHERE d.id = document_id AND public.contractor_docs_can_view(d.branch_id)
  ));

CREATE INDEX IF NOT EXISTS contractor_document_reviews_doc_idx
  ON public.contractor_document_reviews (document_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.contractor_document_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid REFERENCES public.branches(id),
  credential_type_id uuid NOT NULL REFERENCES public.credential_types(id),
  contractor_category text,
  is_mandatory boolean NOT NULL DEFAULT false,
  grace_days integer NOT NULL DEFAULT 0 CHECK (grace_days >= 0 AND grace_days <= 365),
  block_on_fail boolean NOT NULL DEFAULT false,
  jurisdiction text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contractor_document_requirements TO authenticated;
GRANT ALL ON public.contractor_document_requirements TO service_role;
ALTER TABLE public.contractor_document_requirements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read contractor document requirements"
  ON public.contractor_document_requirements FOR SELECT TO authenticated
  USING (branch_id IS NULL OR public.user_can_access_site(branch_id));

CREATE POLICY "Manage contractor document requirements"
  ON public.contractor_document_requirements FOR ALL TO authenticated
  USING (public.contractor_docs_can_manage(branch_id) OR public.has_permission(auth.uid(),'settings.administer'))
  WITH CHECK (public.contractor_docs_can_manage(branch_id) OR public.has_permission(auth.uid(),'settings.administer'));

CREATE UNIQUE INDEX IF NOT EXISTS contractor_document_requirements_uq
  ON public.contractor_document_requirements
     (COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid),
      credential_type_id,
      COALESCE(contractor_category, '*'));

CREATE TRIGGER contractor_document_requirements_touch
  BEFORE UPDATE ON public.contractor_document_requirements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- audit for requirement changes (no document content involved)
CREATE OR REPLACE FUNCTION public.log_contractor_requirement_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.contractor_document_requirements;
BEGIN
  v_row := COALESCE(NEW, OLD);
  INSERT INTO public.audit_log (action, performed_by, user_id, records_affected, details)
  VALUES (
    'contractor_document_requirement_' || lower(TG_OP),
    COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), 'system'),
    auth.uid(), 1,
    jsonb_build_object(
      'branch_id', v_row.branch_id,
      'credential_type_id', v_row.credential_type_id,
      'contractor_category', v_row.contractor_category,
      'is_mandatory', v_row.is_mandatory,
      'grace_days', v_row.grace_days,
      'block_on_fail', v_row.block_on_fail
    )
  );
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE TRIGGER contractor_document_requirements_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.contractor_document_requirements
  FOR EACH ROW EXECUTE FUNCTION public.log_contractor_requirement_change();

-- ---------------------------------------------------------------- submit
CREATE OR REPLACE FUNCTION public.contractor_document_submit(
  p_branch_id uuid,
  p_credential_type_id uuid,
  p_holder_scope text,
  p_person_id uuid DEFAULT NULL,
  p_supplier_id uuid DEFAULT NULL,
  p_storage_path text DEFAULT NULL,
  p_file_name text DEFAULT NULL,
  p_mime_type text DEFAULT NULL,
  p_file_size integer DEFAULT NULL,
  p_issue_date date DEFAULT NULL,
  p_expiry_date date DEFAULT NULL,
  p_document_number text DEFAULT NULL,
  p_source text DEFAULT 'upload'
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_prev public.contractor_documents;
  v_id uuid;
  v_actor text;
BEGIN
  IF NOT public.contractor_docs_can_manage(p_branch_id) THEN
    RAISE EXCEPTION 'Not allowed to submit contractor documents for this site';
  END IF;
  IF p_holder_scope NOT IN ('person','company') THEN
    RAISE EXCEPTION 'Unknown document holder';
  END IF;

  SELECT * INTO v_prev FROM public.contractor_documents
   WHERE is_current AND branch_id = p_branch_id
     AND credential_type_id = p_credential_type_id
     AND COALESCE(person_id, supplier_id) = COALESCE(p_person_id, p_supplier_id)
   FOR UPDATE;

  IF v_prev.id IS NOT NULL THEN
    UPDATE public.contractor_documents
       SET is_current = false, status = 'superseded'
     WHERE id = v_prev.id;
  END IF;

  v_actor := COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), 'staff');

  INSERT INTO public.contractor_documents (
    branch_id, credential_type_id, holder_scope, person_id, supplier_id,
    storage_path, file_name, mime_type, file_size, issue_date, expiry_date,
    document_number, source, submitted_by, submitted_by_user_id,
    version, supersedes_document_id, status, is_current
  ) VALUES (
    p_branch_id, p_credential_type_id, p_holder_scope, p_person_id, p_supplier_id,
    p_storage_path, p_file_name, p_mime_type, p_file_size, p_issue_date, p_expiry_date,
    p_document_number, COALESCE(p_source,'upload'), v_actor, auth.uid(),
    COALESCE(v_prev.version, 0) + 1, v_prev.id, 'pending', true
  ) RETURNING id INTO v_id;

  INSERT INTO public.audit_log (action, performed_by, user_id, records_affected, details)
  VALUES ('contractor_document_submitted', v_actor, auth.uid(), 1,
    jsonb_build_object('document_id', v_id, 'branch_id', p_branch_id,
      'credential_type_id', p_credential_type_id, 'holder_scope', p_holder_scope,
      'person_id', p_person_id, 'supplier_id', p_supplier_id,
      'version', COALESCE(v_prev.version,0)+1, 'source', COALESCE(p_source,'upload')));

  RETURN v_id;
END $$;

-- ---------------------------------------------------------------- review
CREATE OR REPLACE FUNCTION public.contractor_document_review(
  p_document_id uuid,
  p_decision text,
  p_reason_code text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_confirmed_expiry date DEFAULT NULL,
  p_next_action text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_doc public.contractor_documents;
  v_actor text;
  v_status text;
  v_expiry date;
BEGIN
  SELECT * INTO v_doc FROM public.contractor_documents WHERE id = p_document_id FOR UPDATE;
  IF v_doc.id IS NULL THEN RAISE EXCEPTION 'Document not found'; END IF;
  IF NOT public.contractor_docs_can_manage(v_doc.branch_id) THEN
    RAISE EXCEPTION 'Not allowed to review contractor documents for this site';
  END IF;
  IF p_decision NOT IN ('approved','rejected','not_required') THEN
    RAISE EXCEPTION 'Unknown decision';
  END IF;
  IF NOT v_doc.is_current OR v_doc.status <> 'pending' THEN
    RAISE EXCEPTION 'This document has already been decided';
  END IF;
  IF p_decision = 'rejected' AND COALESCE(btrim(p_notes),'') = '' AND COALESCE(p_reason_code,'') = '' THEN
    RAISE EXCEPTION 'A reason is required when rejecting a document';
  END IF;

  v_actor := COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), 'staff');
  v_expiry := COALESCE(p_confirmed_expiry, v_doc.expiry_date);
  v_status := CASE p_decision
                WHEN 'approved' THEN 'verified'
                WHEN 'rejected' THEN 'rejected'
                ELSE 'not_required' END;

  UPDATE public.contractor_documents
     SET status = v_status, expiry_date = v_expiry
   WHERE id = p_document_id;

  INSERT INTO public.contractor_document_reviews
    (document_id, decision, reviewer_user_id, reviewer_label, reason_code, notes, confirmed_expiry, next_action)
  VALUES (p_document_id, p_decision, auth.uid(), v_actor, p_reason_code, p_notes, p_confirmed_expiry, p_next_action);

  -- keep the older derived records in step so existing screens agree
  IF v_doc.holder_scope = 'person' THEN
    INSERT INTO public.contractor_credentials
      (person_id, credential_type_id, expiry_date, reference, verification_status, verified_by, verified_at)
    VALUES (v_doc.person_id, v_doc.credential_type_id, v_expiry, v_doc.document_number,
            CASE WHEN p_decision = 'approved' THEN 'verified' ELSE 'pending' END,
            CASE WHEN p_decision = 'approved' THEN v_actor ELSE NULL END,
            CASE WHEN p_decision = 'approved' THEN now() ELSE NULL END)
    ON CONFLICT (person_id, credential_type_id) DO UPDATE
      SET expiry_date = EXCLUDED.expiry_date,
          verification_status = EXCLUDED.verification_status,
          verified_by = EXCLUDED.verified_by,
          verified_at = EXCLUDED.verified_at,
          updated_at = now();
  ELSIF p_decision = 'approved' THEN
    INSERT INTO public.supplier_credentials (supplier_id, credential_type_id, expiry_date, reference)
    VALUES (v_doc.supplier_id, v_doc.credential_type_id, v_expiry, v_doc.document_number)
    ON CONFLICT (supplier_id, credential_type_id) DO UPDATE
      SET expiry_date = EXCLUDED.expiry_date, updated_at = now();
  END IF;

  INSERT INTO public.audit_log (action, performed_by, user_id, records_affected, details, change_reason)
  VALUES ('contractor_document_reviewed', v_actor, auth.uid(), 1,
    jsonb_build_object('document_id', p_document_id, 'branch_id', v_doc.branch_id,
      'credential_type_id', v_doc.credential_type_id, 'decision', p_decision,
      'reason_code', p_reason_code, 'version', v_doc.version, 'status', v_status),
    p_notes);
END $$;

-- ------------------------------------------------------- short-lived access
CREATE OR REPLACE FUNCTION public.contractor_document_path(p_document_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_doc public.contractor_documents; v_actor text;
BEGIN
  SELECT * INTO v_doc FROM public.contractor_documents WHERE id = p_document_id;
  IF v_doc.id IS NULL THEN RAISE EXCEPTION 'Document not found'; END IF;
  IF NOT public.contractor_docs_can_view(v_doc.branch_id) THEN
    RAISE EXCEPTION 'Not allowed to open this document';
  END IF;
  v_actor := COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), 'staff');
  INSERT INTO public.audit_log (action, performed_by, user_id, records_affected, details)
  VALUES ('contractor_document_viewed', v_actor, auth.uid(), 1,
    jsonb_build_object('document_id', p_document_id, 'branch_id', v_doc.branch_id,
      'credential_type_id', v_doc.credential_type_id, 'version', v_doc.version));
  RETURN v_doc.storage_path;
END $$;

-- ------------------------------------------------------- compliance status
CREATE OR REPLACE FUNCTION public.contractor_compliance_internal(
  p_person_id uuid, p_supplier_id uuid, p_branch_id uuid, p_category text
) RETURNS TABLE (
  credential_type_id uuid, credential_key text, label text, short_label text,
  holder_scope text, mandatory boolean, block_on_fail boolean, grace_days integer,
  status text, expiry_date date, grace_ends date, blocking boolean,
  document_id uuid, version integer, submitted_at timestamptz, reviewed_at timestamptz
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_jur text;
BEGIN
  SELECT COALESCE(b.jurisdiction, 'AU') INTO v_jur FROM public.branches b WHERE b.id = p_branch_id;

  RETURN QUERY
  WITH types AS (
    SELECT t.* FROM public.credential_types t
     WHERE t.is_active
       AND (t.jurisdiction = 'ALL' OR t.jurisdiction = v_jur)
       AND (t.contractor_category IS NULL OR p_category IS NULL OR p_category = ANY (t.contractor_category))
  ), req AS (
    SELECT DISTINCT ON (r.credential_type_id) r.*
      FROM public.contractor_document_requirements r
     WHERE (r.branch_id = p_branch_id OR r.branch_id IS NULL)
       AND (r.contractor_category IS NULL OR r.contractor_category = p_category)
     ORDER BY r.credential_type_id,
              (r.branch_id IS NOT NULL) DESC,
              (r.contractor_category IS NOT NULL) DESC
  ), doc AS (
    SELECT DISTINCT ON (d.credential_type_id) d.*
      FROM public.contractor_documents d
     WHERE d.is_current AND d.branch_id = p_branch_id
       AND ((d.holder_scope = 'person'  AND d.person_id   = p_person_id)
         OR (d.holder_scope = 'company' AND d.supplier_id = p_supplier_id))
     ORDER BY d.credential_type_id, d.submitted_at DESC
  )
  SELECT
    t.id, t.key, t.label, t.short_label,
    COALESCE(t.holder_scope, 'company'),
    COALESCE(rq.is_mandatory, false),
    COALESCE(rq.block_on_fail, false),
    COALESCE(rq.grace_days, 0),
    s.state, d.expiry_date,
    CASE WHEN d.expiry_date IS NULL THEN NULL
         ELSE d.expiry_date + COALESCE(rq.grace_days,0) END,
    COALESCE(rq.is_mandatory, false) AND COALESCE(rq.block_on_fail, false)
      AND s.state NOT IN ('valid','expiring','grace','not_required'),
    d.id, d.version, d.submitted_at,
    (SELECT max(rv.created_at) FROM public.contractor_document_reviews rv WHERE rv.document_id = d.id)
  FROM types t
  LEFT JOIN req rq ON rq.credential_type_id = t.id
  LEFT JOIN doc d  ON d.credential_type_id  = t.id
  CROSS JOIN LATERAL (
    SELECT CASE
      WHEN d.id IS NULL THEN 'missing'
      WHEN d.status = 'rejected' THEN 'rejected'
      WHEN d.status = 'not_required' THEN 'not_required'
      WHEN d.status = 'pending' THEN 'pending'
      WHEN d.status = 'verified' AND d.expiry_date IS NULL THEN 'valid'
      WHEN d.status = 'verified'
           AND d.expiry_date + COALESCE(rq.grace_days,0) < CURRENT_DATE THEN 'expired'
      WHEN d.status = 'verified' AND d.expiry_date < CURRENT_DATE THEN 'grace'
      WHEN d.status = 'verified' AND d.expiry_date <= CURRENT_DATE + 30 THEN 'expiring'
      WHEN d.status = 'verified' THEN 'valid'
      ELSE 'missing' END AS state
  ) s
  ORDER BY t.sort_order;
END $$;

CREATE OR REPLACE FUNCTION public.contractor_compliance_status(
  p_person_id uuid, p_supplier_id uuid, p_branch_id uuid, p_category text DEFAULT NULL
) RETURNS TABLE (
  credential_type_id uuid, credential_key text, label text, short_label text,
  holder_scope text, mandatory boolean, block_on_fail boolean, grace_days integer,
  status text, expiry_date date, grace_ends date, blocking boolean,
  document_id uuid, version integer, submitted_at timestamptz, reviewed_at timestamptz
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.user_can_access_site(p_branch_id) THEN
    RAISE EXCEPTION 'No access to this site';
  END IF;
  RETURN QUERY SELECT * FROM public.contractor_compliance_internal(p_person_id, p_supplier_id, p_branch_id, p_category);
END $$;

-- kiosk: site comes from the bound device, never from the tablet
CREATE OR REPLACE FUNCTION public.kioskd_contractor_compliance(
  p_token text, p_person_id uuid, p_supplier_id uuid DEFAULT NULL, p_category text DEFAULT NULL
) RETURNS TABLE (label text, status text, blocking boolean, mandatory boolean, grace_ends date)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_branch uuid;
BEGIN
  v_branch := public.kiosk_device_site(p_token, false);
  RETURN QUERY
  SELECT c.label, c.status, c.blocking, c.mandatory, c.grace_ends
    FROM public.contractor_compliance_internal(p_person_id, p_supplier_id, v_branch, p_category) c;
END $$;

REVOKE ALL ON FUNCTION public.contractor_compliance_internal(uuid, uuid, uuid, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.contractor_document_submit(uuid,uuid,text,uuid,uuid,text,text,text,integer,date,date,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.contractor_document_review(uuid,text,text,text,date,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.contractor_document_path(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.contractor_compliance_status(uuid,uuid,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.kioskd_contractor_compliance(text,uuid,uuid,text) TO anon, authenticated;

-- ------------------------------------------------- tighten document storage
DROP POLICY IF EXISTS "Staff read contractor documents" ON storage.objects;
DROP POLICY IF EXISTS "Staff write contractor documents" ON storage.objects;
DROP POLICY IF EXISTS "Staff update contractor documents" ON storage.objects;
DROP POLICY IF EXISTS "Staff delete contractor documents" ON storage.objects;

CREATE POLICY "Read contractor documents for my sites"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'contractor-documents'
     AND public.contractor_docs_can_view(NULLIF((storage.foldername(name))[1], '')::uuid));

CREATE POLICY "Write contractor documents for my sites"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'contractor-documents'
     AND public.contractor_docs_can_manage(NULLIF((storage.foldername(name))[1], '')::uuid));
