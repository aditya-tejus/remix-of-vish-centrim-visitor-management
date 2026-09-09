-- 1. Direct writes are no longer allowed; the approved routines (security definer) remain the only writers.
DROP POLICY IF EXISTS "visits writable within site" ON public.visits;
DROP POLICY IF EXISTS "people writable within site" ON public.people;
DROP POLICY IF EXISTS "visit parties follow visit site" ON public.visit_parties;

CREATE POLICY "visit parties readable within site"
ON public.visit_parties FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.visits v WHERE v.id = visit_parties.visit_id AND public.user_can_access_site(v.branch_id)));

REVOKE ALL ON public.visits FROM anon, authenticated;
REVOKE ALL ON public.visit_parties FROM anon, authenticated;
REVOKE ALL ON public.people FROM anon, authenticated;
GRANT SELECT ON public.visits TO authenticated;
GRANT SELECT ON public.visit_parties TO authenticated;
GRANT SELECT ON public.people TO authenticated;
GRANT ALL ON public.visits TO service_role;
GRANT ALL ON public.visit_parties TO service_role;
GRANT ALL ON public.people TO service_role;

-- 2. Sample records behind an integrity finding, for administrator review.
CREATE OR REPLACE FUNCTION public.visit_integrity_samples(p_issue text, p_branch_id uuid DEFAULT NULL, p_limit integer DEFAULT 25)
RETURNS TABLE(record_id uuid, label text, detail text, occurred_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_permission(auth.uid(), 'settings.administer') THEN
    RAISE EXCEPTION 'Not permitted';
  END IF;

  IF p_issue = 'visitors_without_visit' THEN
    RETURN QUERY
      SELECT v.id,
             (v.first_name || ' ' || v.surname),
             CASE WHEN COALESCE(v.additional_visitors,0) > 0
                  THEN 'Counted with ' || v.additional_visitors || ' companion(s)'
                  ELSE 'No companions counted' END,
             v.check_in_time
      FROM public.visitors v
      WHERE NOT EXISTS (SELECT 1 FROM public.visits s WHERE s.legacy_visitor_id = v.id)
        AND (p_branch_id IS NULL OR v.branch_id = p_branch_id)
        AND v.type <> 'resident'
      ORDER BY v.check_in_time DESC
      LIMIT p_limit;

  ELSIF p_issue = 'headcount_mismatch' THEN
    RETURN QUERY
      SELECT v.id,
             (v.first_name || ' ' || v.surname),
             'Counted ' || (1 + COALESCE(v.additional_visitors,0)) || ', listed ' ||
               (SELECT count(*) FROM public.visit_parties p JOIN public.visits s ON s.id = p.visit_id WHERE s.legacy_visitor_id = v.id),
             v.check_in_time
      FROM public.visitors v
      WHERE COALESCE(v.additional_visitors,0) > 0
        AND (p_branch_id IS NULL OR v.branch_id = p_branch_id)
        AND (1 + COALESCE(v.additional_visitors,0)) >
            (SELECT count(*) FROM public.visit_parties p JOIN public.visits s ON s.id = p.visit_id WHERE s.legacy_visitor_id = v.id)
      ORDER BY v.check_in_time DESC
      LIMIT p_limit;

  ELSIF p_issue = 'unresolved_companions' THEN
    RETURN QUERY
      SELECT p.id, p.display_name, 'Counted but never named', p.check_in_time
      FROM public.visit_parties p
      JOIN public.visits s ON s.id = p.visit_id
      WHERE p.name_status = 'unresolved'
        AND (p_branch_id IS NULL OR s.branch_id = p_branch_id)
      ORDER BY p.check_in_time DESC
      LIMIT p_limit;

  ELSE
    RETURN QUERY
      SELECT p.id, p.display_name, 'Position ' || p.companion_index, p.check_in_time
      FROM public.visit_parties p
      JOIN public.visits s ON s.id = p.visit_id
      WHERE (p_branch_id IS NULL OR s.branch_id = p_branch_id)
      ORDER BY p.check_in_time DESC
      LIMIT p_limit;
  END IF;
END;
$$;

-- 3. Duplicate positions on one visit, listed in full for review.
CREATE OR REPLACE FUNCTION public.duplicate_party_details(p_branch_id uuid DEFAULT NULL)
RETURNS TABLE(
  party_id uuid,
  visit_id uuid,
  companion_index integer,
  display_name text,
  name_status text,
  status text,
  check_in_time timestamptz,
  check_out_time timestamptz,
  is_primary boolean,
  visit_label text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_permission(auth.uid(), 'settings.administer') THEN
    RAISE EXCEPTION 'Not permitted';
  END IF;

  RETURN QUERY
  SELECT p.id, p.visit_id, p.companion_index, p.display_name, p.name_status, p.status,
         p.check_in_time, p.check_out_time, p.is_primary,
         COALESCE(v.first_name || ' ' || v.surname, 'Visit ' || left(s.id::text, 8))
  FROM public.visit_parties p
  JOIN public.visits s ON s.id = p.visit_id
  LEFT JOIN public.visitors v ON v.id = s.legacy_visitor_id
  WHERE (p_branch_id IS NULL OR s.branch_id = p_branch_id)
    AND EXISTS (
      SELECT 1 FROM public.visit_parties d
      WHERE d.visit_id = p.visit_id AND d.companion_index = p.companion_index AND d.id <> p.id
    )
  ORDER BY p.visit_id, p.companion_index, p.created_at;
END;
$$;

-- 4. Audited renumber: moves one duplicate entry to the next free position. Never deletes or merges.
CREATE OR REPLACE FUNCTION public.renumber_visit_party(p_party_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_visit uuid;
  v_branch uuid;
  v_old integer;
  v_new integer;
BEGIN
  IF NOT public.has_permission(auth.uid(), 'settings.administer') THEN
    RAISE EXCEPTION 'Not permitted';
  END IF;

  SELECT p.visit_id, p.companion_index, s.branch_id
    INTO v_visit, v_old, v_branch
  FROM public.visit_parties p
  JOIN public.visits s ON s.id = p.visit_id
  WHERE p.id = p_party_id;

  IF v_visit IS NULL THEN
    RAISE EXCEPTION 'Attendance entry not found';
  END IF;

  IF NOT public.user_can_access_site(v_branch) THEN
    RAISE EXCEPTION 'Not permitted for this site';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.visit_parties d
    WHERE d.visit_id = v_visit AND d.companion_index = v_old AND d.id <> p_party_id
  ) THEN
    RAISE EXCEPTION 'This entry is not a duplicate position';
  END IF;

  SELECT COALESCE(max(companion_index), 0) + 1 INTO v_new
  FROM public.visit_parties WHERE visit_id = v_visit;

  UPDATE public.visit_parties
     SET companion_index = v_new, updated_at = now()
   WHERE id = p_party_id;

  PERFORM public.log_audit(
    'attendance_party_renumbered',
    jsonb_build_object('party_id', p_party_id, 'visit_id', v_visit, 'from_index', v_old, 'to_index', v_new, 'branch_id', v_branch),
    1,
    'Duplicate attendance position resolved by an administrator'
  );

  RETURN v_new;
END;
$$;

REVOKE ALL ON FUNCTION public.visit_integrity_samples(text, uuid, integer) FROM public, anon;
REVOKE ALL ON FUNCTION public.duplicate_party_details(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.renumber_visit_party(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.visit_integrity_samples(text, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.duplicate_party_details(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.renumber_visit_party(uuid) TO authenticated;