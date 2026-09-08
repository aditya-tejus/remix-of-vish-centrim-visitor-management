-- ============================================================
-- STAGE 1D: access control + kiosk safety
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ---------- 0. fix security definer view from previous migration ----------
ALTER VIEW public.v_legacy_visitor_visits SET (security_invoker = true);

-- ---------- 1. REMOVE BROAD ANONYMOUS / PUBLIC ACCESS ----------
DROP POLICY IF EXISTS "Anyone can read visitors" ON public.visitors;
DROP POLICY IF EXISTS "Kiosk can read visitors" ON public.visitors;
DROP POLICY IF EXISTS "Kiosk can check out visitors" ON public.visitors;
DROP POLICY IF EXISTS "Kiosk can update visitors" ON public.visitors;
DROP POLICY IF EXISTS "Anyone can read resident details" ON public.resident_details;
DROP POLICY IF EXISTS "Anyone can insert resident details" ON public.resident_details;
DROP POLICY IF EXISTS "Anyone can read staff members" ON public.staff_members;
DROP POLICY IF EXISTS "Anyone can read suppliers" ON public.suppliers_min;
DROP POLICY IF EXISTS "Anyone can view supplier credentials" ON public.supplier_credentials;
DROP POLICY IF EXISTS "Kiosk can read contractor people" ON public.contractor_people;
DROP POLICY IF EXISTS "Kiosk can update contractor people" ON public.contractor_people;
DROP POLICY IF EXISTS "Kiosk can read contractor credentials" ON public.contractor_credentials;
DROP POLICY IF EXISTS "Kiosk can update contractor credentials" ON public.contractor_credentials;
DROP POLICY IF EXISTS "Anyone can read watchlist" ON public.visitor_watchlist;
DROP POLICY IF EXISTS "Anyone can read leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Anyone can insert leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Anyone can read feedback responses" ON public.feedback_responses;
DROP POLICY IF EXISTS "Anyone can read evacuation attendance" ON public.evacuation_attendance;
DROP POLICY IF EXISTS "Kiosk can read attendance" ON public.evacuation_attendance;
DROP POLICY IF EXISTS "Kiosk can seed attendance" ON public.evacuation_attendance;
DROP POLICY IF EXISTS "Kiosk can mark attendance" ON public.evacuation_attendance;
DROP POLICY IF EXISTS "Anyone can read evacuation drills" ON public.evacuation_drills;
DROP POLICY IF EXISTS "Kiosk can read drills" ON public.evacuation_drills;
DROP POLICY IF EXISTS "Kiosk can start drills" ON public.evacuation_drills;
DROP POLICY IF EXISTS "Kiosk can update drills" ON public.evacuation_drills;
DROP POLICY IF EXISTS "Anyone can read branch notification settings" ON public.branch_notification_settings;

REVOKE SELECT ON public.visitors, public.resident_details, public.staff_members,
  public.suppliers_min, public.supplier_credentials, public.contractor_people,
  public.contractor_credentials, public.visitor_watchlist, public.leave_requests,
  public.feedback_responses, public.evacuation_drills, public.evacuation_attendance,
  public.branch_notification_settings, public.key_issues, public.property_keys,
  public.food_register, public.resident_incidents FROM anon;
REVOKE UPDATE ON public.contractor_people, public.contractor_credentials,
  public.evacuation_drills, public.evacuation_attendance FROM anon;

-- ---------- 2. AUTHENTICATED, SITE-SCOPED STAFF ACCESS ----------
DROP POLICY IF EXISTS "Staff can read visitors in their sites" ON public.visitors;
CREATE POLICY "Staff can read visitors in their sites" ON public.visitors
  FOR SELECT TO authenticated USING (public.user_can_access_site(branch_id));
DROP POLICY IF EXISTS "Staff can write visitors in their sites" ON public.visitors;
CREATE POLICY "Staff can write visitors in their sites" ON public.visitors
  FOR UPDATE TO authenticated USING (public.user_can_access_site(branch_id))
  WITH CHECK (public.user_can_access_site(branch_id));

DROP POLICY IF EXISTS "Staff read resident details in their sites" ON public.resident_details;
CREATE POLICY "Staff read resident details in their sites" ON public.resident_details
  FOR SELECT TO authenticated USING (public.user_can_access_site(branch_id));
