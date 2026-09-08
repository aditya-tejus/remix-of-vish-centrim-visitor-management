
CREATE TABLE IF NOT EXISTS public.privacy_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE,
  controller_name text,
  controller_contact text,
  privacy_contact text,
  notice_url text,
  notice_text text,
  notice_version text NOT NULL DEFAULT 'v1',
  jurisdiction text,
  data_categories jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS privacy_notices_branch_unique
  ON public.privacy_notices (coalesce(branch_id, '00000000-0000-0000-0000-000000000000'::uuid));

GRANT SELECT ON public.privacy_notices TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.privacy_notices TO authenticated;
GRANT ALL ON public.privacy_notices TO service_role;
ALTER TABLE public.privacy_notices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone may read the active privacy notice" ON public.privacy_notices;
CREATE POLICY "Anyone may read the active privacy notice" ON public.privacy_notices
  FOR SELECT TO anon, authenticated USING (is_active);

DROP POLICY IF EXISTS "Privacy managers maintain notices" ON public.privacy_notices;
CREATE POLICY "Privacy managers maintain notices" ON public.privacy_notices
  FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'privacy.manage'))
  WITH CHECK (public.has_permission(auth.uid(), 'privacy.manage'));

DROP TRIGGER IF EXISTS trg_privacy_notices_updated ON public.privacy_notices;
CREATE TRIGGER trg_privacy_notices_updated BEFORE UPDATE ON public.privacy_notices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.privacy_acknowledgements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id uuid REFERENCES public.visitors(id) ON DELETE CASCADE,
  person_id uuid REFERENCES public.people(id) ON DELETE SET NULL,
  visit_id uuid REFERENCES public.visits(id) ON DELETE SET NULL,
  branch_id uuid REFERENCES public.branches(id),
  notice_version text NOT NULL DEFAULT 'v1',
  method text NOT NULL DEFAULT 'front_desk',
  device text,
  acknowledged_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.privacy_acknowledgements TO authenticated;
GRANT ALL ON public.privacy_acknowledgements TO service_role;
ALTER TABLE public.privacy_acknowledgements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read privacy acknowledgements" ON public.privacy_acknowledgements;
CREATE POLICY "Staff read privacy acknowledgements" ON public.privacy_acknowledgements
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

CREATE OR REPLACE FUNCTION public.record_privacy_ack(
  p_visitor_id uuid, p_branch_id uuid DEFAULT NULL, p_version text DEFAULT 'v1',
  p_method text DEFAULT 'front_desk', p_device text DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_id uuid;
BEGIN
  INSERT INTO public.privacy_acknowledgements (visitor_id, person_id, visit_id, branch_id, notice_version, method, device)
  VALUES (
    p_visitor_id,
    (SELECT id FROM public.people WHERE legacy_visitor_id = p_visitor_id LIMIT 1),
    (SELECT id FROM public.visits WHERE legacy_visitor_id = p_visitor_id LIMIT 1),
    coalesce(p_branch_id, (SELECT branch_id FROM public.visitors WHERE id = p_visitor_id)),
    coalesce(nullif(btrim(p_version), ''), 'v1'),
    coalesce(nullif(btrim(p_method), ''), 'front_desk'),
    p_device
  )
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.record_privacy_ack(uuid, uuid, text, text, text) TO anon, authenticated;

CREATE TABLE IF NOT EXISTS public.retention_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE,
  record_class text NOT NULL,
  retention_value integer,
  retention_unit text NOT NULL DEFAULT 'months',
  mode text NOT NULL DEFAULT 'anonymise',
  is_enabled boolean NOT NULL DEFAULT false,
  exception_reason text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS retention_policies_scope_unique
  ON public.retention_policies (coalesce(branch_id, '00000000-0000-0000-0000-000000000000'::uuid), record_class);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.retention_policies TO authenticated;
GRANT ALL ON public.retention_policies TO service_role;
ALTER TABLE public.retention_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read retention policy" ON public.retention_policies;
CREATE POLICY "Staff read retention policy" ON public.retention_policies
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Privacy managers maintain retention policy" ON public.retention_policies;
CREATE POLICY "Privacy managers maintain retention policy" ON public.retention_policies
  FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'privacy.manage'))
  WITH CHECK (public.has_permission(auth.uid(), 'privacy.manage'));

