-- 1. Additive columns -------------------------------------------------------
ALTER TABLE public.visitors ADD COLUMN IF NOT EXISTS client_request_id uuid;
ALTER TABLE public.visits   ADD COLUMN IF NOT EXISTS client_request_id uuid;

ALTER TABLE public.visit_parties
  ADD COLUMN IF NOT EXISTS companion_index int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'checked-in',
  ADD COLUMN IF NOT EXISTS name_status text NOT NULL DEFAULT 'named';

CREATE UNIQUE INDEX IF NOT EXISTS visitors_client_request_id_uidx
  ON public.visitors (client_request_id) WHERE client_request_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS visits_client_request_id_uidx
  ON public.visits (client_request_id) WHERE client_request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS visit_parties_visit_idx ON public.visit_parties (visit_id);
CREATE INDEX IF NOT EXISTS visits_legacy_visitor_idx ON public.visits (legacy_visitor_id);

-- Existing parties get a stable ordinal (primary = 0) without altering attendance.
WITH ordered AS (
  SELECT id, visit_id, is_primary,
         row_number() OVER (PARTITION BY visit_id, is_primary ORDER BY created_at, id) AS rn
    FROM public.visit_parties
)
UPDATE public.visit_parties p
   SET companion_index = CASE WHEN o.is_primary THEN 0 ELSE o.rn END
  FROM ordered o
 WHERE o.id = p.id AND p.companion_index = 0 AND NOT p.is_primary;

UPDATE public.visit_parties
   SET status = CASE WHEN check_out_time IS NULL THEN 'checked-in' ELSE 'checked-out' END
 WHERE status = 'checked-in' AND check_out_time IS NOT NULL;

-- 2. Recursion guard helpers -------------------------------------------------
CREATE OR REPLACE FUNCTION public.attendance_sync_guard_on()
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT coalesce(current_setting('centrim.attendance_sync', true), '') = 'on';
$$;

-- 3. Canonical sync trigger (single authoritative writer) --------------------
CREATE OR REPLACE FUNCTION public.sync_visit_from_visitor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_person_id uuid;
  v_visit_id uuid;
  v_branch uuid;
  v_status text;
  v_companion jsonb;
  v_idx int;
  v_named int := 0;
  v_headcount int;
  v_party_id uuid;
  v_comp_person uuid;
  v_open_others int;
