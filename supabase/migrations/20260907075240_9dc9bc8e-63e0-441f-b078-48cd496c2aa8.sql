CREATE OR REPLACE FUNCTION public.kiosk_returning_lookup(p_first text DEFAULT NULL::text, p_last text DEFAULT NULL::text, p_mobile text DEFAULT NULL::text, p_qr text DEFAULT NULL::text)
 RETURNS TABLE(first_name text, surname text, email text, mobile text, address text, whom_to_visit text, visited_resident_ids uuid[], person_qr text, last_visit timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT btrim(v.first_name), btrim(v.surname), v.email, v.mobile, v.address, v.whom_to_visit,
         v.visited_resident_ids, v.person_qr, v.check_in_time
  FROM public.visitors v
  WHERE v.type <> 'resident'
    AND (
      (
        coalesce(btrim(p_qr), '') <> ''
        AND v.person_qr = btrim(upper(p_qr))
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
$function$;