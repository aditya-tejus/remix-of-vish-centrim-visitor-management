
DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.sig);
  END LOOP;
END $$;

-- Kiosk (anonymous device) — narrow, purpose-built functions only
GRANT EXECUTE ON FUNCTION
  public.kiosk_check_in(jsonb),
  public.kiosk_check_out(uuid, timestamptz),
  public.kiosk_pin_is_set(),
  public.kiosk_presence_list(),
  public.kiosk_resident_directory(text),
  public.kiosk_resident_leave(uuid, timestamptz, text, timestamptz, text, text),
  public.kiosk_resident_return(uuid, timestamptz),
  public.kiosk_returning_lookup(text, text, text, text),
  public.kiosk_staff_directory(text),
  public.kiosk_supplier_directory(),
  public.kiosk_contractor_lookup(text, text, text, text),
  public.kiosk_watchlist_check(text, text),
  public.kiosk_emergency_rollcall(text),
  public.kiosk_emergency_progress(text),
  public.kiosk_emergency_mark(text, uuid, text, text, text)
TO anon, authenticated;

-- Signed-in staff application
GRANT EXECUTE ON FUNCTION
  public.has_role(uuid, app_role),
  public.has_permission(uuid, app_permission),
  public.user_can_access_site(uuid),
  public.current_user_site_ids(),
  public.default_site_id(),
  public.ensure_user_bootstrap(),
  public.log_audit(text, jsonb, integer, text),
  public.record_privacy_ack(uuid, uuid, text, text, text),
  public.resolve_setting(text, uuid, uuid, text, text, text),
  public.effective_retention_policy(text, uuid),
  public.run_retention(text, uuid),
  public.set_kiosk_pin(text)
TO authenticated;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
