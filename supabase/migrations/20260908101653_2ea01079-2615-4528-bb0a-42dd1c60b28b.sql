
-- 1. Explicit visit states
INSERT INTO public.visit_statuses (key, label, is_open) VALUES
  ('draft', 'Draft', true),
  ('auto-checked-out', 'Auto checked out', false),
  ('cancelled', 'Cancelled', false),
  ('incomplete', 'Incomplete', false)
ON CONFLICT (key) DO NOTHING;

-- 2. Purpose-specific kiosk check-in function (kiosk may no longer touch the table)
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
    coalesce(p_payload->'companion_details', '[]'::jsonb),
    coalesce(p_payload->>'comments', ''),
    nullif(p_payload->>'body_temperature', '')::numeric,
    coalesce((p_payload->>'privacy_acknowledged')::boolean, false),
    coalesce(p_payload->'health_answers', '{}'::jsonb),
    coalesce(p_payload->'contractor_screening', '{}'::jsonb),
    nullif(p_payload->>'supplier_id', '')::uuid,
    nullif(p_payload->>'contractor_person_id', '')::uuid,
    v_qr,
    v_person_qr,
    nullif(p_payload->>'group_id', '')::uuid,
    CASE WHEN p_payload ? 'visited_resident_ids'
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

REVOKE ALL ON FUNCTION public.kiosk_check_in(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kiosk_check_in(jsonb) TO anon, authenticated;

-- 3. Kiosk no longer touches the visitors table directly
DROP POLICY IF EXISTS "Kiosk can create self check-ins" ON public.visitors;
DROP POLICY IF EXISTS "Kiosk can read today's on-site visitors" ON public.visitors;
DROP POLICY IF EXISTS "Kiosk can update today's on-site visitors" ON public.visitors;

-- 4. Mirror legacy visitor rows into people / visits / visit_parties
CREATE OR REPLACE FUNCTION public.sync_visit_from_visitor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_person_id uuid;
  v_visit_id uuid;
  v_branch uuid;
  v_status text;
  v_companion jsonb;
  v_idx int := 0;
BEGIN
  IF NEW.type = 'resident' THEN
    RETURN NEW;
  END IF;

  v_branch := coalesce(NEW.branch_id, public.default_site_id());
  IF v_branch IS NULL THEN
    RETURN NEW;
  END IF;

  v_status := CASE WHEN NEW.status IN ('checked-in','checked-out','expected','draft','cancelled','incomplete','auto-checked-out')
                   THEN NEW.status ELSE 'checked-in' END;

  -- Person identity (reused across visits via the stable personal QR)
  SELECT id INTO v_person_id FROM public.people
   WHERE legacy_visitor_id = NEW.id
      OR (NEW.person_qr IS NOT NULL AND person_qr = NEW.person_qr)
   LIMIT 1;

  IF v_person_id IS NULL THEN
    INSERT INTO public.people (first_name, surname, email, mobile, person_qr,
                               default_person_type, branch_id, legacy_visitor_id, external_source)
    VALUES (NEW.first_name, NEW.surname, nullif(NEW.email, ''), nullif(NEW.mobile, ''),
            NEW.person_qr, NEW.type, v_branch, NEW.id, 'visitor_management')
    RETURNING id INTO v_person_id;
  END IF;

  SELECT id INTO v_visit_id FROM public.visits WHERE legacy_visitor_id = NEW.id LIMIT 1;

  IF v_visit_id IS NULL THEN
    INSERT INTO public.visits (branch_id, person_id, person_type, status, check_in_time,
                               check_out_time, destination_label, group_id, source, legacy_visitor_id)
    VALUES (v_branch, v_person_id, NEW.type, v_status, NEW.check_in_time, NEW.check_out_time,
            nullif(NEW.whom_to_visit, ''), NEW.group_id, 'visitor_management', NEW.id)
    RETURNING id INTO v_visit_id;
  ELSE
    UPDATE public.visits
       SET status = v_status,
           check_in_time = NEW.check_in_time,
           check_out_time = NEW.check_out_time,
           destination_label = nullif(NEW.whom_to_visit, ''),
           group_id = NEW.group_id,
           updated_at = now()
     WHERE id = v_visit_id;
  END IF;

  -- Primary party
  INSERT INTO public.visit_parties (visit_id, person_id, display_name, is_primary, check_in_time, check_out_time)
  SELECT v_visit_id, v_person_id, trim(NEW.first_name || ' ' || NEW.surname), true, NEW.check_in_time, NEW.check_out_time
  WHERE NOT EXISTS (SELECT 1 FROM public.visit_parties WHERE visit_id = v_visit_id AND is_primary);

  UPDATE public.visit_parties
     SET check_out_time = NEW.check_out_time, updated_at = now()
   WHERE visit_id = v_visit_id AND is_primary;

  -- Companions keep their own identity and departure time
  IF jsonb_typeof(NEW.companion_details) = 'array' THEN
    FOR v_companion IN SELECT * FROM jsonb_array_elements(NEW.companion_details) LOOP
      IF coalesce(trim(v_companion->>'name'), '') <> '' THEN
        IF EXISTS (SELECT 1 FROM public.visit_parties
                    WHERE visit_id = v_visit_id AND is_primary = false
                      AND display_name = trim(v_companion->>'name')) THEN
          UPDATE public.visit_parties
             SET check_out_time = coalesce(nullif(v_companion->>'checkedOutAt','')::timestamptz, NEW.check_out_time),
                 relationship = nullif(v_companion->>'relation',''),
                 updated_at = now()
           WHERE visit_id = v_visit_id AND is_primary = false
             AND display_name = trim(v_companion->>'name');
        ELSE
          INSERT INTO public.visit_parties (visit_id, display_name, relationship, is_primary, check_in_time, check_out_time)
          VALUES (v_visit_id, trim(v_companion->>'name'), nullif(v_companion->>'relation',''), false,
                  NEW.check_in_time,
                  coalesce(nullif(v_companion->>'checkedOutAt','')::timestamptz, NEW.check_out_time));
        END IF;
      END IF;
      v_idx := v_idx + 1;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_visit_from_visitor_trg ON public.visitors;
CREATE TRIGGER sync_visit_from_visitor_trg
AFTER INSERT OR UPDATE OF status, check_out_time, check_in_time, companion_details, whom_to_visit
ON public.visitors
FOR EACH ROW EXECUTE FUNCTION public.sync_visit_from_visitor();

INSERT INTO public.audit_log (action, performed_by, records_affected, change_reason, details)
VALUES ('schema_migration', 'System', 0, 'Stage 3 core visit workflow: kiosk check-in RPC, kiosk table access removed, visit state mirroring',
        jsonb_build_object('stage', 3));
