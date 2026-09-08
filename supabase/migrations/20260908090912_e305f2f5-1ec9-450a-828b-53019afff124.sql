DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    -- nobody but the database itself needs trigger functions or internal helpers
    IF f.proname LIKE 'kiosk\_%' OR f.proname IN ('verify_kiosk_pin','kiosk_pin_is_set') THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f.sig);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated, service_role', f.sig);
    ELSIF f.proname IN ('ensure_user_bootstrap','has_role','user_can_access_site','current_user_site_ids','default_site_id','resolve_setting','set_kiosk_pin') THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f.sig);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f.sig);
    ELSE
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.sig);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);
    END IF;
  END LOOP;
END $$;

INSERT INTO public.audit_log (action, details, performed_by, records_affected)
VALUES ('stage1_function_execute_grants', jsonb_build_object('policy','kiosk-only anon execute'), 'system', 0);