-- 1. Site-scoped kiosk presence list
DROP FUNCTION IF EXISTS public.kiosk_presence_list();
CREATE OR REPLACE FUNCTION public.kiosk_presence_list(p_branch_id uuid DEFAULT NULL)
RETURNS TABLE(id uuid, first_name text, surname text, type text, status text,
  check_in_time timestamptz, check_out_time timestamptz, whom_to_visit text,
  qr_code text, group_id uuid, additional_visitors integer,
  expected_return_date timestamptz, leave_type text, accompanied_by_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT v.id, v.first_name, v.surname, v.type, v.status, v.check_in_time, v.check_out_time,
         v.whom_to_visit, v.qr_code, v.group_id, v.additional_visitors,
         v.expected_return_date, v.leave_type, v.accompanied_by_name
  FROM public.visitors v
  WHERE (v.status = 'checked-in'
     OR (v.type = 'resident' AND v.status = 'checked-out'))
    AND (p_branch_id IS NULL OR v.branch_id = p_branch_id)
  ORDER BY v.check_in_time DESC
  LIMIT 500;
$$;
REVOKE ALL ON FUNCTION public.kiosk_presence_list(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kiosk_presence_list(uuid) TO anon, authenticated, service_role;

-- 2. Site-scoped returning-person lookup
DROP FUNCTION IF EXISTS public.kiosk_returning_lookup(text, text, text, text);
CREATE OR REPLACE FUNCTION public.kiosk_returning_lookup(
  p_first text DEFAULT NULL,
  p_last text DEFAULT NULL,
  p_mobile text DEFAULT NULL,
  p_qr text DEFAULT NULL,
  p_branch_id uuid DEFAULT NULL)
RETURNS TABLE(first_name text, surname text, email text, mobile text, address text,
  whom_to_visit text, visited_resident_ids uuid[], person_qr text, last_visit timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT btrim(v.first_name), btrim(v.surname), v.email, v.mobile, v.address, v.whom_to_visit,
         v.visited_resident_ids, v.person_qr, v.check_in_time
  FROM public.visitors v
  WHERE v.type <> 'resident'
    AND (p_branch_id IS NULL OR v.branch_id = p_branch_id)
    AND (
      (
        coalesce(btrim(p_qr), '') <> ''
        AND (v.person_qr = btrim(upper(p_qr)) OR v.qr_code = btrim(upper(p_qr)))
      )
      OR (
        coalesce(btrim(p_mobile), '') <> ''
        AND regexp_replace(coalesce(v.mobile, ''), '[^0-9]', '', 'g')
            = regexp_replace(p_mobile, '[^0-9]', '', 'g')
        AND length(regexp_replace(p_mobile, '[^0-9]', '', 'g')) >= 6
      )
      OR (
        coalesce(btrim(p_first), '') <> ''
        AND coalesce(btrim(p_last), '') <> ''
        AND lower(btrim(v.first_name)) = lower(btrim(p_first))
        AND lower(btrim(v.surname)) = lower(btrim(p_last))
      )
    )
  ORDER BY v.check_in_time DESC
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.kiosk_returning_lookup(text, text, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kiosk_returning_lookup(text, text, text, text, uuid) TO anon, authenticated, service_role;

-- 3. Narrow kiosk event log (kiosk no longer writes to audit_log directly)
CREATE OR REPLACE FUNCTION public.kiosk_log_event(
  p_purpose text,
  p_outcome text,
  p_branch_id uuid DEFAULT NULL,
  p_detail text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF coalesce(btrim(p_purpose), '') = '' OR coalesce(btrim(p_outcome), '') = '' THEN
    RETURN;
  END IF;
  INSERT INTO public.kiosk_access_log (purpose, outcome, branch_id, detail)
  VALUES (left(btrim(p_purpose), 60), left(btrim(p_outcome), 60), p_branch_id, left(coalesce(p_detail, ''), 200));
END;
$$;
REVOKE ALL ON FUNCTION public.kiosk_log_event(text, text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kiosk_log_event(text, text, uuid, text) TO anon, authenticated, service_role;

-- 4. Fast Lane visibility setting (hidden unless the site issues codes)
INSERT INTO public.settings (key, value)
SELECT 'kiosk_fast_lane_enabled', 'true'
WHERE NOT EXISTS (SELECT 1 FROM public.settings WHERE key = 'kiosk_fast_lane_enabled');