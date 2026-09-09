CREATE OR REPLACE FUNCTION public.clear_demo_data(p_run_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_branch uuid;
  v_site text;
  v_status text;
  v_counts jsonb := '{}'::jsonb;
  n int; total int := 0;
BEGIN
  IF p_run_id IS NULL THEN
    RAISE EXCEPTION 'A demo run must be named';
  END IF;
  IF NOT public.has_permission(auth.uid(), 'settings.administer') THEN
    RAISE EXCEPTION 'Only administrators can remove demo data';
  END IF;

  SELECT branch_id, status INTO v_branch, v_status FROM public.demo_seed_runs WHERE id = p_run_id;
  IF v_branch IS NULL THEN
    RAISE EXCEPTION 'That demo run does not exist';
  END IF;
  IF NOT public.user_can_access_site(v_branch) THEN
    RAISE EXCEPTION 'You do not have access to this site';
  END IF;
  IF v_status <> 'active' THEN
    RAISE EXCEPTION 'That demo data has already been removed';
  END IF;
  SELECT name INTO v_site FROM public.branches WHERE id = v_branch;

  DELETE FROM public.feedback_responses WHERE demo_seed_run_id = p_run_id;
  GET DIAGNOSTICS n = ROW_COUNT; total := total + n; v_counts := v_counts || jsonb_build_object('feedback_responses', n);

  DELETE FROM public.feedback_questions WHERE demo_seed_run_id = p_run_id;
  GET DIAGNOSTICS n = ROW_COUNT; total := total + n; v_counts := v_counts || jsonb_build_object('feedback_questions', n);

  DELETE FROM public.feedback_surveys WHERE demo_seed_run_id = p_run_id;
  GET DIAGNOSTICS n = ROW_COUNT; total := total + n; v_counts := v_counts || jsonb_build_object('feedback_surveys', n);

  DELETE FROM public.key_issues WHERE demo_seed_run_id = p_run_id;
  GET DIAGNOSTICS n = ROW_COUNT; total := total + n; v_counts := v_counts || jsonb_build_object('key_issues', n);

  DELETE FROM public.property_keys WHERE demo_seed_run_id = p_run_id;
  GET DIAGNOSTICS n = ROW_COUNT; total := total + n; v_counts := v_counts || jsonb_build_object('keys', n);

  DELETE FROM public.food_register WHERE demo_seed_run_id = p_run_id;
  GET DIAGNOSTICS n = ROW_COUNT; total := total + n; v_counts := v_counts || jsonb_build_object('food_register', n);

  DELETE FROM public.contractor_document_reviews
   WHERE document_id IN (SELECT id FROM public.contractor_documents WHERE demo_seed_run_id = p_run_id);

  DELETE FROM public.contractor_documents WHERE demo_seed_run_id = p_run_id;
  GET DIAGNOSTICS n = ROW_COUNT; total := total + n; v_counts := v_counts || jsonb_build_object('contractor_documents', n);

  DELETE FROM public.visit_parties WHERE demo_seed_run_id = p_run_id;
  GET DIAGNOSTICS n = ROW_COUNT; total := total + n; v_counts := v_counts || jsonb_build_object('attendance_rows', n);

  DELETE FROM public.visits WHERE demo_seed_run_id = p_run_id;
  GET DIAGNOSTICS n = ROW_COUNT; total := total + n; v_counts := v_counts || jsonb_build_object('visits', n);

  DELETE FROM public.resident_details WHERE demo_seed_run_id = p_run_id;
  GET DIAGNOSTICS n = ROW_COUNT; total := total + n; v_counts := v_counts || jsonb_build_object('residents', n);

  -- Person records the system links to each demo arrival.
  DELETE FROM public.people
   WHERE legacy_visitor_id IN (SELECT id FROM public.visitors WHERE demo_seed_run_id = p_run_id);
  GET DIAGNOSTICS n = ROW_COUNT; total := total + n; v_counts := v_counts || jsonb_build_object('person_records', n);

  DELETE FROM public.visitors WHERE demo_seed_run_id = p_run_id;
  GET DIAGNOSTICS n = ROW_COUNT; total := total + n; v_counts := v_counts || jsonb_build_object('visitors', n);

  DELETE FROM public.contractor_people WHERE demo_seed_run_id = p_run_id;
  GET DIAGNOSTICS n = ROW_COUNT; total := total + n; v_counts := v_counts || jsonb_build_object('contractor_people', n);

  DELETE FROM public.suppliers_min WHERE demo_seed_run_id = p_run_id;
  GET DIAGNOSTICS n = ROW_COUNT; total := total + n; v_counts := v_counts || jsonb_build_object('suppliers', n);

  DELETE FROM public.wings WHERE demo_seed_run_id = p_run_id;
  GET DIAGNOSTICS n = ROW_COUNT; total := total + n; v_counts := v_counts || jsonb_build_object('wings', n);

  UPDATE public.demo_seed_runs
     SET status = 'removed', removed_at = now(), counts = counts || jsonb_build_object('removed', v_counts)
   WHERE id = p_run_id;

  PERFORM public.log_audit(
    'demo_data_removed',
    jsonb_build_object('run_id', p_run_id, 'site', v_site, 'branch_id', v_branch, 'counts', v_counts),
    total,
    'Administrator removed demo data'
  );

  RETURN jsonb_build_object('run_id', p_run_id, 'branch_id', v_branch, 'site', v_site, 'counts', v_counts, 'total', total);
END;
$$;