DROP POLICY IF EXISTS "Staff write resident details in their sites" ON public.resident_details;
CREATE POLICY "Staff write resident details in their sites" ON public.resident_details
  FOR INSERT TO authenticated WITH CHECK (public.user_can_access_site(branch_id));

DROP POLICY IF EXISTS "Staff read staff members in their sites" ON public.staff_members;
CREATE POLICY "Staff read staff members in their sites" ON public.staff_members
  FOR SELECT TO authenticated USING (public.user_can_access_site(branch_id));

DROP POLICY IF EXISTS "Staff read suppliers" ON public.suppliers_min;
CREATE POLICY "Staff read suppliers" ON public.suppliers_min
  FOR SELECT TO authenticated USING (public.user_can_access_site(branch_id));
DROP POLICY IF EXISTS "Staff read supplier credentials" ON public.supplier_credentials;
CREATE POLICY "Staff read supplier credentials" ON public.supplier_credentials
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Staff read contractor people" ON public.contractor_people;
CREATE POLICY "Staff read contractor people" ON public.contractor_people
  FOR SELECT TO authenticated USING (public.user_can_access_site(branch_id));
DROP POLICY IF EXISTS "Staff update contractor people" ON public.contractor_people;
CREATE POLICY "Staff update contractor people" ON public.contractor_people
  FOR UPDATE TO authenticated USING (public.user_can_access_site(branch_id))
  WITH CHECK (public.user_can_access_site(branch_id));

DROP POLICY IF EXISTS "Staff read contractor credentials" ON public.contractor_credentials;
CREATE POLICY "Staff read contractor credentials" ON public.contractor_credentials
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Staff update contractor credentials" ON public.contractor_credentials;
CREATE POLICY "Staff update contractor credentials" ON public.contractor_credentials
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Staff read watchlist in their sites" ON public.visitor_watchlist;
CREATE POLICY "Staff read watchlist in their sites" ON public.visitor_watchlist
  FOR SELECT TO authenticated USING (public.user_can_access_site(branch_id));

DROP POLICY IF EXISTS "Staff read leave requests in their sites" ON public.leave_requests;
CREATE POLICY "Staff read leave requests in their sites" ON public.leave_requests
  FOR SELECT TO authenticated USING (public.user_can_access_site(branch_id));
DROP POLICY IF EXISTS "Staff insert leave requests in their sites" ON public.leave_requests;
CREATE POLICY "Staff insert leave requests in their sites" ON public.leave_requests
  FOR INSERT TO authenticated WITH CHECK (public.user_can_access_site(branch_id));

DROP POLICY IF EXISTS "Staff read feedback responses" ON public.feedback_responses;
CREATE POLICY "Staff read feedback responses" ON public.feedback_responses
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Staff read drills in their sites" ON public.evacuation_drills;
CREATE POLICY "Staff read drills in their sites" ON public.evacuation_drills
  FOR SELECT TO authenticated USING (public.user_can_access_site(branch_id));
DROP POLICY IF EXISTS "Staff read attendance in their sites" ON public.evacuation_attendance;
CREATE POLICY "Staff read attendance in their sites" ON public.evacuation_attendance
  FOR SELECT TO authenticated USING (public.user_can_access_site(branch_id));

DROP POLICY IF EXISTS "Staff read branch notification settings" ON public.branch_notification_settings;
CREATE POLICY "Staff read branch notification settings" ON public.branch_notification_settings
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

