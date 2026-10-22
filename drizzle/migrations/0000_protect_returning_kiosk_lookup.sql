CREATE OR REPLACE FUNCTION public.kiosk_returning_lookup_v2(p_first text DEFAULT NULL, p_last text DEFAULT NULL, p_mobile text DEFAULT NULL, p_qr text DEFAULT NULL, p_branch_id uuid DEFAULT NULL)
RETURNS TABLE(first_name text, surname text, email text, mobile text, address text, whom_to_visit text, visited_resident_ids uuid[], person_qr text, last_visit timestamptz, identity_verified boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO public AS $fn$
WITH candidates AS (
 SELECT v.*, (
 (coalesce(btrim(p_qr),'') <> '' AND (v.person_qr=btrim(upper(p_qr)) OR v.qr_code=btrim(upper(p_qr))))
 OR (length(regexp_replace(coalesce(p_mobile,''),'[^0-9]','','g'))>=6 AND regexp_replace(coalesce(v.mobile,''),'[^0-9]','','g')=regexp_replace(p_mobile,'[^0-9]','','g'))
 ) AS verified
 FROM public.visitors v WHERE v.type <> 'resident' AND v.branch_id = p_branch_id
), matched AS (
 SELECT * FROM candidates c WHERE c.verified OR
 (coalesce(btrim(p_first),'')<>'' AND coalesce(btrim(p_last),'')<>'' AND lower(btrim(c.first_name))=lower(btrim(p_first)) AND lower(btrim(c.surname))=lower(btrim(p_last)))
 ORDER BY c.verified DESC NULLS LAST, c.check_in_time DESC LIMIT 1
)
SELECT btrim(m.first_name), btrim(m.surname),
 CASE WHEN m.verified THEN m.email ELSE NULL END,
 CASE WHEN m.verified THEN m.mobile WHEN coalesce(m.mobile,'')<>'' THEN '••••' || right(regexp_replace(m.mobile,'[^0-9]','','g'),2) ELSE NULL END,
 CASE WHEN m.verified THEN m.address ELSE NULL END,
 CASE WHEN m.verified THEN m.whom_to_visit ELSE NULL END,
 CASE WHEN m.verified THEN m.visited_resident_ids ELSE NULL END,
 CASE WHEN m.verified THEN m.person_qr ELSE NULL END,
 CASE WHEN m.verified THEN m.check_in_time ELSE NULL END,
 coalesce(m.verified,false) FROM matched m;
$fn$;
REVOKE ALL ON FUNCTION public.kiosk_returning_lookup_v2(text,text,text,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kiosk_returning_lookup_v2(text,text,text,text,uuid) TO authenticated, service_role;
CREATE OR REPLACE FUNCTION public.kiosk_returning_lookup(p_first text DEFAULT NULL, p_last text DEFAULT NULL, p_mobile text DEFAULT NULL, p_qr text DEFAULT NULL, p_branch_id uuid DEFAULT NULL)
RETURNS TABLE(first_name text, surname text, email text, mobile text, address text, whom_to_visit text, visited_resident_ids uuid[], person_qr text, last_visit timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO public AS $fn$
 SELECT r.first_name,r.surname,r.email,r.mobile,r.address,r.whom_to_visit,r.visited_resident_ids,r.person_qr,r.last_visit FROM public.kiosk_returning_lookup_v2(p_first,p_last,p_mobile,p_qr,p_branch_id) r;
$fn$;
CREATE OR REPLACE FUNCTION public.kioskd_returning_lookup_v2(p_token text, p_first text DEFAULT NULL, p_last text DEFAULT NULL, p_mobile text DEFAULT NULL, p_qr text DEFAULT NULL)
RETURNS TABLE(first_name text, surname text, email text, mobile text, address text, whom_to_visit text, visited_resident_ids uuid[], person_qr text, last_visit timestamptz, identity_verified boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public AS $fn$
BEGIN
 RETURN QUERY SELECT * FROM public.kiosk_returning_lookup_v2(p_first,p_last,p_mobile,p_qr,public.kiosk_device_site(p_token));
END;
$fn$;
REVOKE ALL ON FUNCTION public.kioskd_returning_lookup_v2(text,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kioskd_returning_lookup_v2(text,text,text,text,text) TO anon, authenticated, service_role;