DROP TRIGGER IF EXISTS trg_retention_policies_updated ON public.retention_policies;
CREATE TRIGGER trg_retention_policies_updated BEFORE UPDATE ON public.retention_policies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Record classes are seeded with no period and disabled: an administrator must decide.
INSERT INTO public.retention_policies (branch_id, record_class, retention_value, is_enabled)
SELECT NULL, c, NULL, false
FROM unnest(ARRAY[
  'person_identity','visit','screening_answers','contractor_credentials',
  'food_register','emergency_event','badge_qr','key_history','audit_log'
]) AS c
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.retention_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_class text NOT NULL,
  branch_id uuid,
  action text NOT NULL,
  outcome text NOT NULL,
  records_affected integer NOT NULL DEFAULT 0,
  skipped_legal_hold integer NOT NULL DEFAULT 0,
  error_detail text,
  performed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.retention_runs TO authenticated;
GRANT ALL ON public.retention_runs TO service_role;
ALTER TABLE public.retention_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read retention history" ON public.retention_runs;
CREATE POLICY "Staff read retention history" ON public.retention_runs
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

-- Applies a retention policy for one record class. Legal holds are never touched.
CREATE OR REPLACE FUNCTION public.run_retention(p_record_class text)
RETURNS TABLE(affected integer, skipped integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pol record; cutoff timestamptz; n int := 0; held int := 0;
BEGIN
  IF NOT public.has_permission(auth.uid(), 'privacy.manage') THEN
    RAISE EXCEPTION 'You do not have permission to run retention';
  END IF;

  SELECT * INTO pol FROM public.retention_policies
   WHERE record_class = p_record_class AND branch_id IS NULL LIMIT 1;

  IF pol IS NULL OR NOT pol.is_enabled OR pol.retention_value IS NULL THEN
    INSERT INTO public.retention_runs (record_class, action, outcome, error_detail, performed_by)
    VALUES (p_record_class, 'skip', 'not_configured', 'No enabled retention period is configured', auth.uid());
    RETURN QUERY SELECT 0, 0;
    RETURN;
  END IF;

  cutoff := now() - (pol.retention_value || ' ' || pol.retention_unit)::interval;

  IF p_record_class = 'visit' THEN
    SELECT count(*) INTO held FROM public.visitors
     WHERE check_in_time < cutoff AND (legal_hold OR coalesce(safeguarding_hold, false));

    IF pol.mode = 'anonymise' THEN
      UPDATE public.visitors
         SET first_name = 'Removed', surname = 'Record', email = '', mobile = '',
             address = NULL, comments = NULL, health_answers = '{}'::jsonb,
             companion_details = '[]'::jsonb, signature_url = NULL
       WHERE check_in_time < cutoff
         AND NOT legal_hold AND NOT coalesce(safeguarding_hold, false)
         AND first_name <> 'Removed';
      GET DIAGNOSTICS n = ROW_COUNT;
    ELSE
      DELETE FROM public.visitors
       WHERE check_in_time < cutoff
         AND NOT legal_hold AND NOT coalesce(safeguarding_hold, false);
      GET DIAGNOSTICS n = ROW_COUNT;
    END IF;
  ELSIF p_record_class = 'food_register' THEN
    DELETE FROM public.food_register WHERE recorded_at < cutoff;
    GET DIAGNOSTICS n = ROW_COUNT;
  ELSE
    INSERT INTO public.retention_runs (record_class, action, outcome, error_detail, performed_by)
    VALUES (p_record_class, pol.mode, 'unsupported', 'No automated handler for this record class yet', auth.uid());
    RETURN QUERY SELECT 0, 0;
    RETURN;
  END IF;

  INSERT INTO public.retention_runs (record_class, action, outcome, records_affected, skipped_legal_hold, performed_by)
  VALUES (p_record_class, pol.mode, 'completed', n, held, auth.uid());

  PERFORM public.log_audit('retention.run',
    jsonb_build_object('record_class', p_record_class, 'mode', pol.mode, 'skipped_legal_hold', held), n, NULL);

  RETURN QUERY SELECT n, held;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.run_retention(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.run_retention(text) TO authenticated;
