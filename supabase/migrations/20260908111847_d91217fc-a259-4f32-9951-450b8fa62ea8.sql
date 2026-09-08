CREATE OR REPLACE FUNCTION public.kiosk_check_in(p_payload jsonb)
RETURNS TABLE(visitor_id uuid, qr_code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_qr text;
  v_person_qr text;
  v_type text;
  v_branch uuid;
BEGIN
  v_type := lower(coalesce(p_payload->>'type', 'visitor'));
  IF v_type NOT IN ('visitor', 'contractor', 'volunteer', 'staff') THEN
    RAISE EXCEPTION 'Unsupported check-in type';
  END IF;
  IF coalesce(trim(p_payload->>'first_name'), '') = ''
     OR coalesce(trim(p_payload->>'surname'), '') = '' THEN
    RAISE EXCEPTION 'First name and surname are required';
  END IF;

  v_branch := nullif(p_payload->>'branch_id', '')::uuid;
  IF v_branch IS NULL THEN
    v_branch := public.default_site_id();
  END IF;

  v_qr := nullif(p_payload->>'qr_code', '');
  v_person_qr := nullif(p_payload->>'person_qr', '');
  IF v_person_qr IS NULL THEN
    v_person_qr := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
  END IF;

  INSERT INTO public.visitors (
    first_name, surname, email, mobile, type, check_in_time, whom_to_visit, address,
    status, health_declaration, additional_visitors, companion_details, comments,
    body_temperature, privacy_acknowledged, health_answers, contractor_screening,
    supplier_id, contractor_person_id, qr_code, person_qr, group_id,
    visited_resident_ids, visit_purpose, work_type, work_location, branch_id
  ) VALUES (
    trim(p_payload->>'first_name'),
    trim(p_payload->>'surname'),
    coalesce(p_payload->>'email', ''),
    coalesce(p_payload->>'mobile', ''),
    v_type,
    coalesce(nullif(p_payload->>'check_in_time', '')::timestamptz, now()),
    coalesce(p_payload->>'whom_to_visit', ''),
    coalesce(p_payload->>'address', ''),
    'checked-in',
    coalesce((p_payload->>'health_declaration')::boolean, false),
    coalesce((p_payload->>'additional_visitors')::int, 0),
    CASE WHEN jsonb_typeof(p_payload->'companion_details') = 'array'
      THEN p_payload->'companion_details' ELSE '[]'::jsonb END,
    coalesce(p_payload->>'comments', ''),
    nullif(p_payload->>'body_temperature', '')::numeric,
    coalesce((p_payload->>'privacy_acknowledged')::boolean, false),
    CASE WHEN jsonb_typeof(p_payload->'health_answers') = 'object'
      THEN p_payload->'health_answers' ELSE '{}'::jsonb END,
    CASE WHEN jsonb_typeof(p_payload->'contractor_screening') = 'object'
      THEN p_payload->'contractor_screening' ELSE '{}'::jsonb END,
    nullif(p_payload->>'supplier_id', '')::uuid,
    nullif(p_payload->>'contractor_person_id', '')::uuid,
    v_qr,
    v_person_qr,
    nullif(p_payload->>'group_id', '')::uuid,
    CASE WHEN jsonb_typeof(p_payload->'visited_resident_ids') = 'array'
      THEN ARRAY(SELECT jsonb_array_elements_text(p_payload->'visited_resident_ids'))::uuid[]
      ELSE NULL END,
    nullif(p_payload->>'visit_purpose', ''),
    nullif(p_payload->>'work_type', ''),
    nullif(p_payload->>'work_location', ''),
    v_branch
  )
  RETURNING id, visitors.qr_code INTO v_id, v_qr;

  RETURN QUERY SELECT v_id, v_qr;
END;
$$;