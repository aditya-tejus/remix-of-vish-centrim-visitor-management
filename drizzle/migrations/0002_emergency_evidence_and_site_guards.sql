ALTER TABLE public.evacuation_attendance ADD COLUMN outcome text, ADD COLUMN confirmation_method text, ADD COLUMN confirmed_at timestamptz, ADD COLUMN confirmed_by uuid, ADD COLUMN presence_basis text, ADD COLUMN correction_reason text;
ALTER TABLE public.emergency_actions ADD COLUMN previous_outcome text, ADD COLUMN new_outcome text, ADD COLUMN confirmation_method text, ADD COLUMN confirmed_at timestamptz;
CREATE OR REPLACE FUNCTION public.emergency_is_accounted(p_status text,p_outcome text,p_method text,p_at timestamptz) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=public AS $$ SELECT CASE WHEN p_outcome IS NULL THEN p_status IN ('safe','safe_elsewhere','evacuated_offsite') WHEN p_outcome='physically_safe' THEN p_at IS NOT NULL AND p_method IN ('direct_sighting','staff_verification') WHEN p_outcome IN ('reported_safe','not_present_confirmed') THEN p_at IS NOT NULL AND p_method IN ('direct_sighting','staff_verification','self_report','remote_contact') ELSE false END $$;
REVOKE ALL ON FUNCTION public.emergency_is_accounted(text,text,text,timestamptz) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.emergency_is_accounted(text,text,text,timestamptz) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.validate_emergency_evidence() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d public.evacuation_drills%ROWTYPE; expected text;
BEGIN
 SELECT * INTO d FROM public.evacuation_drills WHERE id=NEW.drill_id FOR UPDATE;
 IF d.id IS NULL OR NEW.branch_id IS DISTINCT FROM d.branch_id THEN RAISE EXCEPTION 'Emergency site mismatch'; END IF;
 IF d.state IN ('resolved','reviewed') THEN RAISE EXCEPTION 'This emergency is closed'; END IF;
 IF auth.uid() IS NOT NULL AND (NOT public.user_can_access_site(d.branch_id) OR NOT public.has_permission(auth.uid(),'emergency.mark_safe')) THEN RAISE EXCEPTION 'Emergency permission denied'; END IF;
 IF TG_OP='UPDATE' THEN
  IF NEW.drill_id IS DISTINCT FROM OLD.drill_id OR NEW.branch_id IS DISTINCT FROM OLD.branch_id OR NEW.visitor_id IS DISTINCT FROM OLD.visitor_id OR NEW.parent_visitor_id IS DISTINCT FROM OLD.parent_visitor_id OR NEW.companion_index IS DISTINCT FROM OLD.companion_index OR NEW.presence_basis IS DISTINCT FROM OLD.presence_basis THEN RAISE EXCEPTION 'Emergency snapshot identity is immutable'; END IF;
  IF OLD.outcome IS NOT NULL AND NEW.outcome IS NULL THEN RAISE EXCEPTION 'Evidence cannot be removed; record a correction'; END IF;
  IF public.emergency_is_accounted(OLD.status,OLD.outcome,OLD.confirmation_method,OLD.confirmed_at) AND (NEW.status IS DISTINCT FROM OLD.status OR NEW.outcome IS DISTINCT FROM OLD.outcome OR NEW.confirmation_method IS DISTINCT FROM OLD.confirmation_method) AND coalesce(btrim(NEW.correction_reason),'')='' THEN RAISE EXCEPTION 'Correction reason required'; END IF;
 END IF;
 IF NEW.presence_basis IS NOT NULL AND NEW.presence_basis NOT IN ('snapshot','later_arrival','offsite_record') THEN RAISE EXCEPTION 'Invalid presence basis'; END IF;
 IF NEW.outcome IS NOT NULL THEN
  IF NEW.outcome NOT IN ('attendance_unverified','location_unconfirmed','physically_safe','reported_safe','not_present_confirmed','assistance_required','cannot_locate') THEN RAISE EXCEPTION 'Invalid outcome'; END IF;
  expected := CASE NEW.outcome WHEN 'physically_safe' THEN 'safe' WHEN 'reported_safe' THEN 'safe_elsewhere' WHEN 'not_present_confirmed' THEN 'evacuated_offsite' WHEN 'assistance_required' THEN 'assistance_required' WHEN 'cannot_locate' THEN 'not_located' ELSE 'unaccounted' END;
  IF NEW.status<>expected THEN RAISE EXCEPTION 'Outcome and legacy status mismatch'; END IF;
  IF NEW.outcome IN ('attendance_unverified','location_unconfirmed') THEN NEW.confirmation_method:=NULL; NEW.confirmed_at:=NULL; NEW.confirmed_by:=NULL;
  ELSE
   IF NEW.confirmation_method IS NULL OR NEW.confirmation_method NOT IN ('direct_sighting','staff_verification','self_report','remote_contact') THEN RAISE EXCEPTION 'Confirmation method required'; END IF;
   IF NEW.outcome='physically_safe' AND NEW.confirmation_method NOT IN ('direct_sighting','staff_verification') THEN RAISE EXCEPTION 'Physical safety requires direct sighting or staff physical verification'; END IF;
   IF TG_OP='INSERT' OR NEW.outcome IS DISTINCT FROM OLD.outcome OR NEW.confirmation_method IS DISTINCT FROM OLD.confirmation_method OR NEW.confirmed_at IS DISTINCT FROM OLD.confirmed_at THEN NEW.confirmed_at:=coalesce(NEW.confirmed_at,now()); NEW.confirmed_by:=auth.uid(); END IF;
  END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.validate_emergency_evidence() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER trg_validate_emergency_evidence BEFORE INSERT OR UPDATE ON public.evacuation_attendance FOR EACH ROW EXECUTE FUNCTION public.validate_emergency_evidence();
