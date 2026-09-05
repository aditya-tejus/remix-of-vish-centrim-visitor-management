-- ============ VISITORS ============
DROP POLICY IF EXISTS "Anyone can read visitors" ON public.visitors;
DROP POLICY IF EXISTS "Anyone can insert visitors" ON public.visitors;
DROP POLICY IF EXISTS "Authenticated users can update visitors" ON public.visitors;

REVOKE ALL ON public.visitors FROM anon;
GRANT SELECT (
  id, first_name, surname, type, status, check_in_time, check_out_time,
  whom_to_visit, qr_code, group_id, additional_visitors, expected_return_date,
  leave_type, accompanied_by_name, print_status, created_at, branch_id, safeguarding_hold
) ON public.visitors TO anon;
GRANT INSERT (
  first_name, surname, email, mobile, type, check_in_time, whom_to_visit, address,
  status, health_declaration, additional_visitors, companion_details, comments,
  body_temperature, privacy_acknowledged, health_answers, contractor_screening,
  supplier_id, qr_code, group_id, branch_id, visit_purpose, work_type, work_location,
  signature_url, visited_resident_ids
) ON public.visitors TO anon;
GRANT UPDATE (
  status, check_out_time, check_in_time, checkout_reason, comments,
  expected_return_date, leave_type, accompanied_by, accompanied_by_name,
  return_notification_opt_in, companion_details, additional_visitors, print_status
) ON public.visitors TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.visitors TO authenticated;
GRANT ALL ON public.visitors TO service_role;

CREATE POLICY "Kiosk can read limited visitor columns"
  ON public.visitors FOR SELECT TO anon USING (true);

CREATE POLICY "Staff can read visitors"
  ON public.visitors FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'staff') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Kiosk can create self check-ins"
  ON public.visitors FOR INSERT TO anon
  WITH CHECK (
    status = 'checked-in'
    AND check_out_time IS NULL
    AND type <> 'resident'
    AND check_in_time > (now() - interval '1 day')
    AND check_in_time < (now() + interval '1 day')
    AND safeguarding_hold IS NOT TRUE
  );

CREATE POLICY "Staff can create visitors"
  ON public.visitors FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'staff') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Kiosk can update visit status columns"
  ON public.visitors FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Staff can update visitors"
  ON public.visitors FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'staff') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'staff') OR public.has_role(auth.uid(), 'admin'));

-- ============ SETTINGS ============
DROP POLICY IF EXISTS "Anyone can insert settings" ON public.settings;
DROP POLICY IF EXISTS "Anyone can update settings" ON public.settings;

REVOKE ALL ON public.settings FROM anon;
GRANT SELECT ON public.settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.settings TO authenticated;
GRANT ALL ON public.settings TO service_role;

DROP POLICY IF EXISTS "Admins can delete settings" ON public.settings;
CREATE POLICY "Admins can delete settings"
  ON public.settings FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============ KIOSK PREFILL HELPER ============
CREATE OR REPLACE FUNCTION public.kiosk_prefill_visitor(p_first text, p_last text)
RETURNS TABLE (email text, mobile text, address text, whom_to_visit text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT v.email, v.mobile, v.address, v.whom_to_visit
  FROM public.visitors v
  WHERE lower(v.first_name) = lower(btrim(p_first))
    AND lower(v.surname) = lower(btrim(p_last))
    AND btrim(coalesce(p_first, '')) <> ''
    AND btrim(coalesce(p_last, '')) <> ''
  ORDER BY v.check_in_time DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.kiosk_prefill_visitor(text, text) TO anon, authenticated;

-- ============ USER BOOTSTRAP (profile + role) ============
CREATE OR REPLACE FUNCTION public.ensure_user_bootstrap()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.profiles (user_id, display_name)
  SELECT uid, coalesce(u.raw_user_meta_data->>'display_name', u.email)
  FROM auth.users u WHERE u.id = uid
  ON CONFLICT DO NOTHING;

  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = uid) THEN
    IF (SELECT count(*) FROM public.user_roles) = 0 THEN
      INSERT INTO public.user_roles (user_id, role) VALUES (uid, 'admin');
    ELSE
      INSERT INTO public.user_roles (user_id, role) VALUES (uid, 'staff');
    END IF;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_user_bootstrap() TO authenticated;