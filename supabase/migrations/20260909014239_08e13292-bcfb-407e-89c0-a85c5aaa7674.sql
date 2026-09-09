-- Site-scoped kiosk directory helpers.
-- Records with no site remain visible only at the original legacy placeholder site.

DROP FUNCTION IF EXISTS public.kiosk_resident_directory(text);
CREATE OR REPLACE FUNCTION public.kiosk_resident_directory(
  p_search text DEFAULT NULL,
  p_branch_id uuid DEFAULT NULL)
RETURNS TABLE(visitor_id uuid, first_name text, surname text, room text, area_name text, status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT v.id, v.first_name, v.surname, rd.room, w.name, v.status
  FROM public.visitors v
  LEFT JOIN public.resident_details rd ON rd.visitor_id = v.id
  LEFT JOIN public.wings w ON w.id = rd.wing_id
  WHERE v.type = 'resident'
    AND (
      p_branch_id IS NULL
      OR v.branch_id = p_branch_id
      OR (v.branch_id IS NULL
          AND p_branch_id = (SELECT b.id FROM public.branches b WHERE b.is_legacy_placeholder LIMIT 1))
    )
    AND (coalesce(btrim(p_search),'') = ''
         OR v.first_name ILIKE '%'||btrim(p_search)||'%'
         OR v.surname ILIKE '%'||btrim(p_search)||'%'
         OR coalesce(rd.room,'') ILIKE '%'||btrim(p_search)||'%')
  ORDER BY v.first_name
  LIMIT 300;
$$;
REVOKE ALL ON FUNCTION public.kiosk_resident_directory(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kiosk_resident_directory(text, uuid) TO anon, authenticated, service_role;

DROP FUNCTION IF EXISTS public.kiosk_staff_directory(text);
CREATE OR REPLACE FUNCTION public.kiosk_staff_directory(
  p_search text DEFAULT NULL,
  p_branch_id uuid DEFAULT NULL)
RETURNS TABLE(id uuid, first_name text, surname text, department text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT s.id, s.first_name, s.surname, s.department
  FROM public.staff_members s
  WHERE s.is_active
    AND (
      p_branch_id IS NULL
      OR s.branch_id = p_branch_id
      OR (s.branch_id IS NULL
          AND p_branch_id = (SELECT b.id FROM public.branches b WHERE b.is_legacy_placeholder LIMIT 1))
    )
    AND (coalesce(btrim(p_search),'') = ''
         OR s.first_name ILIKE '%'||btrim(p_search)||'%'
         OR s.surname ILIKE '%'||btrim(p_search)||'%'
         OR coalesce(s.department,'') ILIKE '%'||btrim(p_search)||'%')
  ORDER BY s.first_name LIMIT 300;
$$;
REVOKE ALL ON FUNCTION public.kiosk_staff_directory(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kiosk_staff_directory(text, uuid) TO anon, authenticated, service_role;

DROP FUNCTION IF EXISTS public.kiosk_supplier_directory();
CREATE OR REPLACE FUNCTION public.kiosk_supplier_directory(p_branch_id uuid DEFAULT NULL)
RETURNS TABLE(id uuid, name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT s.id, s.name
  FROM public.suppliers_min s
  WHERE s.is_active
    AND (
      p_branch_id IS NULL
      OR s.branch_id = p_branch_id
      OR (s.branch_id IS NULL
          AND p_branch_id = (SELECT b.id FROM public.branches b WHERE b.is_legacy_placeholder LIMIT 1))
    )
  ORDER BY s.name LIMIT 500;
$$;
REVOKE ALL ON FUNCTION public.kiosk_supplier_directory(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kiosk_supplier_directory(uuid) TO anon, authenticated, service_role;

DROP FUNCTION IF EXISTS public.kiosk_contractor_lookup(text, text, text, text);
CREATE OR REPLACE FUNCTION public.kiosk_contractor_lookup(
  p_mobile text DEFAULT NULL,
  p_qr text DEFAULT NULL,
  p_first text DEFAULT NULL,
  p_last text DEFAULT NULL,
  p_branch_id uuid DEFAULT NULL)
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
  WHERE p.is_active
    AND (
      p_branch_id IS NULL
      OR p.branch_id = p_branch_id
      OR (p.branch_id IS NULL
          AND p_branch_id = (SELECT b.id FROM public.branches b WHERE b.is_legacy_placeholder LIMIT 1))
    )
    AND (
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
REVOKE ALL ON FUNCTION public.kiosk_contractor_lookup(text, text, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kiosk_contractor_lookup(text, text, text, text, uuid) TO anon, authenticated, service_role;

DROP FUNCTION IF EXISTS public.kiosk_watchlist_check(text, text);
CREATE OR REPLACE FUNCTION public.kiosk_watchlist_check(
  p_first text,
  p_last text,
  p_branch_id uuid DEFAULT NULL)
RETURNS TABLE(is_match boolean, alert_type text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT true, coalesce(w.alert_type, 'alert')
  FROM public.visitor_watchlist w
  WHERE w.is_active
    AND coalesce(btrim(p_first),'') <> ''
    AND coalesce(btrim(p_last),'') <> ''
    AND (
      p_branch_id IS NULL
      OR w.branch_id = p_branch_id
      OR (w.branch_id IS NULL
          AND p_branch_id = (SELECT b.id FROM public.branches b WHERE b.is_legacy_placeholder LIMIT 1))
    )
    AND lower(btrim(w.first_name)) = lower(btrim(p_first))
    AND lower(btrim(w.surname)) = lower(btrim(p_last))
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.kiosk_watchlist_check(text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kiosk_watchlist_check(text, text, uuid) TO anon, authenticated, service_role;