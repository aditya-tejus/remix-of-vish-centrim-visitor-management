CREATE OR REPLACE FUNCTION public.seed_demo_data(p_branch_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run_id uuid;
  v_jur text;
  v_site text;
  v_counts jsonb;
  v_skipped jsonb := jsonb_build_array(
    'Emergency roll call — a demo drill would create misleading compliance evidence.',
    'Kiosk devices — real device binding must never be faked.',
    'Watchlist entries — safeguarding records are never invented.',
    'Document files — contractor document records are created without any file attached.'
  );
  v_now timestamptz := now();
  v_phone text;
  v_wing_a uuid; v_wing_b uuid;
  v_res1 uuid; v_res2 uuid; v_res3 uuid;
  v_vis_group uuid; v_supplier uuid;
  v_cp1 uuid; v_cp2 uuid;
  v_ct_person uuid; v_ct_company uuid;
  v_survey uuid; v_q1 uuid; v_q2 uuid;
  v_key1 uuid; v_key2 uuid; v_key3 uuid;
  v_v_onsite uuid; v_v_companions uuid; v_v_out uuid; v_v_missing uuid;
  v_v_warn uuid; v_v_block uuid; v_v_contractor uuid;
  v_visit uuid;
  c_wings int := 0; c_res int := 0; c_visitors int := 0; c_parties int := 0;
  c_visits int := 0; c_suppliers int := 0; c_people int := 0; c_docs int := 0;
  c_keys int := 0; c_issues int := 0; c_food int := 0; c_feedback int := 0;
BEGIN
  IF NOT public.has_permission(auth.uid(), 'settings.administer') THEN
    RAISE EXCEPTION 'Only administrators can load demo data';
  END IF;
  IF NOT public.user_can_access_site(p_branch_id) THEN
    RAISE EXCEPTION 'You do not have access to this site';
  END IF;

  SELECT coalesce(jurisdiction,'AU'), name INTO v_jur, v_site FROM public.branches WHERE id = p_branch_id;
  IF v_site IS NULL THEN
    RAISE EXCEPTION 'Unknown site';
  END IF;

  IF EXISTS (SELECT 1 FROM public.demo_seed_runs WHERE branch_id = p_branch_id AND status = 'active') THEN
    RAISE EXCEPTION 'Demo data is already loaded for this site. Remove it before loading again.';
  END IF;

  v_phone := CASE WHEN v_jur = 'UK' THEN '+44 7000 000000' ELSE '+61 400 000 000' END;

  INSERT INTO public.demo_seed_runs (branch_id, seed_key, created_by, created_by_label, skipped)
  VALUES (p_branch_id, 'demo:' || p_branch_id::text, auth.uid(), coalesce(auth.jwt() ->> 'email', 'administrator'), v_skipped)
  RETURNING id INTO v_run_id;

  INSERT INTO public.wings (name, branch_id, demo_seed_run_id)
  VALUES (CASE WHEN v_jur='UK' THEN 'DEMO Bluebell Unit' ELSE 'DEMO Riverside Wing' END, p_branch_id, v_run_id)
  RETURNING id INTO v_wing_a;
  INSERT INTO public.wings (name, branch_id, demo_seed_run_id)
  VALUES (CASE WHEN v_jur='UK' THEN 'DEMO Oakwood Unit' ELSE 'DEMO Garden Wing' END, p_branch_id, v_run_id)
  RETURNING id INTO v_wing_b;
  c_wings := 2;

  INSERT INTO public.visitors (first_name, surname, email, mobile, type, status, check_in_time, branch_id, demo_seed_run_id)
  VALUES ('DEMO Ivy','Resident','demo@example.invalid', v_phone,'resident','checked-in', v_now - interval '30 days', p_branch_id, v_run_id)
  RETURNING id INTO v_res1;
  INSERT INTO public.visitors (first_name, surname, email, mobile, type, status, check_in_time, branch_id, demo_seed_run_id)
  VALUES ('DEMO Harold','Resident','demo@example.invalid', v_phone,'resident','checked-in', v_now - interval '60 days', p_branch_id, v_run_id)
  RETURNING id INTO v_res2;
  INSERT INTO public.visitors (first_name, surname, email, mobile, type, status, check_in_time, branch_id, demo_seed_run_id)
  VALUES ('DEMO Margaret','Resident','demo@example.invalid', v_phone,'resident','checked-in', v_now - interval '90 days', p_branch_id, v_run_id)
  RETURNING id INTO v_res3;
  c_visitors := c_visitors + 3;

  INSERT INTO public.resident_details (visitor_id, wing_id, room, care_level, dols_lps_flag, destination_categories, branch_id, notes, demo_seed_run_id)
  VALUES
    (v_res1, v_wing_a, CASE WHEN v_jur='UK' THEN '12' ELSE 'Villa 12' END, 'standard', false, ARRAY['room','garden'], p_branch_id, 'DEMO record — not a real person.', v_run_id),
    (v_res2, v_wing_a, CASE WHEN v_jur='UK' THEN '14' ELSE 'Villa 14' END, 'high', true, ARRAY['room','lounge'], p_branch_id, 'DEMO record — not a real person.', v_run_id),
    (v_res3, v_wing_b, CASE WHEN v_jur='UK' THEN '21' ELSE 'Villa 21' END, 'standard', false, ARRAY['room','cafe'], p_branch_id, 'DEMO record — not a real person.', v_run_id);
  c_res := 3;

  INSERT INTO public.visitors (first_name, surname, email, mobile, type, status, check_in_time, whom_to_visit, visited_resident_ids, screening_outcome, branch_id, comments, demo_seed_run_id)
  VALUES ('DEMO Ana','Visitor','demo@example.invalid', v_phone,'visitor','checked-in', v_now - interval '40 minutes', 'DEMO Ivy Resident', ARRAY[v_res1], 'clear', p_branch_id, 'DEMO record.', v_run_id)
  RETURNING id INTO v_v_onsite;

  v_vis_group := gen_random_uuid();
  INSERT INTO public.visitors (first_name, surname, email, mobile, type, status, check_in_time, whom_to_visit, visited_resident_ids, screening_outcome, additional_visitors, companion_details, group_id, branch_id, comments, demo_seed_run_id)
  VALUES ('DEMO Ben','Visitor','demo@example.invalid', v_phone,'visitor','checked-in', v_now - interval '25 minutes', 'DEMO Harold Resident', ARRAY[v_res2], 'clear', 2,
          jsonb_build_array(jsonb_build_object('name','DEMO Chloe Companion','relationship','Family'), jsonb_build_object('name','DEMO Dan Companion','relationship','Family')),
          v_vis_group, p_branch_id, 'DEMO record.', v_run_id)
  RETURNING id INTO v_v_companions;

  INSERT INTO public.visitors (first_name, surname, email, mobile, type, status, check_in_time, check_out_time, whom_to_visit, visited_resident_ids, screening_outcome, branch_id, comments, demo_seed_run_id)
  VALUES ('DEMO Erin','Visitor','demo@example.invalid', v_phone,'visitor','checked-out', v_now - interval '5 hours', v_now - interval '3 hours', 'DEMO Margaret Resident', ARRAY[v_res3], 'clear', p_branch_id, 'DEMO record.', v_run_id)
  RETURNING id INTO v_v_out;

  INSERT INTO public.visitors (first_name, surname, email, mobile, type, status, check_in_time, whom_to_visit, visited_resident_ids, screening_outcome, branch_id, comments, demo_seed_run_id)
  VALUES ('DEMO Frank','Visitor','demo@example.invalid', v_phone,'visitor','checked-in', v_now - interval '26 hours', 'DEMO Ivy Resident', ARRAY[v_res1], 'clear', p_branch_id, 'DEMO record — arrival with no sign-out recorded.', v_run_id)
  RETURNING id INTO v_v_missing;

  INSERT INTO public.visitors (first_name, surname, email, mobile, type, status, check_in_time, whom_to_visit, visited_resident_ids, screening_outcome, screening_flags, branch_id, comments, demo_seed_run_id)
  VALUES ('DEMO Grace','Visitor','demo@example.invalid', v_phone,'visitor','checked-in', v_now - interval '90 minutes', 'DEMO Harold Resident', ARRAY[v_res2], 'flagged',
          jsonb_build_array(jsonb_build_object('questionId','demo','severity','warning','action','flag','message','DEMO — recent cough reported, staff informed.')),
          p_branch_id, 'DEMO record.', v_run_id)
  RETURNING id INTO v_v_warn;

  INSERT INTO public.visitors (first_name, surname, email, mobile, type, status, check_in_time, check_out_time, whom_to_visit, visited_resident_ids, screening_outcome, screening_flags, branch_id, comments, demo_seed_run_id)
  VALUES ('DEMO Henry','Visitor','demo@example.invalid', v_phone,'visitor','checked-out', v_now - interval '4 hours', v_now - interval '4 hours', 'DEMO Margaret Resident', ARRAY[v_res3], 'blocked',
          jsonb_build_array(jsonb_build_object('questionId','demo','severity','critical','action','block','message','DEMO — entry declined at the door.')),
          p_branch_id, 'DEMO record — arrival declined by check-in questions.', v_run_id)
  RETURNING id INTO v_v_block;
  c_visitors := c_visitors + 6;

  INSERT INTO public.suppliers_min (name, contact_name, contact_phone, contact_email, branch_id, demo_seed_run_id)
  VALUES (CASE WHEN v_jur='UK' THEN 'DEMO Pennine Facilities Ltd' ELSE 'DEMO Coastal Maintenance Pty Ltd' END,
          'DEMO Site Contact', v_phone, 'demo@example.invalid', p_branch_id, v_run_id)
  RETURNING id INTO v_supplier;
  c_suppliers := 1;

  INSERT INTO public.contractor_people (first_name, surname, mobile, email, supplier_id, branch_id, notes, demo_seed_run_id)
  VALUES ('DEMO Priya','Contractor', v_phone, 'demo@example.invalid', v_supplier, p_branch_id, 'DEMO record.', v_run_id)
  RETURNING id INTO v_cp1;
  INSERT INTO public.contractor_people (first_name, surname, mobile, email, supplier_id, branch_id, notes, demo_seed_run_id)
  VALUES ('DEMO Sam','Contractor', v_phone, 'demo@example.invalid', v_supplier, p_branch_id, 'DEMO record.', v_run_id)
  RETURNING id INTO v_cp2;
  c_people := 2;

  INSERT INTO public.visitors (first_name, surname, email, mobile, type, status, check_in_time, supplier_id, contractor_person_id, work_type, work_location, screening_outcome, branch_id, comments, demo_seed_run_id)
  VALUES ('DEMO Priya','Contractor','demo@example.invalid', v_phone,'contractor','checked-in', v_now - interval '2 hours', v_supplier, v_cp1,
          CASE WHEN v_jur='UK' THEN 'Maintenance (RAMS on file)' ELSE 'Maintenance (SWMS on file)' END,
          'DEMO plant room', 'clear', p_branch_id, 'DEMO record.', v_run_id)
  RETURNING id INTO v_v_contractor;
  c_visitors := c_visitors + 1;

  SELECT id INTO v_ct_company FROM public.credential_types WHERE key = 'insurance' LIMIT 1;
  SELECT id INTO v_ct_person FROM public.credential_types
   WHERE key = CASE WHEN v_jur='UK' THEN 'dbs' ELSE 'acws' END LIMIT 1;

  IF v_ct_company IS NOT NULL THEN
    INSERT INTO public.contractor_documents (branch_id, credential_type_id, holder_scope, supplier_id, issue_date, expiry_date, source, submitted_by, status, verified_at, demo_seed_run_id)
    VALUES (p_branch_id, v_ct_company, 'company', v_supplier, (v_now - interval '200 days')::date, (v_now + interval '165 days')::date, 'in_person', 'DEMO seed', 'verified', v_now - interval '30 days', v_run_id);
    c_docs := c_docs + 1;
  END IF;
  IF v_ct_person IS NOT NULL THEN
    INSERT INTO public.contractor_documents (branch_id, credential_type_id, holder_scope, person_id, issue_date, expiry_date, source, submitted_by, status, demo_seed_run_id)
    VALUES (p_branch_id, v_ct_person, 'person', v_cp1, (v_now - interval '10 days')::date, (v_now + interval '355 days')::date, 'upload', 'DEMO seed', 'pending', v_run_id);
    INSERT INTO public.contractor_documents (branch_id, credential_type_id, holder_scope, person_id, issue_date, expiry_date, source, submitted_by, status, demo_seed_run_id)
    VALUES (p_branch_id, v_ct_person, 'person', v_cp2, (v_now - interval '400 days')::date, (v_now - interval '20 days')::date, 'upload', 'DEMO seed', 'expired', v_run_id);
    c_docs := c_docs + 2;
  END IF;

  FOR v_visit IN
    SELECT unnest(ARRAY[v_v_onsite, v_v_companions, v_v_out, v_v_missing, v_v_warn, v_v_block, v_v_contractor])
  LOOP
    DECLARE
      r public.visitors%ROWTYPE;
      v_new_visit uuid;
    BEGIN
      SELECT * INTO r FROM public.visitors WHERE id = v_visit;
      INSERT INTO public.visits (branch_id, person_type, status, check_in_time, check_out_time, destination_label, group_id, source, legacy_visitor_id, demo_seed_run_id)
      VALUES (p_branch_id, r.type, r.status, r.check_in_time, r.check_out_time, r.whom_to_visit, r.group_id, 'demo_seed', r.id, v_run_id)
      RETURNING id INTO v_new_visit;
      c_visits := c_visits + 1;

      INSERT INTO public.visit_parties (visit_id, display_name, relationship, is_primary, companion_index, name_status, status, check_in_time, check_out_time, demo_seed_run_id)
      VALUES (v_new_visit, r.first_name || ' ' || r.surname, NULL, true, 0, 'named', r.status, r.check_in_time, r.check_out_time, v_run_id);
      c_parties := c_parties + 1;

      IF r.id = v_v_companions THEN
        INSERT INTO public.visit_parties (visit_id, display_name, relationship, is_primary, companion_index, name_status, status, check_in_time, check_out_time, demo_seed_run_id)
        VALUES
          (v_new_visit, 'DEMO Chloe Companion', 'Family', false, 1, 'named', r.status, r.check_in_time, r.check_out_time, v_run_id),
          (v_new_visit, 'DEMO Dan Companion', 'Family', false, 2, 'named', r.status, r.check_in_time, r.check_out_time, v_run_id);
        c_parties := c_parties + 2;
      END IF;
    END;
  END LOOP;

  INSERT INTO public.food_register (resident_visitor_id, resident_name, visitor_id, brought_by_name, food_description, food_type, shared_with_others, branch_id, recorded_at, source, created_by, notes, demo_seed_run_id)
  VALUES
    (v_res1, 'DEMO Ivy Resident', v_v_onsite, 'DEMO Ana Visitor', 'DEMO — homemade soup', 'homemade', false, p_branch_id, v_now - interval '35 minutes', 'demo_seed', 'DEMO seed', 'DEMO record.', v_run_id),
    (v_res2, 'DEMO Harold Resident', v_v_companions, 'DEMO Ben Visitor', 'DEMO — shop-bought cake', 'shop_bought', true, p_branch_id, v_now - interval '20 minutes', 'demo_seed', 'DEMO seed', 'DEMO record.', v_run_id);
  c_food := 2;

  INSERT INTO public.property_keys (key_label, key_type, property_label, resident_visitor_id, resident_name, wing_id, branch_id, status, notes, demo_seed_run_id)
  VALUES ('DEMO KEY-001','key', CASE WHEN v_jur='UK' THEN 'Room 12' ELSE 'Villa 12' END, v_res1, 'DEMO Ivy Resident', v_wing_a, p_branch_id, 'issued', 'DEMO record.', v_run_id)
  RETURNING id INTO v_key1;
  INSERT INTO public.property_keys (key_label, key_type, property_label, resident_visitor_id, resident_name, wing_id, branch_id, status, notes, demo_seed_run_id)
  VALUES ('DEMO FOB-002','fob', CASE WHEN v_jur='UK' THEN 'Room 14' ELSE 'Villa 14' END, v_res2, 'DEMO Harold Resident', v_wing_a, p_branch_id, 'available', 'DEMO record.', v_run_id)
  RETURNING id INTO v_key2;
  INSERT INTO public.property_keys (key_label, key_type, property_label, resident_visitor_id, resident_name, wing_id, branch_id, status, notes, demo_seed_run_id)
  VALUES ('DEMO KEY-003','key', CASE WHEN v_jur='UK' THEN 'Room 21' ELSE 'Villa 21' END, v_res3, 'DEMO Margaret Resident', v_wing_b, p_branch_id, 'issued', 'DEMO record.', v_run_id)
  RETURNING id INTO v_key3;
  c_keys := 3;

  INSERT INTO public.key_issues (key_id, issued_to_name, issued_to_type, visitor_id, issued_at, issued_by, expected_return, branch_id, notes, demo_seed_run_id)
  VALUES (v_key1, 'DEMO Priya Contractor', 'contractor', v_v_contractor, v_now - interval '2 hours', 'DEMO seed', v_now + interval '2 hours', p_branch_id, 'DEMO record — currently out.', v_run_id);
  INSERT INTO public.key_issues (key_id, issued_to_name, issued_to_type, visitor_id, issued_at, issued_by, expected_return, returned_at, returned_to, branch_id, notes, demo_seed_run_id)
  VALUES (v_key2, 'DEMO Erin Visitor', 'visitor', v_v_out, v_now - interval '5 hours', 'DEMO seed', v_now - interval '3 hours', v_now - interval '3 hours', 'DEMO seed', p_branch_id, 'DEMO record — returned.', v_run_id);
  INSERT INTO public.key_issues (key_id, issued_to_name, issued_to_type, issued_at, issued_by, expected_return, branch_id, notes, demo_seed_run_id)
  VALUES (v_key3, 'DEMO Sam Contractor', 'contractor', v_now - interval '2 days', 'DEMO seed', v_now - interval '1 day', p_branch_id, 'DEMO record — overdue.', v_run_id);
  c_issues := 3;

  INSERT INTO public.feedback_surveys (title, description, assigned_types, trigger_point, source, is_active, demo_seed_run_id)
  VALUES ('DEMO Visit experience', 'DEMO survey created by the demo data loader.', ARRAY['visitor'], 'checkout', 'internal', false, v_run_id)
  RETURNING id INTO v_survey;
  INSERT INTO public.feedback_questions (question, category, visitor_type, survey_id, is_active, sort_order, demo_seed_run_id)
  VALUES ('DEMO — How easy was signing in today?', 'experience', 'visitor', v_survey, false, 1, v_run_id)
  RETURNING id INTO v_q1;
  INSERT INTO public.feedback_questions (question, category, visitor_type, survey_id, is_active, sort_order, demo_seed_run_id)
  VALUES ('DEMO — How welcome did our team make you feel?', 'experience', 'visitor', v_survey, false, 2, v_run_id)
  RETURNING id INTO v_q2;

  INSERT INTO public.feedback_responses (visitor_id, visitor_name, visitor_type, question_id, rating, comment, survey_id, created_at, demo_seed_run_id)
  VALUES
    (v_v_out, 'DEMO Erin Visitor', 'visitor', v_q1, 5, 'DEMO comment — quick and simple.', v_survey, v_now - interval '3 hours', v_run_id),
    (v_v_out, 'DEMO Erin Visitor', 'visitor', v_q2, 5, 'DEMO comment — very welcoming.', v_survey, v_now - interval '3 hours', v_run_id),
    (v_v_onsite, 'DEMO Ana Visitor', 'visitor', v_q1, 4, 'DEMO comment — small queue at the door.', v_survey, v_now - interval '1 day', v_run_id),
    (v_v_onsite, 'DEMO Ana Visitor', 'visitor', v_q2, 4, 'DEMO comment — friendly staff.', v_survey, v_now - interval '1 day', v_run_id);
  c_feedback := 7;

  v_counts := jsonb_build_object(
    'wings', c_wings, 'residents', c_res, 'visitors', c_visitors, 'visits', c_visits,
    'attendance_rows', c_parties, 'suppliers', c_suppliers, 'contractor_people', c_people,
    'contractor_documents', c_docs, 'keys', c_keys, 'key_issues', c_issues,
    'food_register', c_food, 'feedback_records', c_feedback
  );

  UPDATE public.demo_seed_runs SET counts = v_counts WHERE id = v_run_id;

  PERFORM public.log_audit(
    'demo_data_loaded',
    jsonb_build_object('run_id', v_run_id, 'site', v_site, 'branch_id', p_branch_id, 'jurisdiction', v_jur, 'counts', v_counts, 'skipped', v_skipped),
    (c_wings + c_res + c_visitors + c_visits + c_parties + c_suppliers + c_people + c_docs + c_keys + c_issues + c_food + c_feedback),
    'Administrator loaded demo data'
  );

  RETURN jsonb_build_object('run_id', v_run_id, 'branch_id', p_branch_id, 'site', v_site, 'counts', v_counts, 'skipped', v_skipped);
END;
$$;