BEGIN
  IF NEW.type = 'resident' THEN
    RETURN NEW;
  END IF;

  -- Never re-enter while the canonical path is mirroring back to the legacy row.
  IF public.attendance_sync_guard_on() THEN
    RETURN NEW;
  END IF;

  v_branch := coalesce(NEW.branch_id, public.default_site_id());
  IF v_branch IS NULL THEN
    RETURN NEW;
  END IF;

  v_status := CASE WHEN NEW.status IN ('checked-in','checked-out','expected','draft','cancelled','incomplete','auto-checked-out')
                   THEN NEW.status ELSE 'checked-in' END;

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
                               check_out_time, destination_label, group_id, source,
                               legacy_visitor_id, client_request_id)
    VALUES (v_branch, v_person_id, NEW.type, v_status, NEW.check_in_time, NEW.check_out_time,
            nullif(NEW.whom_to_visit, ''), NEW.group_id, 'visitor_management',
            NEW.id, NEW.client_request_id)
    RETURNING id INTO v_visit_id;
  ELSE
    -- Identity/destination only. Attendance state is derived from the parties.
    UPDATE public.visits
       SET check_in_time = NEW.check_in_time,
           destination_label = nullif(NEW.whom_to_visit, ''),
           group_id = NEW.group_id,
           client_request_id = coalesce(client_request_id, NEW.client_request_id),
           updated_at = now()
     WHERE id = v_visit_id;
  END IF;

  -- Primary party
  INSERT INTO public.visit_parties (visit_id, person_id, display_name, is_primary,
                                    companion_index, check_in_time, check_out_time, status, name_status)
  SELECT v_visit_id, v_person_id, btrim(NEW.first_name || ' ' || NEW.surname), true, 0,
         NEW.check_in_time, NEW.check_out_time,
         CASE WHEN NEW.check_out_time IS NULL THEN 'checked-in' ELSE 'checked-out' END, 'named'
  WHERE NOT EXISTS (SELECT 1 FROM public.visit_parties WHERE visit_id = v_visit_id AND is_primary);

  -- The legacy row may only close the primary; it can never reopen or overwrite it.
  IF NEW.check_out_time IS NOT NULL THEN
    UPDATE public.visit_parties
       SET check_out_time = NEW.check_out_time, status = 'checked-out', updated_at = now()
     WHERE visit_id = v_visit_id AND is_primary AND check_out_time IS NULL;
  END IF;

  -- Companions, matched by ordinal position, never by name.
  IF jsonb_typeof(NEW.companion_details) = 'array' THEN
    FOR v_companion, v_idx IN
      SELECT value, ordinality::int FROM jsonb_array_elements(NEW.companion_details) WITH ORDINALITY
    LOOP
      v_named := v_named + 1;
      v_comp_person := nullif(v_companion->>'person_id', '')::uuid;

      -- A supplied identity must belong to this site.
      IF v_comp_person IS NOT NULL THEN
        PERFORM 1 FROM public.people p
          WHERE p.id = v_comp_person AND (p.branch_id IS NULL OR p.branch_id = v_branch);
        IF NOT FOUND THEN
          RAISE EXCEPTION 'That companion belongs to a different site and cannot be linked here.';
        END IF;
      ELSIF coalesce(v_companion->>'create_person', 'false') = 'true'
            AND coalesce(btrim(v_companion->>'name'), '') <> '' THEN
        INSERT INTO public.people (first_name, surname, email, mobile, default_person_type,
                                   branch_id, external_source)
        VALUES (split_part(btrim(v_companion->>'name'), ' ', 1),
                nullif(btrim(substr(btrim(v_companion->>'name'),
                       length(split_part(btrim(v_companion->>'name'), ' ', 1)) + 1)), ''),
                nullif(v_companion->>'email', ''), nullif(v_companion->>'phone', ''),
                NEW.type, v_branch, 'visitor_management')
        RETURNING id INTO v_comp_person;
      END IF;

      SELECT id INTO v_party_id FROM public.visit_parties
       WHERE visit_id = v_visit_id AND companion_index = v_idx AND is_primary = false;

      IF v_party_id IS NULL THEN
        INSERT INTO public.visit_parties (visit_id, person_id, display_name, relationship,
                                          is_primary, companion_index, check_in_time,
                                          check_out_time, status, name_status)
        VALUES (v_visit_id, v_comp_person,
                coalesce(nullif(btrim(v_companion->>'name'), ''), 'Companion ' || (v_idx + 1)),
                nullif(v_companion->>'relation',''), false, v_idx, NEW.check_in_time,
                nullif(v_companion->>'checkedOutAt','')::timestamptz,
                CASE WHEN nullif(v_companion->>'checkedOutAt','') IS NULL THEN 'checked-in' ELSE 'checked-out' END,
                CASE WHEN coalesce(btrim(v_companion->>'name'), '') = '' THEN 'unresolved' ELSE 'named' END);
      ELSE
        UPDATE public.visit_parties
           SET person_id = coalesce(person_id, v_comp_person),
               relationship = coalesce(nullif(v_companion->>'relation',''), relationship),
               check_out_time = coalesce(check_out_time, nullif(v_companion->>'checkedOutAt','')::timestamptz),
               status = CASE WHEN coalesce(check_out_time, nullif(v_companion->>'checkedOutAt','')::timestamptz) IS NULL
                             THEN 'checked-in' ELSE 'checked-out' END,
               updated_at = now()
         WHERE id = v_party_id;
      END IF;
    END LOOP;
  END IF;

  -- Headcount top-up: people counted on arrival but never named stay accountable.
  v_headcount := coalesce(NEW.additional_visitors, 0);
  IF v_headcount > v_named THEN
    FOR v_idx IN (v_named + 1)..v_headcount LOOP
      INSERT INTO public.visit_parties (visit_id, display_name, is_primary, companion_index,
                                        check_in_time, status, name_status)
      SELECT v_visit_id, 'Companion ' || (v_idx + 1), false, v_idx, NEW.check_in_time,
             'checked-in', 'unresolved'
      WHERE NOT EXISTS (SELECT 1 FROM public.visit_parties
                         WHERE visit_id = v_visit_id AND companion_index = v_idx AND is_primary = false);
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;