CREATE OR REPLACE FUNCTION public.record_emergency_action() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP='UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status AND NEW.outcome IS NOT DISTINCT FROM OLD.outcome AND NEW.confirmation_method IS NOT DISTINCT FROM OLD.confirmation_method AND NEW.confirmed_at IS NOT DISTINCT FROM OLD.confirmed_at THEN RETURN NEW; END IF;
 INSERT INTO public.emergency_actions(drill_id,attendance_id,person_name,action,previous_status,new_status,previous_outcome,new_outcome,confirmation_method,confirmed_at,reason,note,actor_user_id,actor_label,source)
 VALUES(NEW.drill_id,NEW.id,NEW.person_name,CASE WHEN TG_OP='INSERT' THEN 'seeded' WHEN coalesce(NEW.correction_reason,'')<>'' THEN 'correction' ELSE 'status_change' END,CASE WHEN TG_OP='UPDATE' THEN OLD.status END,NEW.status,CASE WHEN TG_OP='UPDATE' THEN OLD.outcome END,NEW.outcome,NEW.confirmation_method,NEW.confirmed_at,NEW.correction_reason,NEW.note,auth.uid(),coalesce(NEW.marked_by,auth.uid()::text,'Kiosk (PIN)'),CASE WHEN auth.uid() IS NULL THEN 'kiosk' ELSE 'staff_desktop' END);
 RETURN NEW;
END $$;
CREATE POLICY phase9c_attendance_insert_guard ON public.evacuation_attendance AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(public.user_can_access_site(branch_id) AND public.has_permission(auth.uid(),'emergency.mark_safe'));
CREATE POLICY phase9c_attendance_update_guard ON public.evacuation_attendance AS RESTRICTIVE FOR UPDATE TO authenticated USING(public.user_can_access_site(branch_id) AND public.has_permission(auth.uid(),'emergency.mark_safe')) WITH CHECK(public.user_can_access_site(branch_id) AND public.has_permission(auth.uid(),'emergency.mark_safe'));
CREATE POLICY phase9c_drill_insert_guard ON public.evacuation_drills AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(public.user_can_access_site(branch_id) AND public.has_permission(auth.uid(),'emergency.activate'));
CREATE POLICY phase9c_drill_update_guard ON public.evacuation_drills AS RESTRICTIVE FOR UPDATE TO authenticated USING(public.user_can_access_site(branch_id) AND public.has_permission(auth.uid(),'emergency.activate')) WITH CHECK(public.user_can_access_site(branch_id) AND public.has_permission(auth.uid(),'emergency.activate'));
CREATE POLICY phase9c_action_read_guard ON public.emergency_actions AS RESTRICTIVE FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.evacuation_drills d WHERE d.id=drill_id AND public.user_can_access_site(d.branch_id)));
CREATE OR REPLACE FUNCTION public.validate_emergency_close() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE total integer; accounted integer;
BEGIN
 IF OLD.state NOT IN ('resolved','reviewed') AND NEW.state IN ('resolved','reviewed') THEN
  SELECT count(*),count(*) FILTER(WHERE public.emergency_is_accounted(status,outcome,confirmation_method,confirmed_at)) INTO total,accounted FROM public.evacuation_attendance WHERE drill_id=NEW.id;
  IF (accounted<total OR NEW.event_class='real') AND coalesce(btrim(NEW.unaccounted_reason),'')='' THEN RAISE EXCEPTION 'Closing requires an outcome / unresolved reason'; END IF;
  NEW.total_people:=total; NEW.accounted_for:=accounted; NEW.ended_at:=coalesce(NEW.ended_at,now());
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.validate_emergency_close() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER trg_validate_emergency_close BEFORE UPDATE ON public.evacuation_drills FOR EACH ROW EXECUTE FUNCTION public.validate_emergency_close();
CREATE FUNCTION public.kioskd_emergency_rollcall_v2(p_token text,p_pin text) RETURNS TABLE(attendance_id uuid,drill_id uuid,drill_title text,drill_state text,event_class text,person_name text,person_type text,location_label text,contact_phone text,status text,assistance_level text,marked_safe_at timestamptz,outcome text,confirmation_method text,confirmed_at timestamptz,presence_basis text) LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE site uuid;
BEGIN
 site:=public.kiosk_device_site(p_token); PERFORM public.kiosk_emergency_gate(p_pin,'rollcall');
 RETURN QUERY SELECT a.id,d.id,d.title,d.state,d.event_class,a.person_name,a.person_type,concat_ws(' / ',a.area_label,a.room_label),a.contact_phone,a.status,a.assistance_level,a.marked_safe_at,a.outcome,a.confirmation_method,a.confirmed_at,a.presence_basis FROM public.evacuation_attendance a JOIN public.evacuation_drills d ON d.id=a.drill_id WHERE d.branch_id=site AND d.state IN ('active','paused') ORDER BY a.person_name LIMIT 2000;
