CREATE OR REPLACE FUNCTION public.seed_demo_data(p_branch_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_run_id uuid;
  v_jur text;
  v_site text;
  v_uk boolean;
  v_counts jsonb;
  v_skipped jsonb := jsonb_build_array(
    'Emergency roll call — a demo drill would create misleading compliance evidence.',
    'Kiosk devices — real device binding must never be faked.',
    'Watchlist entries — safeguarding records are never invented.',
    'Document files — contractor document records are created without any file attached.'
  );
  v_now timestamptz := now();
  v_today date := (now())::date;
  v_wing_a uuid; v_wing_b uuid;
  v_res1 uuid; v_res2 uuid; v_res3 uuid;
  v_supplier uuid; v_cp1 uuid; v_cp2 uuid;
  v_ct_person uuid; v_ct_company uuid;
  v_survey uuid; v_q1 uuid; v_q2 uuid;
  v_key1 uuid; v_key2 uuid; v_key3 uuid;
  v_group uuid;
  v_v_family uuid; v_v_group uuid; v_v_out uuid; v_v_overstay uuid;
  v_v_warn uuid; v_v_block uuid; v_v_contractor uuid; v_v_vol uuid; v_v_nurse uuid;
  -- names, chosen to suit the country the site operates in
  n_wa text; n_wb text;
  r1 text; r1s text; r2 text; r2s text; r3 text; r3s text;
  f1 text; f1s text; f2 text; f2s text; f3 text; f3s text; f4 text; f4s text;
  g1 text; g2 text; b1 text; b1s text; w1 text; w1s text;
  c_co text; cn1 text; cn1s text; cn2 text; cn2s text;
  vol text; vols text; nur text; nurs text;
  ph text; ph2 text; room1 text; room2 text; room3 text;
  qr_f1 text; qr_f2 text; qr_out text;
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

  v_uk := (v_jur = 'UK');

  IF v_uk THEN
    n_wa := 'Bluebell Unit'; n_wb := 'Oakwood Unit';
    r1 := 'Doris'; r1s := 'Ashcombe'; r2 := 'Arthur'; r2s := 'Pemberton'; r3 := 'Eileen'; r3s := 'Wallace';
    room1 := 'Room 12'; room2 := 'Room 14'; room3 := 'Room 21';
    f1 := 'Sarah'; f1s := 'Mercer'; f2 := 'Paul'; f2s := 'Bradshaw';
    f3 := 'Emma'; f3s := 'Sutcliffe'; f4 := 'David'; f4s := 'Ferriday';
    g1 := 'Lucy Bradshaw'; g2 := 'Tom Bradshaw';
    b1 := 'Neil'; b1s := 'Osborne'; w1 := 'Gillian'; w1s := 'Hart';
    c_co := 'Pennine Facilities Ltd'; cn1 := 'Priya'; cn1s := 'Anand'; cn2 := 'Owen'; cn2s := 'Kelly';
    vol := 'Colin'; vols := 'Reeve'; nur := 'Rachel'; nurs := 'Dunn';
    ph := '+44 7700 900142'; ph2 := '+44 7700 900318';
  ELSE
    n_wa := 'Riverside Wing'; n_wb := 'Garden Wing';
    r1 := 'Beryl'; r1s := 'Nguyen'; r2 := 'Ronald'; r2s := 'Fitzgerald'; r3 := 'Margaret'; r3s := 'O''Donnell';
    room1 := 'Villa 12'; room2 := 'Villa 14'; room3 := 'Room 21';
    f1 := 'Ana'; f1s := 'Marsh'; f2 := 'Ben'; f2s := 'Kowalski';
    f3 := 'Erin'; f3s := 'Whitfield'; f4 := 'Frank'; f4s := 'Delaney';
    g1 := 'Chloe Kowalski'; g2 := 'Dan Kowalski';
    b1 := 'Henry'; b1s := 'Broadbent'; w1 := 'Grace'; w1s := 'Tan';
    c_co := 'Coastal Maintenance Pty Ltd'; cn1 := 'Priya'; cn1s := 'Anand'; cn2 := 'Sam'; cn2s := 'Rivera';
    vol := 'Jack'; vols := 'Fenton'; nur := 'Sandra'; nurs := 'Kiely';
    ph := '+61 412 555 108'; ph2 := '+61 438 555 291';
  END IF;

  qr_f1 := upper(substr(md5(random()::text), 1, 12));
  qr_f2 := upper(substr(md5(random()::text), 1, 12));
  qr_out := upper(substr(md5(random()::text), 1, 12));

  INSERT INTO public.demo_seed_runs (branch_id, seed_key, created_by, created_by_label, skipped)
  VALUES (p_branch_id, 'demo:' || p_branch_id::text, auth.uid(), coalesce(auth.jwt() ->> 'email', 'administrator'), v_skipped)
  RETURNING id INTO v_run_id;

  INSERT INTO public.wings (name, branch_id, demo_seed_run_id) VALUES (n_wa, p_branch_id, v_run_id) RETURNING id INTO v_wing_a;
  INSERT INTO public.wings (name, branch_id, demo_seed_run_id) VALUES (n_wb, p_branch_id, v_run_id) RETURNING id INTO v_wing_b;
  c_wings := 2;

  -- Residents: long-term occupants. Their arrival is recorded as the start of
  -- today so the overstay rule never treats living here as an overstay.
  INSERT INTO public.visitors (first_name, surname, mobile, type, status, check_in_time, branch_id, demo_seed_run_id)
  VALUES (r1, r1s, ph, 'resident', 'checked-in', v_today + time '07:00', p_branch_id, v_run_id) RETURNING id INTO v_res1;
  INSERT INTO public.visitors (first_name, surname, mobile, type, status, check_in_time, branch_id, demo_seed_run_id)
  VALUES (r2, r2s, ph, 'resident', 'checked-in', v_today + time '07:00', p_branch_id, v_run_id) RETURNING id INTO v_res2;
  INSERT INTO public.visitors (first_name, surname, mobile, type, status, check_in_time, branch_id, demo_seed_run_id)
  VALUES (r3, r3s, ph, 'resident', 'checked-in', v_today + time '07:00', p_branch_id, v_run_id) RETURNING id INTO v_res3;
  c_visitors := c_visitors + 3;

  INSERT INTO public.resident_details (visitor_id, wing_id, room, care_level, dols_lps_flag, destination_categories, branch_id, notes,
                                       emergency_contact_name, emergency_contact_phone, demo_seed_run_id)
  VALUES
    (v_res1, v_wing_a, room1, 'standard', false, ARRAY['room','garden'], p_branch_id, 'Practice record created by the demo data loader.',
     f1 || ' ' || f1s, ph, v_run_id),
    (v_res2, v_wing_a, room2, 'high', v_uk, ARRAY['room','lounge'], p_branch_id, 'Practice record created by the demo data loader.',
     f2 || ' ' || f2s, ph2, v_run_id),
    (v_res3, v_wing_b, room3, 'standard', false, ARRAY['room','cafe'], p_branch_id, 'Practice record created by the demo data loader.',
     f3 || ' ' || f3s, ph2, v_run_id);
  c_res := 3;

  -- Family visitor on site now, with a full profile.
  INSERT INTO public.visitors (first_name, surname, email, mobile, type, status, check_in_time, whom_to_visit, visited_resident_ids,
                               visit_purpose, screening_outcome, person_qr, privacy_acknowledged, branch_id, comments, demo_seed_run_id)
  VALUES (f1, f1s, lower(left(f1,1) || '.' || f1s) || '@example.com', ph, 'visitor', 'checked-in', v_today + time '10:15',
          r1 || ' ' || r1s, ARRAY[v_res1], 'Family visit — daughter', 'clear', qr_f1, true, p_branch_id,
          'Practice record. Usual visitor, parks on site.', v_run_id)
  RETURNING id INTO v_v_family;

  -- Group arrival with two companions.
  v_group := gen_random_uuid();
  INSERT INTO public.visitors (first_name, surname, email, mobile, type, status, check_in_time, whom_to_visit, visited_resident_ids,
                               visit_purpose, screening_outcome, additional_visitors, companion_details, group_id, group_organiser_name,
                               person_qr, privacy_acknowledged, branch_id, comments, demo_seed_run_id)
  VALUES (f2, f2s, lower(left(f2,1) || '.' || f2s) || '@example.com', ph2, 'visitor', 'checked-in', v_today + time '11:00',
          r2 || ' ' || r2s, ARRAY[v_res2], 'Family visit — son', 'clear', 2,
          jsonb_build_array(
            jsonb_build_object('name', g1, 'relationship', 'Grandchild'),
            jsonb_build_object('name', g2, 'relationship', 'Grandchild')),
          v_group, f2 || ' ' || f2s, qr_f2, true, p_branch_id, 'Practice record. Visiting with two family members.', v_run_id)
  RETURNING id INTO v_v_group;

  -- Visited earlier today and signed out.
  INSERT INTO public.visitors (first_name, surname, mobile, type, status, check_in_time, check_out_time, whom_to_visit, visited_resident_ids,
                               visit_purpose, screening_outcome, person_qr, privacy_acknowledged, branch_id, comments, demo_seed_run_id)
  VALUES (f3, f3s, ph, 'visitor', 'checked-out', v_today + time '09:05', v_today + time '10:20', r3 || ' ' || r3s, ARRAY[v_res3],
          'Family visit — niece', 'clear', qr_out, true, p_branch_id, 'Practice record.', v_run_id)
  RETURNING id INTO v_v_out;

  -- Yesterday morning, still shown as on site: no sign-out was recorded.
  INSERT INTO public.visitors (first_name, surname, mobile, type, status, check_in_time, whom_to_visit, visited_resident_ids,
                               visit_purpose, screening_outcome, privacy_acknowledged, branch_id, comments, demo_seed_run_id)
  VALUES (f4, f4s, ph2, 'visitor', 'checked-in', v_today - interval '1 day' + time '10:30', r1 || ' ' || r1s, ARRAY[v_res1],
          'Family visit — nephew', 'clear', true, p_branch_id,
          'Practice record. Arrival with no sign-out recorded — the only overstay in the practice set.', v_run_id)
  RETURNING id INTO v_v_overstay;

  -- Warning from the check-in questions.
  INSERT INTO public.visitors (first_name, surname, mobile, type, status, check_in_time, whom_to_visit, visited_resident_ids,
                               visit_purpose, screening_outcome, screening_flags, privacy_acknowledged, branch_id, comments, demo_seed_run_id)
  VALUES (w1, w1s, ph, 'visitor', 'checked-in', v_today + time '13:20', r2 || ' ' || r2s, ARRAY[v_res2], 'Family visit — daughter-in-law',
          'flagged',
          jsonb_build_array(jsonb_build_object('questionId','demo-cough','severity','warning','action','flag','message','Reported a mild cough. Mask worn, staff informed.')),
          true, p_branch_id, 'Practice record.', v_run_id)
  RETURNING id INTO v_v_warn;

  -- Entry declined at the door.
  INSERT INTO public.visitors (first_name, surname, mobile, type, status, check_in_time, check_out_time, whom_to_visit, visited_resident_ids,
                               visit_purpose, screening_outcome, screening_flags, privacy_acknowledged, branch_id, comments, demo_seed_run_id)
  VALUES (b1, b1s, ph2, 'visitor', 'checked-out', v_today + time '08:40', v_today + time '08:42', r3 || ' ' || r3s, ARRAY[v_res3],
          'Family visit — son', 'blocked',
          jsonb_build_array(jsonb_build_object('questionId','demo-symptoms','severity','critical','action','block','message','Reported vomiting in the last 48 hours. Entry declined and rebooked.')),
          true, p_branch_id, 'Practice record. Entry declined by the check-in questions.', v_run_id)
  RETURNING id INTO v_v_block;

  -- Volunteer and a visiting community nurse.
  INSERT INTO public.visitors (first_name, surname, mobile, type, status, check_in_time, whom_to_visit, visit_purpose,
                               volunteer_role, volunteer_supervisor, screening_outcome, privacy_acknowledged, branch_id, comments, demo_seed_run_id)
  VALUES (vol, vols, ph, 'volunteer', 'checked-in', v_today + time '09:30', n_wa, 'Weekly activities session',
          'Activities volunteer', 'Lifestyle coordinator', 'clear', true, p_branch_id, 'Practice record.', v_run_id)
  RETURNING id INTO v_v_vol;

  INSERT INTO public.visitors (first_name, surname, mobile, type, status, check_in_time, check_out_time, whom_to_visit, visited_resident_ids,
                               visit_purpose, screening_outcome, privacy_acknowledged, branch_id, comments, demo_seed_run_id)
  VALUES (nur, nurs, ph2, 'visitor', 'checked-out', v_today + time '08:00', v_today + time '08:50', r2 || ' ' || r2s, ARRAY[v_res2],
          CASE WHEN v_uk THEN 'District nurse — dressing change' ELSE 'Community nurse — dressing change' END,
          'clear', true, p_branch_id, 'Practice record. Visiting health professional.', v_run_id)
  RETURNING id INTO v_v_nurse;
  c_visitors := c_visitors + 7;

  -- Earlier visits for the regulars, so their profiles show a history.
  INSERT INTO public.visitors (first_name, surname, mobile, type, status, check_in_time, check_out_time, whom_to_visit, visited_resident_ids,
                               visit_purpose, screening_outcome, person_qr, privacy_acknowledged, branch_id, comments, demo_seed_run_id)
  VALUES
    (f1, f1s, ph, 'visitor', 'checked-out', v_today - interval '3 days' + time '10:05', v_today - interval '3 days' + time '11:30',
     r1 || ' ' || r1s, ARRAY[v_res1], 'Family visit — daughter', 'clear', qr_f1, true, p_branch_id, 'Practice record.', v_run_id),
    (f1, f1s, ph, 'visitor', 'checked-out', v_today - interval '10 days' + time '14:10', v_today - interval '10 days' + time '15:25',
     r1 || ' ' || r1s, ARRAY[v_res1], 'Family visit — daughter', 'clear', qr_f1, true, p_branch_id, 'Practice record.', v_run_id),
    (f2, f2s, ph2, 'visitor', 'checked-out', v_today - interval '7 days' + time '11:15', v_today - interval '7 days' + time '12:40',
     r2 || ' ' || r2s, ARRAY[v_res2], 'Family visit — son', 'clear', qr_f2, true, p_branch_id, 'Practice record.', v_run_id),
    (f3, f3s, ph, 'visitor', 'checked-out', v_today - interval '5 days' + time '09:20', v_today - interval '5 days' + time '10:05',
     r3 || ' ' || r3s, ARRAY[v_res3], 'Family visit — niece', 'clear', qr_out, true, p_branch_id, 'Practice record.', v_run_id);
  c_visitors := c_visitors + 4;

  -- Contractor company, its people and today's arrival.
  INSERT INTO public.suppliers_min (name, contact_name, contact_phone, contact_email, branch_id, demo_seed_run_id)
  VALUES (c_co, cn1 || ' ' || cn1s, ph2, 'office@example.com', p_branch_id, v_run_id)
  RETURNING id INTO v_supplier;
  c_suppliers := 1;

  INSERT INTO public.contractor_people (first_name, surname, mobile, email, supplier_id, branch_id, notes, demo_seed_run_id)
  VALUES (cn1, cn1s, ph2, lower(left(cn1,1) || '.' || cn1s) || '@example.com', v_supplier, p_branch_id, 'Practice record.', v_run_id)
  RETURNING id INTO v_cp1;
  INSERT INTO public.contractor_people (first_name, surname, mobile, email, supplier_id, branch_id, notes, demo_seed_run_id)
  VALUES (cn2, cn2s, ph, lower(left(cn2,1) || '.' || cn2s) || '@example.com', v_supplier, p_branch_id, 'Practice record.', v_run_id)
  RETURNING id INTO v_cp2;
  c_people := 2;

  INSERT INTO public.visitors (first_name, surname, mobile, type, status, check_in_time, supplier_id, contractor_person_id, work_type,
                               work_location, screening_outcome, privacy_acknowledged, branch_id, comments, demo_seed_run_id)
  VALUES (cn1, cn1s, ph2, 'contractor', 'checked-in', v_today + time '12:10', v_supplier, v_cp1,
          CASE WHEN v_uk THEN 'Planned maintenance (RAMS on file)' ELSE 'Planned maintenance (SWMS on file)' END,
          'Plant room', 'clear', true, p_branch_id, 'Practice record.', v_run_id)
  RETURNING id INTO v_v_contractor;
  c_visitors := c_visitors + 1;

  SELECT id INTO v_ct_company FROM public.credential_types WHERE key = 'insurance' LIMIT 1;
  SELECT id INTO v_ct_person FROM public.credential_types WHERE key = CASE WHEN v_uk THEN 'dbs' ELSE 'acws' END LIMIT 1;

  IF v_ct_company IS NOT NULL THEN
    INSERT INTO public.contractor_documents (branch_id, credential_type_id, holder_scope, supplier_id, issue_date, expiry_date, source, submitted_by, status, is_current, demo_seed_run_id)
    VALUES (p_branch_id, v_ct_company, 'company', v_supplier, (v_now - interval '200 days')::date, (v_now + interval '165 days')::date, 'in_person', 'Demo data loader', 'verified', true, v_run_id);
    c_docs := c_docs + 1;
  END IF;
  IF v_ct_person IS NOT NULL THEN
    INSERT INTO public.contractor_documents (branch_id, credential_type_id, holder_scope, person_id, issue_date, expiry_date, source, submitted_by, status, is_current, demo_seed_run_id)
    VALUES (p_branch_id, v_ct_person, 'person', v_cp1, (v_now - interval '10 days')::date, (v_now + interval '355 days')::date, 'upload', 'Demo data loader', 'pending', true, v_run_id);
    INSERT INTO public.contractor_documents (branch_id, credential_type_id, holder_scope, person_id, issue_date, expiry_date, source, submitted_by, status, is_current, demo_seed_run_id)
    VALUES (p_branch_id, v_ct_person, 'person', v_cp2, (v_now - interval '400 days')::date, (v_now - interval '20 days')::date, 'upload', 'Demo data loader', 'expired', true, v_run_id);
    c_docs := c_docs + 2;
  END IF;

  -- The application creates the person, visit and attendance rows for each
  -- arrival. Mark those as practice records rather than creating a second copy.
  UPDATE public.people SET demo_seed_run_id = v_run_id
   WHERE demo_seed_run_id IS NULL
     AND legacy_visitor_id IN (SELECT id FROM public.visitors WHERE demo_seed_run_id = v_run_id);

  UPDATE public.visits SET demo_seed_run_id = v_run_id
   WHERE demo_seed_run_id IS NULL
     AND (legacy_visitor_id IN (SELECT id FROM public.visitors WHERE demo_seed_run_id = v_run_id)
          OR person_id IN (SELECT id FROM public.people WHERE demo_seed_run_id = v_run_id));
  GET DIAGNOSTICS c_visits = ROW_COUNT;

  UPDATE public.visit_parties SET demo_seed_run_id = v_run_id
   WHERE demo_seed_run_id IS NULL
     AND visit_id IN (SELECT id FROM public.visits WHERE demo_seed_run_id = v_run_id);
  GET DIAGNOSTICS c_parties = ROW_COUNT;

  INSERT INTO public.food_register (resident_visitor_id, resident_name, visitor_id, brought_by_name, food_description, food_type, shared_with_others, branch_id, recorded_at, source, created_by, notes, demo_seed_run_id)
  VALUES
    (v_res1, r1 || ' ' || r1s, v_v_family, f1 || ' ' || f1s, 'Homemade pumpkin soup', 'homemade', false, p_branch_id, v_today + time '10:20', 'demo_seed', 'Demo data loader', 'Practice record.', v_run_id),
    (v_res2, r2 || ' ' || r2s, v_v_group, f2 || ' ' || f2s, 'Shop-bought sponge cake', 'shop_bought', true, p_branch_id, v_today + time '11:05', 'demo_seed', 'Demo data loader', 'Practice record.', v_run_id);
  c_food := 2;

  INSERT INTO public.property_keys (key_label, key_type, property_label, resident_visitor_id, resident_name, wing_id, branch_id, status, notes, demo_seed_run_id)
  VALUES ('KEY-012', 'key', room1, v_res1, r1 || ' ' || r1s, v_wing_a, p_branch_id, 'issued', 'Practice record.', v_run_id) RETURNING id INTO v_key1;
  INSERT INTO public.property_keys (key_label, key_type, property_label, resident_visitor_id, resident_name, wing_id, branch_id, status, notes, demo_seed_run_id)
  VALUES ('FOB-014', 'fob', room2, v_res2, r2 || ' ' || r2s, v_wing_a, p_branch_id, 'available', 'Practice record.', v_run_id) RETURNING id INTO v_key2;
  INSERT INTO public.property_keys (key_label, key_type, property_label, resident_visitor_id, resident_name, wing_id, branch_id, status, notes, demo_seed_run_id)
  VALUES ('KEY-021', 'key', room3, v_res3, r3 || ' ' || r3s, v_wing_b, p_branch_id, 'issued', 'Practice record.', v_run_id) RETURNING id INTO v_key3;
  c_keys := 3;

  INSERT INTO public.key_issues (key_id, issued_to_name, issued_to_type, visitor_id, issued_at, issued_by, expected_return, branch_id, notes, demo_seed_run_id)
  VALUES (v_key1, cn1 || ' ' || cn1s, 'contractor', v_v_contractor, v_today + time '12:15', 'Reception', v_today + time '16:00', p_branch_id, 'Practice record — currently out.', v_run_id);
  INSERT INTO public.key_issues (key_id, issued_to_name, issued_to_type, visitor_id, issued_at, issued_by, expected_return, returned_at, returned_to, branch_id, notes, demo_seed_run_id)
  VALUES (v_key2, f3 || ' ' || f3s, 'visitor', v_v_out, v_today + time '09:10', 'Reception', v_today + time '10:30', v_today + time '10:20', 'Reception', p_branch_id, 'Practice record — returned.', v_run_id);
  INSERT INTO public.key_issues (key_id, issued_to_name, issued_to_type, issued_at, issued_by, expected_return, branch_id, notes, demo_seed_run_id)
  VALUES (v_key3, cn2 || ' ' || cn2s, 'contractor', v_now - interval '2 days', 'Reception', v_now - interval '1 day', p_branch_id, 'Practice record — overdue.', v_run_id);
  c_issues := 3;

  INSERT INTO public.feedback_surveys (title, description, assigned_types, trigger_point, source, is_active, demo_seed_run_id)
  VALUES ('Visit experience', 'Practice survey created by the demo data loader.', ARRAY['visitor'], 'checkout', 'internal', false, v_run_id)
  RETURNING id INTO v_survey;
  INSERT INTO public.feedback_questions (question, category, visitor_type, survey_id, is_active, sort_order, demo_seed_run_id)
  VALUES ('How easy was signing in today?', 'experience', 'visitor', v_survey, false, 1, v_run_id) RETURNING id INTO v_q1;
  INSERT INTO public.feedback_questions (question, category, visitor_type, survey_id, is_active, sort_order, demo_seed_run_id)
  VALUES ('How welcome did our team make you feel?', 'experience', 'visitor', v_survey, false, 2, v_run_id) RETURNING id INTO v_q2;

  INSERT INTO public.feedback_responses (visitor_id, visitor_name, visitor_type, question_id, rating, comment, survey_id, created_at, demo_seed_run_id)
  VALUES
    (v_v_out, f3 || ' ' || f3s, 'visitor', v_q1, 5, 'Quick and simple.', v_survey, v_today + time '10:25', v_run_id),
    (v_v_out, f3 || ' ' || f3s, 'visitor', v_q2, 5, 'Very welcoming as always.', v_survey, v_today + time '10:25', v_run_id),
    (v_v_nurse, nur || ' ' || nurs, 'visitor', v_q1, 4, 'Small queue at the door in the morning.', v_survey, v_today + time '08:55', v_run_id),
    (v_v_nurse, nur || ' ' || nurs, 'visitor', v_q2, 4, 'Staff were helpful.', v_survey, v_today + time '08:55', v_run_id);
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
$function$;