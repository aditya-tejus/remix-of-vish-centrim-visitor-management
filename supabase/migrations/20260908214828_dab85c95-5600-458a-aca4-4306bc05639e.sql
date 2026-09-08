
-- 1. Remove anonymous/authenticated access to the unused prefill lookup (name -> contact details)
REVOKE ALL ON FUNCTION public.kiosk_prefill_visitor(text, text) FROM anon, authenticated;

-- 2. Emergency snapshot integrity: closed events are immutable
CREATE OR REPLACE FUNCTION public.guard_closed_emergency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_state text;
BEGIN
  SELECT state INTO v_state FROM public.evacuation_drills
   WHERE id = coalesce(NEW.drill_id, OLD.drill_id);
  IF v_state IN ('resolved','reviewed') THEN
    RAISE EXCEPTION 'This emergency is closed. Its roll call is a point-in-time record and cannot be changed.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_closed_emergency ON public.evacuation_attendance;
CREATE TRIGGER trg_guard_closed_emergency
BEFORE INSERT OR UPDATE ON public.evacuation_attendance
FOR EACH ROW EXECUTE FUNCTION public.guard_closed_emergency();

-- 3. Effective retention policy resolver (site rule first, then all-sites default)
CREATE OR REPLACE FUNCTION public.effective_retention_policy(p_record_class text, p_branch_id uuid DEFAULT NULL)
RETURNS TABLE(
  policy_id uuid, record_class text, scope text, branch_id uuid,
  retention_value integer, retention_unit text, mode text, is_enabled boolean, exception_reason text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.record_class,
         CASE WHEN p.branch_id IS NULL THEN 'all_sites' ELSE 'site' END,
         p.branch_id, p.retention_value, p.retention_unit, p.mode, p.is_enabled, p.exception_reason
  FROM public.retention_policies p
  WHERE p.record_class = p_record_class
    AND (p.branch_id = p_branch_id OR p.branch_id IS NULL)
  ORDER BY (p.branch_id IS NULL)
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.effective_retention_policy(text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.effective_retention_policy(text, uuid) TO authenticated, service_role;

-- 4. Site-scoped, permission-gated, audited retention run
DROP FUNCTION IF EXISTS public.run_retention(text);

CREATE OR REPLACE FUNCTION public.run_retention(p_record_class text, p_branch_id uuid DEFAULT NULL)
RETURNS TABLE(affected integer, skipped integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE pol record; cutoff timestamptz; n int := 0; held int := 0;
BEGIN
  IF NOT public.has_permission(auth.uid(), 'privacy.manage') THEN
    RAISE EXCEPTION 'You do not have permission to run retention';
  END IF;

  IF p_branch_id IS NOT NULL AND NOT public.user_can_access_site(p_branch_id) THEN
    RAISE EXCEPTION 'You do not have access to that site';
  END IF;

  SELECT * INTO pol FROM public.effective_retention_policy(p_record_class, p_branch_id);

  IF pol IS NULL OR NOT pol.is_enabled OR pol.retention_value IS NULL THEN
    INSERT INTO public.retention_runs (record_class, branch_id, action, outcome, error_detail, performed_by)
    VALUES (p_record_class, p_branch_id, 'skip', 'not_configured',
            'No enabled retention period is configured for this scope', auth.uid());
    RETURN QUERY SELECT 0, 0;
    RETURN;
  END IF;

  cutoff := now() - (pol.retention_value || ' ' || pol.retention_unit)::interval;

  IF p_record_class = 'visit' THEN
    SELECT count(*) INTO held FROM public.visitors v
     WHERE v.check_in_time < cutoff
       AND (p_branch_id IS NULL OR v.branch_id = p_branch_id)
       AND (v.legal_hold OR coalesce(v.safeguarding_hold, false));

    IF pol.mode = 'anonymise' THEN
      UPDATE public.visitors v
         SET first_name = 'Removed', surname = 'Record', email = '', mobile = '',
             address = NULL, comments = NULL, health_answers = '{}'::jsonb,
             companion_details = '[]'::jsonb, signature_url = NULL
       WHERE v.check_in_time < cutoff
         AND (p_branch_id IS NULL OR v.branch_id = p_branch_id)
         AND NOT v.legal_hold AND NOT coalesce(v.safeguarding_hold, false)
         AND v.first_name <> 'Removed';
      GET DIAGNOSTICS n = ROW_COUNT;
    ELSE
      DELETE FROM public.visitors v
       WHERE v.check_in_time < cutoff
         AND (p_branch_id IS NULL OR v.branch_id = p_branch_id)
         AND NOT v.legal_hold AND NOT coalesce(v.safeguarding_hold, false);
      GET DIAGNOSTICS n = ROW_COUNT;
    END IF;

  ELSIF p_record_class = 'food_register' THEN
    SELECT count(*) INTO held FROM public.food_register f
     WHERE f.recorded_at < cutoff
       AND (p_branch_id IS NULL OR f.branch_id = p_branch_id)
       AND EXISTS (
         SELECT 1 FROM public.visitors v
          WHERE v.id IN (f.visitor_id, f.resident_visitor_id)
            AND (v.legal_hold OR coalesce(v.safeguarding_hold, false))
       );

    IF pol.mode = 'anonymise' THEN
      UPDATE public.food_register f
         SET brought_by_name = 'Removed', notes = NULL, created_by = NULL
       WHERE f.recorded_at < cutoff
         AND (p_branch_id IS NULL OR f.branch_id = p_branch_id)
         AND f.brought_by_name <> 'Removed'
         AND NOT EXISTS (
           SELECT 1 FROM public.visitors v
            WHERE v.id IN (f.visitor_id, f.resident_visitor_id)
              AND (v.legal_hold OR coalesce(v.safeguarding_hold, false))
         );
      GET DIAGNOSTICS n = ROW_COUNT;
    ELSE
      DELETE FROM public.food_register f
       WHERE f.recorded_at < cutoff
         AND (p_branch_id IS NULL OR f.branch_id = p_branch_id)
         AND NOT EXISTS (
           SELECT 1 FROM public.visitors v
            WHERE v.id IN (f.visitor_id, f.resident_visitor_id)
              AND (v.legal_hold OR coalesce(v.safeguarding_hold, false))
         );
      GET DIAGNOSTICS n = ROW_COUNT;
    END IF;

  ELSE
    INSERT INTO public.retention_runs (record_class, branch_id, action, outcome, error_detail, performed_by)
    VALUES (p_record_class, p_branch_id, pol.mode, 'unsupported',
            'This record class is a manual process; no automated handler exists yet', auth.uid());
    RETURN QUERY SELECT 0, 0;
    RETURN;
  END IF;

  INSERT INTO public.retention_runs (record_class, branch_id, action, outcome, records_affected, skipped_legal_hold, performed_by)
  VALUES (p_record_class, p_branch_id, pol.mode, 'completed', n, held, auth.uid());

  PERFORM public.log_audit('retention.run',
    jsonb_build_object('record_class', p_record_class, 'branch_id', p_branch_id,
                       'policy_scope', pol.scope, 'mode', pol.mode, 'skipped_holds', held), n, NULL);

  RETURN QUERY SELECT n, held;
END;
$$;

REVOKE ALL ON FUNCTION public.run_retention(text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.run_retention(text, uuid) TO authenticated, service_role;
