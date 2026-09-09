CREATE OR REPLACE FUNCTION public.check_out_party(p_party_ids uuid[], p_time timestamp with time zone DEFAULT now(), p_reason text DEFAULT NULL::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count int := 0;
  v_visit uuid;
  v_legacy uuid;
  v_open int;
  v_json jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_permission(auth.uid(), 'checkout.perform') THEN
    RAISE EXCEPTION 'You do not have permission to check people out';
  END IF;

  UPDATE public.visit_parties p
     SET check_out_time = coalesce(p_time, now()), status = 'checked-out', updated_at = now()
    FROM public.visits v
   WHERE p.id = ANY(p_party_ids) AND v.id = p.visit_id
     AND p.check_out_time IS NULL
     AND public.user_can_access_site(v.branch_id);
  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Mirror into the legacy record for compatibility only; canonical state wins.
  FOR v_visit IN SELECT DISTINCT visit_id FROM public.visit_parties WHERE id = ANY(p_party_ids) LOOP
    SELECT legacy_visitor_id INTO v_legacy FROM public.visits WHERE id = v_visit;
    IF v_legacy IS NULL THEN CONTINUE; END IF;

    SELECT count(*) INTO v_open FROM public.visit_parties
     WHERE visit_id = v_visit AND check_out_time IS NULL;

    -- Rebuild the compatibility companion list from canonical party state so
    -- older screens show the same individual departure times.
    SELECT jsonb_agg(
             CASE
               WHEN p.check_out_time IS NULL
                 THEN coalesce(elem, '{}'::jsonb) - 'checkedOutAt'
               ELSE coalesce(elem, '{}'::jsonb)
                    || jsonb_build_object('checkedOutAt', to_char(p.check_out_time AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
             END
             ORDER BY p.companion_index)
      INTO v_json
      FROM public.visit_parties p
      LEFT JOIN LATERAL (
        SELECT (v.companion_details -> (p.companion_index - 1)) AS elem
          FROM public.visitors v WHERE v.id = v_legacy
      ) src ON true
     WHERE p.visit_id = v_visit AND p.is_primary = false;

    PERFORM set_config('centrim.attendance_sync', 'on', true);
    UPDATE public.visitors
       SET status = CASE WHEN v_open > 0 THEN status ELSE 'checked-out' END,
           check_out_time = CASE WHEN v_open > 0 THEN check_out_time ELSE coalesce(p_time, now()) END,
           checkout_reason = coalesce(p_reason, checkout_reason),
           additional_visitors = greatest(v_open - 1, 0),
           companion_details = CASE
             WHEN jsonb_typeof(companion_details) = 'array' AND jsonb_array_length(companion_details) > 0
               THEN coalesce(v_json, companion_details)
             ELSE companion_details END
     WHERE id = v_legacy;
    PERFORM set_config('centrim.attendance_sync', 'off', true);
  END LOOP;

  RETURN v_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.check_out_party(uuid[], timestamptz, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_out_party(uuid[], timestamptz, text) TO authenticated;