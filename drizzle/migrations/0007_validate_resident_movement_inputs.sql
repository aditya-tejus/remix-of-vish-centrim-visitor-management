CREATE OR REPLACE FUNCTION public.validate_resident_movement_input(p_details jsonb) RETURNS void LANGUAGE plpgsql SET search_path=public AS $$
DECLARE k text; d jsonb:=coalesce(p_details,'{}'::jsonb);
BEGIN
 IF jsonb_typeof(d)<>'object' OR octet_length(d::text)>16000 THEN RAISE EXCEPTION 'invalid_movement_details'; END IF;
 FOR k IN SELECT jsonb_object_keys(d) LOOP
  IF k NOT IN ('recorded_time','expected_return','reason','leave_type','accompanied_by','accompanied_by_name','comments','return_notification_opt_in','companion_details') THEN RAISE EXCEPTION 'unsupported_movement_field'; END IF;
  IF k NOT IN ('return_notification_opt_in','companion_details') AND jsonb_typeof(d->k) NOT IN ('string','null') THEN RAISE EXCEPTION 'invalid_movement_field'; END IF;
  IF k NOT IN ('companion_details') AND length(d->>k)>4000 THEN RAISE EXCEPTION 'movement_field_too_long'; END IF;
 END LOOP;
 IF d ? 'return_notification_opt_in' AND jsonb_typeof(d->'return_notification_opt_in') NOT IN ('boolean','null') THEN RAISE EXCEPTION 'invalid_notification_preference'; END IF;
 IF d ? 'companion_details' THEN
  IF jsonb_typeof(d->'companion_details')<>'array' THEN RAISE EXCEPTION 'invalid_companions'; END IF;
  IF jsonb_array_length(d->'companion_details')>50 THEN RAISE EXCEPTION 'too_many_companions'; END IF;
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.validate_resident_movement_input(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.validate_resident_movement_input(jsonb) TO service_role;
CREATE OR REPLACE FUNCTION public.staff_resident_movement(p_site uuid,p_resident uuid,p_request uuid,p_action text,p_expected_status text,p_details jsonb DEFAULT '{}'::jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.visitors%ROWTYPE; actor uuid:=auth.uid(); result jsonb; stamp timestamptz:=now(); movement_time timestamptz; expected timestamptz; d jsonb:=coalesce(p_details,'{}'::jsonb); prior jsonb;
BEGIN
 IF actor IS NULL OR p_site IS NULL OR p_request IS NULL OR p_resident IS NULL OR p_action NOT IN ('leave','return') OR p_action IS NULL THEN RAISE EXCEPTION 'invalid_movement'; END IF;
 IF NOT public.user_can_access_site(p_site) OR NOT public.has_permission(actor,CASE WHEN p_action='leave' THEN 'checkout.perform'::public.app_permission ELSE 'checkin.create'::public.app_permission END) THEN RAISE EXCEPTION 'movement_not_permitted'; END IF;
 PERFORM public.validate_resident_movement_input(d);
 PERFORM pg_advisory_xact_lock(hashtextextended(actor::text||p_request::text,0));
 SELECT details INTO prior FROM public.audit_log WHERE user_id=actor AND action='resident_movement_recorded' AND details->>'request_id'=p_request::text ORDER BY created_at LIMIT 1;
 IF FOUND THEN
  IF prior->>'branch_id'<>p_site::text OR prior->>'resident_id'<>p_resident::text OR prior->>'movement'<>p_action OR prior->'submitted_details' IS DISTINCT FROM d THEN RAISE EXCEPTION 'request_mismatch'; END IF;
  RETURN prior->'result';
 END IF;
 SELECT * INTO v FROM public.visitors WHERE id=p_resident AND type='resident' AND (branch_id=p_site OR (branch_id IS NULL AND EXISTS(SELECT 1 FROM public.branches WHERE id=p_site AND is_legacy_placeholder))) FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'resident_not_at_site'; END IF;
 IF v.status IS DISTINCT FROM p_expected_status OR (p_action='return' AND v.status<>'checked-out') OR (p_action='leave' AND v.status='checked-out') THEN RAISE EXCEPTION 'movement_changed_refresh'; END IF;
 movement_time:=coalesce(nullif(d->>'recorded_time','')::timestamptz,stamp);
 IF movement_time>stamp+interval '1 minute' OR (p_action='return' AND v.check_out_time IS NOT NULL AND movement_time<v.check_out_time) THEN RAISE EXCEPTION 'invalid_movement_time'; END IF;
 expected:=nullif(d->>'expected_return','')::timestamptz;
 IF p_action='leave' AND expected IS NOT NULL AND expected<=movement_time THEN RAISE EXCEPTION 'invalid_expected_return'; END IF;
 IF p_action='leave' THEN
  UPDATE public.visitors SET status='checked-out',check_out_time=movement_time,expected_return_date=expected,checkout_reason=nullif(d->>'reason',''),leave_type=coalesce(nullif(d->>'leave_type',''),'Away'),accompanied_by=nullif(d->>'accompanied_by',''),accompanied_by_name=nullif(d->>'accompanied_by_name',''),comments=coalesce(nullif(d->>'comments',''),comments),return_notification_opt_in=coalesce((d->>'return_notification_opt_in')::boolean,false),companion_details=CASE WHEN d ? 'companion_details' THEN d->'companion_details' ELSE companion_details END,additional_visitors=CASE WHEN d ? 'companion_details' THEN jsonb_array_length(d->'companion_details') ELSE additional_visitors END WHERE id=v.id;
 ELSE
  UPDATE public.visitors SET status='checked-in',check_in_time=movement_time,check_out_time=NULL,expected_return_date=NULL,comments=CASE WHEN nullif(d->>'comments','') IS NULL THEN comments ELSE concat_ws(E'\n',nullif(comments,''),'Return: '||(d->>'comments')) END WHERE id=v.id;
 END IF;
 result:=jsonb_build_object('saved',true,'resident_id',v.id,'branch_id',p_site,'movement',p_action,'status',CASE WHEN p_action='leave' THEN 'checked-out' ELSE 'checked-in' END,'recorded_time',movement_time,'expected_return',CASE WHEN p_action='leave' THEN expected ELSE NULL END);
 INSERT INTO public.audit_log(action,user_id,performed_by,records_affected,details,change_reason) VALUES('resident_movement_recorded',actor,actor::text,1,jsonb_build_object('branch_id',p_site,'resident_id',v.id,'request_id',p_request,'movement',p_action,'submitted_details',d,'recorded_at',stamp,'evidence','staff_recorded_movement_not_physical_safety','message_sent',false,'delivery_state','not_configured','result',result),nullif(d->>'reason',''));
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.staff_resident_movement(uuid,uuid,uuid,text,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.staff_resident_movement(uuid,uuid,uuid,text,text,jsonb) TO authenticated,service_role;