-- ---------- 3. NARROW KIOSK RPCs (minimum fields only) ----------
CREATE OR REPLACE FUNCTION public.kiosk_resident_directory(p_search text DEFAULT NULL)
RETURNS TABLE(visitor_id uuid, first_name text, surname text, room text, area_name text, status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT v.id, v.first_name, v.surname, rd.room, w.name, v.status
  FROM public.visitors v
  LEFT JOIN public.resident_details rd ON rd.visitor_id = v.id
  LEFT JOIN public.wings w ON w.id = rd.wing_id
  WHERE v.type = 'resident'
    AND (coalesce(btrim(p_search),'') = ''
         OR v.first_name ILIKE '%'||btrim(p_search)||'%'
         OR v.surname ILIKE '%'||btrim(p_search)||'%'
         OR coalesce(rd.room,'') ILIKE '%'||btrim(p_search)||'%')
  ORDER BY v.first_name
  LIMIT 300;
$$;

CREATE OR REPLACE FUNCTION public.kiosk_staff_directory(p_search text DEFAULT NULL)
RETURNS TABLE(id uuid, first_name text, surname text, department text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT s.id, s.first_name, s.surname, s.department
  FROM public.staff_members s
  WHERE s.is_active
    AND (coalesce(btrim(p_search),'') = ''
         OR s.first_name ILIKE '%'||btrim(p_search)||'%'
         OR s.surname ILIKE '%'||btrim(p_search)||'%'
         OR coalesce(s.department,'') ILIKE '%'||btrim(p_search)||'%')
  ORDER BY s.first_name LIMIT 300;
$$;

-- presence: only people currently on site (plus residents currently away), minimal fields
CREATE OR REPLACE FUNCTION public.kiosk_presence_list()
RETURNS TABLE(id uuid, first_name text, surname text, type text, status text,
              check_in_time timestamptz, check_out_time timestamptz, whom_to_visit text,
              qr_code text, group_id uuid, additional_visitors integer,
              expected_return_date timestamptz, leave_type text, accompanied_by_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT v.id, v.first_name, v.surname, v.type, v.status, v.check_in_time, v.check_out_time,
         v.whom_to_visit, v.qr_code, v.group_id, v.additional_visitors,
         v.expected_return_date, v.leave_type, v.accompanied_by_name
  FROM public.visitors v
  WHERE v.status = 'checked-in'
     OR (v.type = 'resident' AND v.status = 'checked-out')
  ORDER BY v.check_in_time DESC
  LIMIT 500;
$$;

CREATE OR REPLACE FUNCTION public.kiosk_check_out(p_visitor_id uuid, p_time timestamptz DEFAULT now())
RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.visitors
     SET status = 'checked-out', check_out_time = coalesce(p_time, now())
   WHERE id = p_visitor_id AND status = 'checked-in';
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.kiosk_resident_return(p_visitor_id uuid, p_time timestamptz DEFAULT now())
RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.visitors
     SET status = 'checked-in', check_in_time = coalesce(p_time, now()),
         check_out_time = NULL, expected_return_date = NULL
   WHERE id = p_visitor_id AND type = 'resident';
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.kiosk_resident_leave(
  p_visitor_id uuid, p_time timestamptz DEFAULT now(),
  p_leave_type text DEFAULT NULL, p_expected_return timestamptz DEFAULT NULL,
  p_accompanied_by_name text DEFAULT NULL, p_reason text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.visitors
     SET status = 'checked-out', check_out_time = coalesce(p_time, now()),
         leave_type = p_leave_type, expected_return_date = p_expected_return,
         accompanied_by_name = p_accompanied_by_name, checkout_reason = p_reason
   WHERE id = p_visitor_id AND type = 'resident';
  RETURN FOUND;
END;
$$;

-- watchlist: kiosk gets a decision, never the reason or the register
CREATE OR REPLACE FUNCTION public.kiosk_watchlist_check(p_first text, p_last text)
RETURNS TABLE(is_match boolean, alert_type text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT true, coalesce(w.alert_type, 'alert')
  FROM public.visitor_watchlist w
  WHERE w.is_active
    AND lower(btrim(w.first_name)) = lower(btrim(coalesce(p_first,'')))
    AND lower(btrim(w.surname)) = lower(btrim(coalesce(p_last,'')))
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.kiosk_supplier_directory()
RETURNS TABLE(id uuid, name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT s.id, s.name FROM public.suppliers_min s WHERE s.is_active ORDER BY s.name LIMIT 500;
$$;

-- contractor recognition: identity + compliance decision only, never documents or references
CREATE OR REPLACE FUNCTION public.kiosk_contractor_lookup(
  p_mobile text DEFAULT NULL, p_qr text DEFAULT NULL,
  p_first text DEFAULT NULL, p_last text DEFAULT NULL)
RETURNS TABLE(person_id uuid, first_name text, surname text, supplier_id uuid, supplier_name text,
              outstanding_credentials text[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id, p.first_name, p.surname, p.supplier_id, s.name,
         coalesce(array_agg(ct.short_label) FILTER (
           WHERE ct.is_active AND ct.is_required AND (
             c.id IS NULL OR (c.expiry_date IS NOT NULL AND c.expiry_date < current_date))), '{}')
  FROM public.contractor_people p
  LEFT JOIN public.suppliers_min s ON s.id = p.supplier_id
  LEFT JOIN public.credential_types ct ON ct.is_active AND ct.holder_scope = 'person'
  LEFT JOIN public.contractor_credentials c ON c.person_id = p.id AND c.credential_type_id = ct.id
  WHERE p.is_active AND (
      (coalesce(btrim(p_qr),'') <> '' AND p.person_qr = btrim(upper(p_qr)))
   OR (coalesce(btrim(p_mobile),'') <> ''
       AND regexp_replace(coalesce(p.mobile,''),'[^0-9]','','g') = regexp_replace(p_mobile,'[^0-9]','','g')
       AND length(regexp_replace(p_mobile,'[^0-9]','','g')) >= 6)
   OR (coalesce(btrim(p_first),'') <> '' AND coalesce(btrim(p_last),'') <> ''
       AND lower(btrim(p.first_name)) = lower(btrim(p_first))
       AND lower(btrim(p.surname)) = lower(btrim(p_last))))
  GROUP BY p.id, p.first_name, p.surname, p.supplier_id, s.name
  LIMIT 1;
$$;

-- ---------- 4. KIOSK PIN: salted slow hash, with automatic upgrade ----------
ALTER TABLE public.kiosk_security
  ADD COLUMN IF NOT EXISTS pin_algo text NOT NULL DEFAULT 'md5';

CREATE OR REPLACE FUNCTION public.set_kiosk_pin(p_pin text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE h text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only administrators can set the kiosk PIN';
  END IF;
  IF btrim(coalesce(p_pin, '')) !~ '^[0-9]{4,8}$' THEN
    RAISE EXCEPTION 'PIN must be 4 to 8 digits';
  END IF;

  h := extensions.crypt(btrim(p_pin), extensions.gen_salt('bf', 10));

  IF EXISTS (SELECT 1 FROM public.kiosk_security) THEN
    UPDATE public.kiosk_security SET pin_hash = h, pin_algo = 'bcrypt', updated_by = auth.uid();
  ELSE
    INSERT INTO public.kiosk_security (pin_hash, pin_algo, updated_by) VALUES (h, 'bcrypt', auth.uid());
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_kiosk_pin(p_pin text)
RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE rec record; ok boolean := false;
BEGIN
  SELECT * INTO rec FROM public.kiosk_security LIMIT 1;
  IF rec IS NULL THEN RETURN false; END IF;

  IF rec.pin_algo = 'bcrypt' THEN
    ok := (rec.pin_hash = extensions.crypt(btrim(coalesce(p_pin,'')), rec.pin_hash));
  ELSE
    -- legacy unsalted hash: verify once, then upgrade in place
    ok := (rec.pin_hash = md5('centrim-kiosk-pin:' || btrim(coalesce(p_pin, ''))));
    IF ok THEN
      UPDATE public.kiosk_security
         SET pin_hash = extensions.crypt(btrim(p_pin), extensions.gen_salt('bf', 10)),
             pin_algo = 'bcrypt'
       WHERE id = rec.id;
    END IF;
  END IF;
  RETURN ok;
END;
$$;

-- ---------- 5. EXECUTE GRANTS: only kiosk functions are public ----------
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.ensure_user_bootstrap() FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_user_site_ids() FROM anon;
REVOKE EXECUTE ON FUNCTION public.user_can_access_site(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.default_site_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.resolve_setting(text, uuid, uuid, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_kiosk_pin(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_kiosk_pin(text) TO authenticated;

GRANT EXECUTE ON FUNCTION public.kiosk_resident_directory(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kiosk_staff_directory(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kiosk_presence_list() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kiosk_check_out(uuid, timestamptz) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kiosk_resident_return(uuid, timestamptz) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kiosk_resident_leave(uuid, timestamptz, text, timestamptz, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kiosk_watchlist_check(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kiosk_supplier_directory() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kiosk_contractor_lookup(text, text, text, text) TO anon, authenticated;

INSERT INTO public.audit_log (action, details, performed_by, records_affected)
VALUES ('stage1_access_control_migration',
        jsonb_build_object('anon_policies_removed', true, 'kiosk_rpcs_added', true, 'pin_algo','bcrypt'),
        'system', 0);