-- 4. Parent visit state derived from its parties -----------------------------
CREATE OR REPLACE FUNCTION public.derive_visit_from_parties()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_visit uuid := coalesce(NEW.visit_id, OLD.visit_id);
  v_open int;
  v_last timestamptz;
BEGIN
  SELECT count(*) FILTER (WHERE check_out_time IS NULL), max(check_out_time)
    INTO v_open, v_last
    FROM public.visit_parties WHERE visit_id = v_visit;

  UPDATE public.visits
     SET status = CASE WHEN v_open > 0 THEN 'checked-in' ELSE 'checked-out' END,
         check_out_time = CASE WHEN v_open > 0 THEN NULL ELSE v_last END,
         updated_at = now()
   WHERE id = v_visit;

  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_derive_visit_from_parties ON public.visit_parties;
CREATE TRIGGER trg_derive_visit_from_parties
AFTER INSERT OR UPDATE OF check_out_time ON public.visit_parties
FOR EACH ROW EXECUTE FUNCTION public.derive_visit_from_parties();

-- 5. Idempotent staff check-in ----------------------------------------------
CREATE OR REPLACE FUNCTION public.check_in_party(p_payload jsonb)
RETURNS TABLE(visitor_id uuid, visit_id uuid, party_count int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_req uuid := nullif(p_payload->>'client_request_id', '')::uuid;
  v_branch uuid := nullif(p_payload->>'branch_id', '')::uuid;
  v_id uuid;
  v_visit uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_permission(auth.uid(), 'checkin.create') THEN
    RAISE EXCEPTION 'You do not have permission to check people in';
  END IF;

  v_branch := coalesce(v_branch, public.default_site_id());
  IF NOT public.user_can_access_site(v_branch) THEN
    RAISE EXCEPTION 'You do not have access to that site';
  END IF;

  -- Retry safety: the same request never creates a second arrival.
  IF v_req IS NOT NULL THEN
    SELECT id INTO v_id FROM public.visitors WHERE client_request_id = v_req LIMIT 1;
    IF v_id IS NOT NULL THEN
      SELECT id INTO v_visit FROM public.visits WHERE legacy_visitor_id = v_id LIMIT 1;
      RETURN QUERY SELECT v_id, v_visit,
        (SELECT count(*)::int FROM public.visit_parties WHERE visit_parties.visit_id = v_visit);
      RETURN;
    END IF;
  END IF;

  INSERT INTO public.visitors (
    first_name, surname, email, mobile, type, check_in_time, whom_to_visit, address,
    status, health_declaration, additional_visitors, companion_details, comments,
    body_temperature, privacy_acknowledged, health_answers, contractor_screening,
    supplier_id, contractor_person_id, qr_code, person_qr, group_id, group_label,
    group_organiser_name, group_organiser_contact, terms_confirmed_by, terms_confirmation_mode,
    volunteer_role, volunteer_supervisor, volunteer_expected_end, visit_reason_other,
    visited_resident_ids, visit_purpose, work_type, work_location, branch_id, client_request_id
  ) VALUES (
    btrim(p_payload->>'first_name'), btrim(p_payload->>'surname'),
    coalesce(p_payload->>'email', ''), coalesce(p_payload->>'mobile', ''),
    coalesce(nullif(p_payload->>'type', ''), 'visitor'),
    coalesce(nullif(p_payload->>'check_in_time', '')::timestamptz, now()),
    coalesce(p_payload->>'whom_to_visit', ''), coalesce(p_payload->>'address', ''),
    coalesce(nullif(p_payload->>'status', ''), 'checked-in'),
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
    nullif(p_payload->>'qr_code', ''), nullif(p_payload->>'person_qr', ''),
    nullif(p_payload->>'group_id', '')::uuid, nullif(p_payload->>'group_label', ''),
    nullif(p_payload->>'group_organiser_name', ''), nullif(p_payload->>'group_organiser_contact', ''),
    nullif(p_payload->>'terms_confirmed_by', ''), nullif(p_payload->>'terms_confirmation_mode', ''),
    nullif(p_payload->>'volunteer_role', ''), nullif(p_payload->>'volunteer_supervisor', ''),
    nullif(p_payload->>'volunteer_expected_end', '')::timestamptz,
    nullif(p_payload->>'visit_reason_other', ''),
    CASE WHEN jsonb_typeof(p_payload->'visited_resident_ids') = 'array'
         THEN ARRAY(SELECT jsonb_array_elements_text(p_payload->'visited_resident_ids'))::uuid[]
         ELSE NULL END,
    nullif(p_payload->>'visit_purpose', ''), nullif(p_payload->>'work_type', ''),
    nullif(p_payload->>'work_location', ''), v_branch, v_req
  ) RETURNING id INTO v_id;

  SELECT id INTO v_visit FROM public.visits WHERE legacy_visitor_id = v_id LIMIT 1;

  RETURN QUERY SELECT v_id, v_visit,
    (SELECT count(*)::int FROM public.visit_parties WHERE visit_parties.visit_id = v_visit);
END;
$function$;

-- 6. Party-level checkout ----------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_out_party(p_party_ids uuid[], p_time timestamptz DEFAULT now(), p_reason text DEFAULT NULL)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count int := 0;
  v_visit uuid;
  v_legacy uuid;
  v_open int;
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

    PERFORM set_config('centrim.attendance_sync', 'on', true);
    UPDATE public.visitors
       SET status = CASE WHEN v_open > 0 THEN status ELSE 'checked-out' END,
           check_out_time = CASE WHEN v_open > 0 THEN check_out_time ELSE coalesce(p_time, now()) END,
           checkout_reason = coalesce(p_reason, checkout_reason),
           additional_visitors = greatest(v_open - 1, 0)
     WHERE id = v_legacy;
    PERFORM set_config('centrim.attendance_sync', 'off', true);
  END LOOP;

  RETURN v_count;
END;
$function$;

-- 7. Integrity report (read-only) -------------------------------------------
CREATE OR REPLACE FUNCTION public.visit_integrity_report(p_branch_id uuid DEFAULT NULL)
RETURNS TABLE(issue text, records int, sample_ids uuid[])
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only administrators can run the attendance integrity report';
  END IF;

  RETURN QUERY
  SELECT 'visitors_without_visit', count(*)::int, (array_agg(v.id))[1:5]
    FROM public.visitors v
   WHERE v.type <> 'resident'
     AND (p_branch_id IS NULL OR v.branch_id = p_branch_id)
     AND NOT EXISTS (SELECT 1 FROM public.visits s WHERE s.legacy_visitor_id = v.id);

  RETURN QUERY
  SELECT 'visits_without_parties', count(*)::int, (array_agg(s.id))[1:5]
    FROM public.visits s
   WHERE (p_branch_id IS NULL OR s.branch_id = p_branch_id)
     AND NOT EXISTS (SELECT 1 FROM public.visit_parties p WHERE p.visit_id = s.id);

  RETURN QUERY
  SELECT 'visits_without_primary', count(*)::int, (array_agg(s.id))[1:5]
    FROM public.visits s
   WHERE (p_branch_id IS NULL OR s.branch_id = p_branch_id)
     AND NOT EXISTS (SELECT 1 FROM public.visit_parties p WHERE p.visit_id = s.id AND p.is_primary);

  RETURN QUERY
  SELECT 'duplicate_party_index', count(*)::int, (array_agg(t.visit_id))[1:5]
    FROM (SELECT p.visit_id FROM public.visit_parties p
           GROUP BY p.visit_id, p.companion_index, p.is_primary HAVING count(*) > 1) t;

  RETURN QUERY
  SELECT 'multiple_primaries', count(*)::int, (array_agg(t.visit_id))[1:5]
    FROM (SELECT p.visit_id FROM public.visit_parties p
           WHERE p.is_primary GROUP BY p.visit_id HAVING count(*) > 1) t;

  RETURN QUERY
  SELECT 'headcount_mismatch', count(*)::int, (array_agg(v.id))[1:5]
    FROM public.visitors v
    JOIN public.visits s ON s.legacy_visitor_id = v.id
   WHERE (p_branch_id IS NULL OR v.branch_id = p_branch_id)
     AND (SELECT count(*) FROM public.visit_parties p WHERE p.visit_id = s.id)
         <> 1 + coalesce(v.additional_visitors, 0);

  RETURN QUERY
  SELECT 'unresolved_companions', count(*)::int, (array_agg(p.id))[1:5]
    FROM public.visit_parties p JOIN public.visits s ON s.id = p.visit_id
   WHERE p.name_status = 'unresolved'
     AND (p_branch_id IS NULL OR s.branch_id = p_branch_id);

  RETURN QUERY
  SELECT 'cross_site_party_person', count(*)::int, (array_agg(p.id))[1:5]
    FROM public.visit_parties p
    JOIN public.visits s ON s.id = p.visit_id
    JOIN public.people pe ON pe.id = p.person_id
   WHERE pe.branch_id IS NOT NULL AND pe.branch_id <> s.branch_id;
END;
$function$;

-- 8. Idempotent historical reconciliation ------------------------------------
CREATE OR REPLACE FUNCTION public.reconcile_visit_parties(p_branch_id uuid DEFAULT NULL, p_dry_run boolean DEFAULT true)
RETURNS TABLE(visits_created int, parties_created int, placeholders_created int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_before_visits int;
  v_before_parties int;
  v_before_placeholders int;
  v_visits int;
  v_parties int;
  v_placeholders int;
  r record;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only administrators can reconcile attendance records';
  END IF;

  SELECT count(*) INTO v_before_visits FROM public.visits;
  SELECT count(*) INTO v_before_parties FROM public.visit_parties;
  SELECT count(*) INTO v_before_placeholders FROM public.visit_parties WHERE name_status = 'unresolved';

  -- Re-firing the existing sync trigger is the only creation path, so repeat
  -- runs converge and nothing is deleted or rewritten.
  FOR r IN
    SELECT v.id FROM public.visitors v
     WHERE v.type <> 'resident'
       AND (p_branch_id IS NULL OR v.branch_id = p_branch_id)
     ORDER BY v.check_in_time
  LOOP
    UPDATE public.visitors SET updated_at_touch = NULL WHERE false; -- no-op guard
    PERFORM public.reconcile_one_visitor(r.id);
  END LOOP;

  SELECT count(*) - v_before_visits INTO v_visits FROM public.visits;
  SELECT count(*) - v_before_parties INTO v_parties FROM public.visit_parties;
  SELECT count(*) - v_before_placeholders INTO v_placeholders
    FROM public.visit_parties WHERE name_status = 'unresolved';

  IF p_dry_run THEN
    RAISE EXCEPTION 'DRY RUN: would create % visits, % parties (% unresolved placeholders)',
      v_visits, v_parties, v_placeholders
      USING ERRCODE = 'triggered_action_exception';
  END IF;

  PERFORM public.log_audit('attendance.reconcile',
    jsonb_build_object('branch_id', p_branch_id, 'visits_created', v_visits,
                       'parties_created', v_parties, 'placeholders', v_placeholders),
    v_parties, NULL);

  RETURN QUERY SELECT v_visits, v_parties, v_placeholders;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.check_in_party(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_out_party(uuid[], timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.visit_integrity_report(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_visit_parties(uuid, boolean) TO authenticated;