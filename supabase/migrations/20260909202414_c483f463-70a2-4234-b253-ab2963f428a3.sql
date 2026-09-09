
-- ---------------------------------------------------------------- helpers

CREATE OR REPLACE FUNCTION public.kiosk_hash(p_value text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT encode(extensions.digest(p_value, 'sha256'), 'hex')
$$;
REVOKE EXECUTE ON FUNCTION public.kiosk_hash(text) FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.kiosk_random_code()
RETURNS text LANGUAGE plpgsql VOLATILE SET search_path = public AS $$
DECLARE alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; out text := ''; i int;
BEGIN
  FOR i IN 1..12 LOOP
    out := out || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  END LOOP;
  RETURN out;
END $$;
REVOKE EXECUTE ON FUNCTION public.kiosk_random_code() FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.kiosk_device_event(p_device uuid, p_branch uuid, p_event text, p_detail jsonb DEFAULT NULL)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.kiosk_device_events(device_id, branch_id, event, actor_user_id, detail)
  VALUES (p_device, p_branch, p_event, auth.uid(), p_detail)
$$;
REVOKE EXECUTE ON FUNCTION public.kiosk_device_event(uuid, uuid, text, jsonb) FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.kiosk_require_admin(p_branch uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_permission(auth.uid(), 'settings.administer') THEN
    RAISE EXCEPTION 'not_permitted';
  END IF;
  IF p_branch IS NOT NULL AND NOT public.user_can_access_site(p_branch) THEN
    RAISE EXCEPTION 'site_not_permitted';
  END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.kiosk_require_admin(uuid) FROM anon;

-- Issues a fresh single-use activation code for a device. Returns the plain code once.
CREATE OR REPLACE FUNCTION public.kiosk_issue_code(p_device_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_branch uuid; v_code text;
BEGIN
  SELECT branch_id INTO v_branch FROM public.kiosk_devices WHERE id = p_device_id;
  IF v_branch IS NULL THEN RAISE EXCEPTION 'device_not_found'; END IF;
  PERFORM public.kiosk_require_admin(v_branch);
  v_code := public.kiosk_random_code();
  UPDATE public.kiosk_activation_codes SET used_at = COALESCE(used_at, now())
    WHERE device_id = p_device_id AND used_at IS NULL;
  INSERT INTO public.kiosk_activation_codes(device_id, code_hash, expires_at, created_by)
    VALUES (p_device_id, public.kiosk_hash(v_code), now() + interval '15 minutes', auth.uid());
  UPDATE public.kiosk_devices
     SET status = CASE WHEN status = 'revoked' THEN 'revoked' ELSE 'pending' END,
         token_hash = NULL, token_prefix = NULL, token_issued_at = NULL, token_expires_at = NULL
   WHERE id = p_device_id AND status <> 'revoked';
  PERFORM public.kiosk_device_event(p_device_id, v_branch, 'code_issued', NULL);
  RETURN v_code;
END $$;
REVOKE EXECUTE ON FUNCTION public.kiosk_issue_code(uuid) FROM anon;

CREATE OR REPLACE FUNCTION public.kiosk_provision_device(p_branch_id uuid, p_name text)
RETURNS TABLE(device_id uuid, activation_code text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  PERFORM public.kiosk_require_admin(p_branch_id);
  IF coalesce(trim(p_name), '') = '' THEN RAISE EXCEPTION 'name_required'; END IF;
  INSERT INTO public.kiosk_devices(branch_id, name, status, created_by)
    VALUES (p_branch_id, trim(p_name), 'pending', auth.uid())
    RETURNING id INTO v_id;
  PERFORM public.kiosk_device_event(v_id, p_branch_id, 'provisioned', jsonb_build_object('name', trim(p_name)));
  RETURN QUERY SELECT v_id, public.kiosk_issue_code(v_id);
END $$;
REVOKE EXECUTE ON FUNCTION public.kiosk_provision_device(uuid, text) FROM anon;

CREATE OR REPLACE FUNCTION public.kiosk_rename_device(p_device_id uuid, p_name text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_branch uuid;
BEGIN
  SELECT branch_id INTO v_branch FROM public.kiosk_devices WHERE id = p_device_id;
  IF v_branch IS NULL THEN RAISE EXCEPTION 'device_not_found'; END IF;
  PERFORM public.kiosk_require_admin(v_branch);
  IF coalesce(trim(p_name), '') = '' THEN RAISE EXCEPTION 'name_required'; END IF;
  UPDATE public.kiosk_devices SET name = trim(p_name) WHERE id = p_device_id;
  PERFORM public.kiosk_device_event(p_device_id, v_branch, 'renamed', jsonb_build_object('name', trim(p_name)));
END $$;
REVOKE EXECUTE ON FUNCTION public.kiosk_rename_device(uuid, text) FROM anon;

CREATE OR REPLACE FUNCTION public.kiosk_set_device_status(p_device_id uuid, p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_branch uuid;
BEGIN
  IF p_status NOT IN ('active', 'suspended', 'revoked') THEN RAISE EXCEPTION 'bad_status'; END IF;
  SELECT branch_id INTO v_branch FROM public.kiosk_devices WHERE id = p_device_id;
  IF v_branch IS NULL THEN RAISE EXCEPTION 'device_not_found'; END IF;
  PERFORM public.kiosk_require_admin(v_branch);
  IF p_status = 'revoked' THEN
    UPDATE public.kiosk_devices
       SET status = 'revoked', token_hash = NULL, token_prefix = NULL,
           token_expires_at = NULL, revoked_by = auth.uid(), revoked_at = now()
     WHERE id = p_device_id;
    UPDATE public.kiosk_activation_codes SET used_at = COALESCE(used_at, now())
     WHERE device_id = p_device_id AND used_at IS NULL;
    PERFORM public.kiosk_device_event(p_device_id, v_branch, 'revoked', NULL);
  ELSIF p_status = 'suspended' THEN
    UPDATE public.kiosk_devices SET status = 'suspended' WHERE id = p_device_id AND status = 'active';
    PERFORM public.kiosk_device_event(p_device_id, v_branch, 'suspended', NULL);
  ELSE
    UPDATE public.kiosk_devices SET status = 'active' WHERE id = p_device_id AND status = 'suspended';
    PERFORM public.kiosk_device_event(p_device_id, v_branch, 'resumed', NULL);
  END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.kiosk_set_device_status(uuid, text) FROM anon;

-- Rotation: the current key stops working immediately and a fresh code is issued.
CREATE OR REPLACE FUNCTION public.kiosk_rotate_token(p_device_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_branch uuid; v_code text;
BEGIN
  SELECT branch_id INTO v_branch FROM public.kiosk_devices WHERE id = p_device_id;
  IF v_branch IS NULL THEN RAISE EXCEPTION 'device_not_found'; END IF;
  PERFORM public.kiosk_require_admin(v_branch);
  v_code := public.kiosk_issue_code(p_device_id);
  PERFORM public.kiosk_device_event(p_device_id, v_branch, 'rotated', NULL);
  RETURN v_code;
END $$;
REVOKE EXECUTE ON FUNCTION public.kiosk_rotate_token(uuid) FROM anon;

-- Replacement: the old device is turned off for good and a new device record is created.
CREATE OR REPLACE FUNCTION public.kiosk_replace_device(p_device_id uuid, p_name text DEFAULT NULL)
RETURNS TABLE(device_id uuid, activation_code text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_branch uuid; v_name text; v_new uuid;
BEGIN
  SELECT branch_id, name INTO v_branch, v_name FROM public.kiosk_devices WHERE id = p_device_id;
  IF v_branch IS NULL THEN RAISE EXCEPTION 'device_not_found'; END IF;
  PERFORM public.kiosk_require_admin(v_branch);
  PERFORM public.kiosk_set_device_status(p_device_id, 'revoked');
  INSERT INTO public.kiosk_devices(branch_id, name, status, created_by, notes)
    VALUES (v_branch, COALESCE(NULLIF(trim(p_name), ''), v_name), 'pending', auth.uid(),
            'Replaces ' || p_device_id::text)
    RETURNING id INTO v_new;
  PERFORM public.kiosk_device_event(v_new, v_branch, 'replaced', jsonb_build_object('replaces', p_device_id));
  RETURN QUERY SELECT v_new, public.kiosk_issue_code(v_new);
END $$;
REVOKE EXECUTE ON FUNCTION public.kiosk_replace_device(uuid, text) FROM anon;

-- ------------------------------------------------------------- activation

CREATE OR REPLACE FUNCTION public.kiosk_activate(p_code text, p_version text DEFAULT NULL)
RETURNS TABLE(token text, device_id uuid, branch_id uuid, site_name text, device_name text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.kiosk_activation_codes%ROWTYPE; v_dev public.kiosk_devices%ROWTYPE;
        v_token text; v_recent int;
BEGIN
  SELECT count(*) INTO v_recent FROM public.kiosk_device_events
    WHERE event = 'activation_failed' AND created_at > now() - interval '1 hour';
  IF v_recent >= 20 THEN RAISE EXCEPTION 'too_many_attempts'; END IF;

  SELECT * INTO v_row FROM public.kiosk_activation_codes
    WHERE code_hash = public.kiosk_hash(upper(coalesce(trim(p_code), '')))
    FOR UPDATE;

  IF v_row.id IS NULL THEN
    PERFORM public.kiosk_device_event(NULL, NULL, 'activation_failed', jsonb_build_object('reason', 'unknown_code'));
    RAISE EXCEPTION 'activation_failed';
  END IF;

  UPDATE public.kiosk_activation_codes SET attempts = attempts + 1 WHERE id = v_row.id;
  SELECT * INTO v_dev FROM public.kiosk_devices WHERE id = v_row.device_id FOR UPDATE;

  IF v_row.attempts + 1 > 5 OR v_row.used_at IS NOT NULL OR v_row.expires_at < now()
     OR v_dev.id IS NULL OR v_dev.status = 'revoked' THEN
    PERFORM public.kiosk_device_event(v_row.device_id, v_dev.branch_id, 'activation_failed',
      jsonb_build_object('reason', CASE
        WHEN v_row.used_at IS NOT NULL THEN 'already_used'
        WHEN v_row.expires_at < now() THEN 'expired'
        WHEN v_dev.status = 'revoked' THEN 'device_revoked'
        ELSE 'too_many_attempts' END));
    RAISE EXCEPTION 'activation_failed';
  END IF;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  UPDATE public.kiosk_activation_codes SET used_at = now() WHERE id = v_row.id;
  UPDATE public.kiosk_devices
     SET status = 'active', token_hash = public.kiosk_hash(v_token),
         token_prefix = left(v_token, 8), token_issued_at = now(),
         token_expires_at = now() + interval '365 days',
         last_seen_at = now(), last_seen_version = p_version
   WHERE id = v_dev.id;
  PERFORM public.kiosk_device_event(v_dev.id, v_dev.branch_id, 'activated', jsonb_build_object('version', p_version));

  RETURN QUERY
    SELECT v_token, v_dev.id, v_dev.branch_id, b.name, v_dev.name
      FROM public.branches b WHERE b.id = v_dev.branch_id;
END $$;
GRANT EXECUTE ON FUNCTION public.kiosk_activate(text, text) TO anon, authenticated;

-- Resolves a device key to its site. Raises for unknown, paused, revoked or expired keys.
CREATE OR REPLACE FUNCTION public.kiosk_device_site(p_token text, p_touch boolean DEFAULT true)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_dev public.kiosk_devices%ROWTYPE;
BEGIN
  IF coalesce(p_token, '') = '' THEN RAISE EXCEPTION 'device_not_bound'; END IF;
  SELECT * INTO v_dev FROM public.kiosk_devices WHERE token_hash = public.kiosk_hash(p_token);
  IF v_dev.id IS NULL THEN
    PERFORM public.kiosk_device_event(NULL, NULL, 'auth_failed', jsonb_build_object('reason', 'unknown_device'));
    RAISE EXCEPTION 'device_not_recognised';
  END IF;
  IF v_dev.status <> 'active' THEN
    PERFORM public.kiosk_device_event(v_dev.id, v_dev.branch_id, 'auth_failed', jsonb_build_object('reason', v_dev.status));
    RAISE EXCEPTION 'device_%', v_dev.status;
  END IF;
  IF v_dev.token_expires_at IS NOT NULL AND v_dev.token_expires_at < now() THEN
    PERFORM public.kiosk_device_event(v_dev.id, v_dev.branch_id, 'auth_failed', jsonb_build_object('reason', 'expired'));
    RAISE EXCEPTION 'device_expired';
  END IF;
  IF p_touch THEN
    UPDATE public.kiosk_devices SET last_seen_at = now() WHERE id = v_dev.id;
  END IF;
  RETURN v_dev.branch_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.kiosk_device_site(text, boolean) FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.kiosk_device_context(p_token text, p_version text DEFAULT NULL)
RETURNS TABLE(device_id uuid, branch_id uuid, site_name text, device_name text, jurisdiction text, status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_branch uuid;
BEGIN
  v_branch := public.kiosk_device_site(p_token);
  UPDATE public.kiosk_devices SET last_seen_version = COALESCE(p_version, last_seen_version)
   WHERE token_hash = public.kiosk_hash(p_token);
  RETURN QUERY
    SELECT d.id, d.branch_id, b.name, d.name, b.jurisdiction, d.status
      FROM public.kiosk_devices d JOIN public.branches b ON b.id = d.branch_id
     WHERE d.token_hash = public.kiosk_hash(p_token);
END $$;
GRANT EXECUTE ON FUNCTION public.kiosk_device_context(text, text) TO anon, authenticated;

-- --------------------------------------------------- device-bound wrappers

CREATE OR REPLACE FUNCTION public.kioskd_check_in(p_token text, p_payload jsonb)
RETURNS TABLE(visitor_id uuid, qr_code text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_branch uuid;
BEGIN
  v_branch := public.kiosk_device_site(p_token);
  UPDATE public.kiosk_devices SET last_checkin_at = now() WHERE token_hash = public.kiosk_hash(p_token);
  RETURN QUERY SELECT * FROM public.kiosk_check_in(
    (p_payload - 'branch_id') || jsonb_build_object('branch_id', v_branch));
END $$;
GRANT EXECUTE ON FUNCTION public.kioskd_check_in(text, jsonb) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.kioskd_check_out(p_token text, p_visitor_id uuid, p_time timestamptz)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_branch uuid;
BEGIN
  v_branch := public.kiosk_device_site(p_token);
  IF NOT EXISTS (SELECT 1 FROM public.visitors v WHERE v.id = p_visitor_id AND v.branch_id = v_branch) THEN
    RAISE EXCEPTION 'not_at_this_site';
  END IF;
  RETURN public.kiosk_check_out(p_visitor_id, p_time);
END $$;
GRANT EXECUTE ON FUNCTION public.kioskd_check_out(text, uuid, timestamptz) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.kioskd_presence_list(p_token text)
RETURNS TABLE(id uuid, first_name text, surname text, type text, status text, check_in_time timestamptz,
              check_out_time timestamptz, whom_to_visit text, qr_code text, group_id uuid,
              additional_visitors integer, expected_return_date timestamptz, leave_type text,
              accompanied_by_name text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY SELECT * FROM public.kiosk_presence_list(public.kiosk_device_site(p_token));
END $$;
GRANT EXECUTE ON FUNCTION public.kioskd_presence_list(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.kioskd_resident_directory(p_token text, p_search text DEFAULT NULL)
RETURNS TABLE(visitor_id uuid, first_name text, surname text, room text, area_name text, status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY SELECT * FROM public.kiosk_resident_directory(p_search, public.kiosk_device_site(p_token));
END $$;
GRANT EXECUTE ON FUNCTION public.kioskd_resident_directory(text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.kioskd_staff_directory(p_token text, p_search text DEFAULT NULL)
RETURNS TABLE(id uuid, first_name text, surname text, department text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY SELECT * FROM public.kiosk_staff_directory(p_search, public.kiosk_device_site(p_token));
END $$;
GRANT EXECUTE ON FUNCTION public.kioskd_staff_directory(text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.kioskd_supplier_directory(p_token text)
RETURNS TABLE(id uuid, name text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY SELECT * FROM public.kiosk_supplier_directory(public.kiosk_device_site(p_token));
END $$;
GRANT EXECUTE ON FUNCTION public.kioskd_supplier_directory(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.kioskd_returning_lookup(p_token text, p_first text DEFAULT NULL,
  p_last text DEFAULT NULL, p_mobile text DEFAULT NULL, p_qr text DEFAULT NULL)
RETURNS TABLE(first_name text, surname text, email text, mobile text, address text, whom_to_visit text,
              visited_resident_ids uuid[], person_qr text, last_visit timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY SELECT * FROM public.kiosk_returning_lookup(p_first, p_last, p_mobile, p_qr,
    public.kiosk_device_site(p_token));
END $$;
GRANT EXECUTE ON FUNCTION public.kioskd_returning_lookup(text, text, text, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.kioskd_contractor_lookup(p_token text, p_mobile text DEFAULT NULL,
  p_qr text DEFAULT NULL, p_first text DEFAULT NULL, p_last text DEFAULT NULL)
RETURNS TABLE(person_id uuid, first_name text, surname text, supplier_id uuid, supplier_name text,
              outstanding_credentials text[])
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY SELECT * FROM public.kiosk_contractor_lookup(p_mobile, p_qr, p_first, p_last,
    public.kiosk_device_site(p_token));
END $$;
GRANT EXECUTE ON FUNCTION public.kioskd_contractor_lookup(text, text, text, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.kioskd_watchlist_check(p_token text, p_first text, p_last text)
RETURNS TABLE(is_match boolean, alert_type text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY SELECT * FROM public.kiosk_watchlist_check(p_first, p_last, public.kiosk_device_site(p_token));
END $$;
GRANT EXECUTE ON FUNCTION public.kioskd_watchlist_check(text, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.kioskd_prefill_visitor(p_token text, p_first text, p_last text)
RETURNS TABLE(email text, mobile text, address text, whom_to_visit text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.kiosk_device_site(p_token);
  RETURN QUERY SELECT * FROM public.kiosk_prefill_visitor(p_first, p_last);
END $$;
GRANT EXECUTE ON FUNCTION public.kioskd_prefill_visitor(text, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.kioskd_open_key_holds(p_token text, p_person_qr text)
RETURNS TABLE(open_items integer, overdue_items integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.kiosk_device_site(p_token);
  RETURN QUERY SELECT * FROM public.kiosk_open_key_holds(p_person_qr);
END $$;
GRANT EXECUTE ON FUNCTION public.kioskd_open_key_holds(text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.kioskd_resident_leave(p_token text, p_visitor_id uuid, p_time timestamptz,
  p_leave_type text DEFAULT NULL, p_expected_return timestamptz DEFAULT NULL,
  p_accompanied_by_name text DEFAULT NULL, p_reason text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_branch uuid;
BEGIN
  v_branch := public.kiosk_device_site(p_token);
  IF NOT EXISTS (SELECT 1 FROM public.visitors v WHERE v.id = p_visitor_id AND v.branch_id = v_branch) THEN
    RAISE EXCEPTION 'not_at_this_site';
  END IF;
  RETURN public.kiosk_resident_leave(p_visitor_id, p_time, p_leave_type, p_expected_return,
    p_accompanied_by_name, p_reason);
END $$;
GRANT EXECUTE ON FUNCTION public.kioskd_resident_leave(text, uuid, timestamptz, text, timestamptz, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.kioskd_resident_return(p_token text, p_visitor_id uuid, p_time timestamptz)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_branch uuid;
BEGIN
  v_branch := public.kiosk_device_site(p_token);
  IF NOT EXISTS (SELECT 1 FROM public.visitors v WHERE v.id = p_visitor_id AND v.branch_id = v_branch) THEN
    RAISE EXCEPTION 'not_at_this_site';
  END IF;
  RETURN public.kiosk_resident_return(p_visitor_id, p_time);
END $$;
GRANT EXECUTE ON FUNCTION public.kioskd_resident_return(text, uuid, timestamptz) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.kioskd_log_event(p_token text, p_purpose text, p_outcome text, p_detail text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.kiosk_log_event(p_purpose, p_outcome, public.kiosk_device_site(p_token, false), p_detail);
END $$;
GRANT EXECUTE ON FUNCTION public.kioskd_log_event(text, text, text, text) TO anon, authenticated;

-- Emergency roll call: still gated by the staff PIN, now also by the bound device.
CREATE OR REPLACE FUNCTION public.kioskd_emergency_rollcall(p_token text, p_pin text)
RETURNS TABLE(attendance_id uuid, drill_id uuid, drill_title text, drill_state text, event_class text,
              person_name text, person_type text, location_label text, contact_phone text, status text,
              assistance_level text, marked_safe_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.kiosk_device_site(p_token);
  RETURN QUERY SELECT * FROM public.kiosk_emergency_rollcall(p_pin);
END $$;
GRANT EXECUTE ON FUNCTION public.kioskd_emergency_rollcall(text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.kioskd_emergency_progress(p_token text, p_pin text)
RETURNS TABLE(total integer, accounted integer, outstanding integer, drill_title text, event_class text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.kiosk_device_site(p_token);
  RETURN QUERY SELECT * FROM public.kiosk_emergency_progress(p_pin);
END $$;
GRANT EXECUTE ON FUNCTION public.kioskd_emergency_progress(text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.kioskd_emergency_mark(p_token text, p_pin text, p_attendance_id uuid,
  p_status text, p_marked_by text, p_reason text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.kiosk_device_site(p_token);
  RETURN public.kiosk_emergency_mark(p_pin, p_attendance_id, p_status, p_marked_by, p_reason);
END $$;
GRANT EXECUTE ON FUNCTION public.kioskd_emergency_mark(text, text, uuid, text, text, text) TO anon, authenticated;
