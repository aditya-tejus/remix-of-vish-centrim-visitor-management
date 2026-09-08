CREATE OR REPLACE FUNCTION public.run_retention(p_record_class text)
RETURNS TABLE(affected integer, skipped integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
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
    SELECT count(*) INTO held FROM public.food_register f
     WHERE f.recorded_at < cutoff
       AND EXISTS (
         SELECT 1 FROM public.visitors v
          WHERE v.id IN (f.visitor_id, f.resident_visitor_id)
            AND (v.legal_hold OR coalesce(v.safeguarding_hold, false))
       );

    IF pol.mode = 'anonymise' THEN
      UPDATE public.food_register f
         SET brought_by_name = 'Removed', notes = NULL, created_by = NULL
       WHERE f.recorded_at < cutoff
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
         AND NOT EXISTS (
           SELECT 1 FROM public.visitors v
            WHERE v.id IN (f.visitor_id, f.resident_visitor_id)
              AND (v.legal_hold OR coalesce(v.safeguarding_hold, false))
         );
      GET DIAGNOSTICS n = ROW_COUNT;
    END IF;
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
$function$;