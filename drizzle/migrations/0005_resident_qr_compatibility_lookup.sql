CREATE OR REPLACE FUNCTION public.kioskd_resident_code(p_token text,p_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b uuid; c text:=upper(btrim(coalesce(p_code,''))); n int; target uuid;
BEGIN
 b:=public.kiosk_device_site(p_token,false);
 IF c !~ '^[A-Z0-9]{12}$' THEN RETURN jsonb_build_object('state','no_match'); END IF;
 SELECT count(*),(array_agg(id))[1] INTO n,target FROM public.visitors WHERE branch_id=b AND type='resident' AND status='checked-in' AND upper(qr_code)=c;
 IF n<>1 THEN RETURN jsonb_build_object('state','no_match'); END IF;
 RETURN jsonb_build_object('state','resident','id',target);
END $$;
REVOKE ALL ON FUNCTION public.kioskd_resident_code(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kioskd_resident_code(text,text) TO anon,authenticated,service_role;
COMMENT ON FUNCTION public.kioskd_resident_code(text,text) IS 'Preserves existing resident visit-code departure recognition without downloading resident presence lists. Resident movement authorization rules are unchanged.';