END $$;
CREATE FUNCTION public.kioskd_emergency_mark_v2(p_token text,p_pin text,p_attendance_id uuid,p_outcome text,p_method text DEFAULT NULL,p_reason text DEFAULT NULL) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE site uuid;
BEGIN
 site:=public.kiosk_device_site(p_token); PERFORM public.kiosk_emergency_gate(p_pin,'mark');
 IF NOT EXISTS(SELECT 1 FROM public.evacuation_attendance a JOIN public.evacuation_drills d ON d.id=a.drill_id WHERE a.id=p_attendance_id AND a.branch_id=site AND d.branch_id=site AND d.state IN ('active','paused')) THEN RAISE EXCEPTION 'Emergency unavailable at this device site or closed'; END IF;
 UPDATE public.evacuation_attendance SET outcome=p_outcome,status=CASE p_outcome WHEN 'physically_safe' THEN 'safe' WHEN 'reported_safe' THEN 'safe_elsewhere' WHEN 'not_present_confirmed' THEN 'evacuated_offsite' WHEN 'assistance_required' THEN 'assistance_required' WHEN 'cannot_locate' THEN 'not_located' ELSE 'unaccounted' END,confirmation_method=p_method,confirmed_at=now(),marked_safe_at=CASE WHEN p_outcome='physically_safe' THEN now() END,marked_by='Kiosk (PIN)',correction_reason=p_reason WHERE id=p_attendance_id;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.kioskd_emergency_rollcall_v2(text,text),public.kioskd_emergency_mark_v2(text,text,uuid,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kioskd_emergency_rollcall_v2(text,text),public.kioskd_emergency_mark_v2(text,text,uuid,text,text,text) TO anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.kioskd_emergency_rollcall(p_token text,p_pin text) RETURNS TABLE(attendance_id uuid,drill_id uuid,drill_title text,drill_state text,event_class text,person_name text,person_type text,location_label text,contact_phone text,status text,assistance_level text,marked_safe_at timestamptz) LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT attendance_id,drill_id,drill_title,drill_state,event_class,person_name,person_type,location_label,contact_phone,status,assistance_level,marked_safe_at FROM public.kioskd_emergency_rollcall_v2(p_token,p_pin) $$;
CREATE OR REPLACE FUNCTION public.kioskd_emergency_mark(p_token text,p_pin text,p_attendance_id uuid,p_status text,p_marked_by text,p_reason text DEFAULT NULL) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE site uuid;
BEGIN
 site:=public.kiosk_device_site(p_token);
 IF NOT EXISTS(SELECT 1 FROM public.evacuation_attendance a JOIN public.evacuation_drills d ON d.id=a.drill_id WHERE a.id=p_attendance_id AND a.branch_id=site AND d.branch_id=site) THEN RAISE EXCEPTION 'Emergency site mismatch'; END IF;
 RETURN public.kiosk_emergency_mark(p_pin,p_attendance_id,p_status,p_marked_by,p_reason);
END $$;
REVOKE EXECUTE ON FUNCTION public.kiosk_emergency_rollcall(text),public.kiosk_emergency_mark(text,uuid,text,text,text) FROM PUBLIC,anon,authenticated;
COMMENT ON COLUMN public.evacuation_attendance.outcome IS 'Phase 9C evidence-based outcome; NULL preserves legacy status without asserting physical verification';