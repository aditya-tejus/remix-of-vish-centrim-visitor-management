CREATE OR REPLACE FUNCTION public.attendance_sync_guard_on()
RETURNS boolean LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT coalesce(current_setting('centrim.attendance_sync', true), '') = 'on';
$$;

CREATE OR REPLACE FUNCTION public.reconcile_visit_parties(p_branch_id uuid DEFAULT NULL, p_dry_run boolean DEFAULT true)
RETURNS TABLE(visits_created int, parties_created int, placeholders_created int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_bv int; v_bp int; v_bu int;
  v_visits int := 0; v_parties int := 0; v_placeholders int := 0;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only administrators can reconcile attendance records';
  END IF;

  SELECT count(*) INTO v_bv FROM public.visits;
  SELECT count(*) INTO v_bp FROM public.visit_parties;
  SELECT count(*) INTO v_bu FROM public.visit_parties WHERE name_status = 'unresolved';

  BEGIN
    -- Touching the legacy row re-fires the single canonical writer, so repeat
    -- runs converge and nothing is deleted, merged or rewritten.
    UPDATE public.visitors v
       SET status = v.status
     WHERE v.type <> 'resident'
       AND (p_branch_id IS NULL OR v.branch_id = p_branch_id);

    SELECT count(*) - v_bv INTO v_visits FROM public.visits;
    SELECT count(*) - v_bp INTO v_parties FROM public.visit_parties;
    SELECT count(*) - v_bu INTO v_placeholders FROM public.visit_parties WHERE name_status = 'unresolved';

    IF p_dry_run THEN
      RAISE EXCEPTION 'attendance_dry_run' USING ERRCODE = 'triggered_action_exception';
    END IF;
  EXCEPTION WHEN triggered_action_exception THEN
    -- Preview only: everything written inside this block is rolled back.
    RETURN QUERY SELECT v_visits, v_parties, v_placeholders;
    RETURN;
  END;

  PERFORM public.log_audit('attendance.reconcile',
    jsonb_build_object('branch_id', p_branch_id, 'visits_created', v_visits,
                       'parties_created', v_parties, 'placeholders', v_placeholders),
    v_parties, NULL);

  RETURN QUERY SELECT v_visits, v_parties, v_placeholders;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.check_in_party(jsonb) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.check_out_party(uuid[], timestamptz, text) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.visit_integrity_report(uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.reconcile_visit_parties(uuid, boolean) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.attendance_sync_guard_on() FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.derive_visit_from_parties() FROM public, anon;

GRANT EXECUTE ON FUNCTION public.check_in_party(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_out_party(uuid[], timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.visit_integrity_report(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_visit_parties(uuid, boolean) TO authenticated;