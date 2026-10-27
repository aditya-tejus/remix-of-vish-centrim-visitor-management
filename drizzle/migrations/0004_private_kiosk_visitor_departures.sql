CREATE OR REPLACE FUNCTION public.kioskd_checkout_name(p_token text, p_query text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE q text := lower(regexp_replace(btrim(normalize(coalesce(p_query, ''), NFKC)), '\s+', ' ', 'g'));
BEGIN
  PERFORM public.kiosk_device_site(p_token, false);
  IF length(q) < 3 OR length(q) > 60 OR q !~ '^[[:alpha:] .''-]+$' THEN RETURN jsonb_build_object('state','invalid_input'); END IF;
  -- Deliberately no person query: identical response for unknown, duplicate and resident names.
  RETURN jsonb_build_object('state','staff_required');
END $$;
REVOKE ALL ON FUNCTION public.kioskd_checkout_name(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kioskd_checkout_name(text,text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.kiosk_checkout_target(p_branch uuid, p_code text, p_visit uuid DEFAULT NULL)
RETURNS TABLE(visitor_id uuid, visit_id uuid, party_id uuid, primary_authority boolean, visitor_type text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT DISTINCT v.id, vs.id, p.id, p.is_primary, v.type
 FROM public.visitors v JOIN public.visits vs ON vs.legacy_visitor_id=v.id AND vs.branch_id=p_branch
 JOIN public.visit_parties p ON p.visit_id=vs.id
 LEFT JOIN public.people pe ON pe.id=p.person_id
 WHERE v.branch_id=p_branch AND v.type <> 'resident'
 AND (CASE WHEN p_visit IS NULL THEN vs.status='checked-in' ELSE vs.id=p_visit END)
 AND ((p.is_primary AND (upper(v.qr_code)=p_code OR upper(v.person_qr)=p_code))
 OR (NOT p.is_primary AND ((pe.branch_id=p_branch AND upper(pe.person_qr)=p_code)
 OR upper(coalesce(v.companion_details->(p.companion_index-1)->>'qrCode', v.companion_details->(p.companion_index-1)->>'qr_code'))=p_code)))
 LIMIT 2;
$$;
REVOKE ALL ON FUNCTION public.kiosk_checkout_target(uuid,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.kiosk_checkout_target(uuid,text,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.kioskd_checkout_lookup(p_token text, p_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b uuid; c text := upper(btrim(coalesce(p_code,''))); t record; n int; roster jsonb; keys int;
BEGIN
 b := public.kiosk_device_site(p_token, false);
 IF c !~ '^[A-Z0-9]{12}$' THEN RETURN jsonb_build_object('state','invalid_input'); END IF;
 SELECT count(*) INTO n FROM public.kiosk_checkout_target(b,c);
 IF n=0 THEN RETURN jsonb_build_object('state','no_match'); END IF;
 IF n<>1 THEN RETURN jsonb_build_object('state','staff_required'); END IF;
 SELECT * INTO t FROM public.kiosk_checkout_target(b,c);
 SELECT count(*) INTO n FROM public.visit_parties p WHERE p.visit_id=t.visit_id AND p.check_out_time IS NULL AND (t.primary_authority OR p.id=t.party_id);
 IF n=0 THEN RETURN jsonb_build_object('state','no_match'); END IF;
 IF n>50 THEN RETURN jsonb_build_object('state','staff_required'); END IF;
 SELECT jsonb_agg(jsonb_build_object('id',p.id,'label',CASE WHEN p.is_primary OR NOT t.primary_authority THEN 'You' ELSE 'Companion '||p.companion_index::text END,'primary',p.id=t.party_id) ORDER BY p.is_primary DESC,p.companion_index,p.id)
 INTO roster FROM public.visit_parties p WHERE p.visit_id=t.visit_id AND p.check_out_time IS NULL AND (t.primary_authority OR p.id=t.party_id);
 SELECT count(*) INTO keys FROM public.key_issues k WHERE k.branch_id=b AND k.visitor_id=t.visitor_id AND k.returned_at IS NULL;
 RETURN jsonb_build_object('state','ready','visitor_id',t.visitor_id,'visit_id',t.visit_id,'visitor_type',t.visitor_type,'parties',roster,'open_keys',keys);
END $$;
REVOKE ALL ON FUNCTION public.kioskd_checkout_lookup(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kioskd_checkout_lookup(text,text) TO anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.kioskd_checkout_submit(p_token text, p_code text, p_visit_id uuid, p_party_ids uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b uuid; c text := upper(btrim(coalesce(p_code,''))); t record; n int; changed int; remaining int; mirror jsonb; device uuid;
BEGIN
 b := public.kiosk_device_site(p_token, false);
 IF c !~ '^[A-Z0-9]{12}$' OR coalesce(cardinality(p_party_ids),0)<1 OR cardinality(p_party_ids)>50 OR array_position(p_party_ids,NULL) IS NOT NULL THEN RAISE EXCEPTION 'invalid_departure'; END IF;
 SELECT count(*) INTO n FROM (SELECT DISTINCT unnest(p_party_ids)) d;
 IF n<>cardinality(p_party_ids) THEN RAISE EXCEPTION 'invalid_departure'; END IF;
 -- Serialize party selection, compatibility mirror and audit for this visit.
 PERFORM 1 FROM public.visits WHERE id=p_visit_id AND branch_id=b FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'invalid_departure'; END IF;
 SELECT count(*) INTO n FROM public.kiosk_checkout_target(b,c,p_visit_id);
 IF n<>1 THEN RAISE EXCEPTION 'invalid_departure'; END IF;
 SELECT * INTO t FROM public.kiosk_checkout_target(b,c,p_visit_id);
 SELECT count(*) INTO n FROM public.visit_parties p WHERE p.id=ANY(p_party_ids) AND p.visit_id=p_visit_id AND (t.primary_authority OR p.id=t.party_id);
 IF n<>cardinality(p_party_ids) THEN RAISE EXCEPTION 'invalid_departure'; END IF;
 UPDATE public.visit_parties SET check_out_time=now(),status='checked-out',updated_at=now() WHERE id=ANY(p_party_ids) AND check_out_time IS NULL;
 GET DIAGNOSTICS changed=ROW_COUNT;
 SELECT count(*) INTO remaining FROM public.visit_parties WHERE visit_id=p_visit_id AND check_out_time IS NULL;
 IF changed>0 THEN
 SELECT jsonb_agg(CASE WHEN p.check_out_time IS NULL THEN coalesce(v.companion_details->(p.companion_index-1),'{}'::jsonb)-'checkedOutAt' ELSE coalesce(v.companion_details->(p.companion_index-1),'{}'::jsonb)||jsonb_build_object('checkedOutAt',p.check_out_time) END ORDER BY p.companion_index)
 INTO mirror FROM public.visit_parties p JOIN public.visitors v ON v.id=t.visitor_id WHERE p.visit_id=p_visit_id AND NOT p.is_primary;
 PERFORM set_config('centrim.attendance_sync','on',true);
 UPDATE public.visitors SET status=CASE WHEN remaining=0 THEN 'checked-out' ELSE 'checked-in' END,check_out_time=CASE WHEN remaining=0 THEN now() ELSE NULL END,
 additional_visitors=(SELECT count(*) FROM public.visit_parties WHERE visit_id=p_visit_id AND NOT is_primary AND check_out_time IS NULL),
 companion_details=coalesce(mirror,companion_details),checkout_reason='Kiosk code-verified departure' WHERE id=t.visitor_id;
 PERFORM set_config('centrim.attendance_sync','off',true);
 SELECT id INTO device FROM public.kiosk_devices WHERE token_hash=public.kiosk_hash(p_token);
 INSERT INTO public.audit_log(action,performed_by,records_affected,details) VALUES('kiosk_checkout_recorded','Kiosk (visitor code)',changed,jsonb_build_object('branch_id',b,'device_id',device,'visit_id',p_visit_id,'party_ids',p_party_ids,'remaining',remaining,'delivery_state','not_configured','message_sent',false));
 END IF;
 RETURN jsonb_build_object('saved',true,'departed',changed,'remaining',remaining);
END $$;
REVOKE ALL ON FUNCTION public.kioskd_checkout_submit(text,text,uuid,uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kioskd_checkout_submit(text,text,uuid,uuid[]) TO anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.kioskd_presence_list(p_token text)
RETURNS TABLE(id uuid, first_name text, surname text, type text, status text, check_in_time timestamptz, check_out_time timestamptz, whom_to_visit text, qr_code text, group_id uuid, additional_visitors integer, expected_return_date timestamptz, leave_type text, accompanied_by_name text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b uuid;
BEGIN
 b := public.kiosk_device_site(p_token,false);
 -- Compatibility exclusively for existing resident movement. Never return visitor codes/destinations.
 RETURN QUERY SELECT v.id,v.first_name,v.surname,v.type,v.status,v.check_in_time,v.check_out_time,NULL::text,NULL::text,NULL::uuid,0,v.expected_return_date,v.leave_type,v.accompanied_by_name
 FROM public.visitors v WHERE v.branch_id=b AND v.type='resident' AND v.status IN ('checked-in','checked-out') ORDER BY v.check_in_time DESC LIMIT 500;
END $$;
COMMENT ON FUNCTION public.kioskd_presence_list(text) IS 'Resident movement compatibility only; visitor directory access retired. Resident directory privacy remains a separately scoped review.';
REVOKE ALL ON FUNCTION public.kioskd_presence_list(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kioskd_presence_list(text) TO anon,authenticated,service_role;
REVOKE EXECUTE ON FUNCTION public.kiosk_presence_list(uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.kioskd_check_out(p_token text,p_visitor_id uuid,p_time timestamptz)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b uuid;
BEGIN
 b:=public.kiosk_device_site(p_token);
 IF NOT EXISTS(SELECT 1 FROM public.visitors WHERE id=p_visitor_id AND branch_id=b AND type='resident') THEN RAISE EXCEPTION 'use_verified_visitor_departure'; END IF;
 RETURN public.kiosk_check_out(p_visitor_id,p_time);
END $$;
REVOKE ALL ON FUNCTION public.kioskd_check_out(text,uuid,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kioskd_check_out(text,uuid,timestamptz) TO anon,authenticated,service_role;