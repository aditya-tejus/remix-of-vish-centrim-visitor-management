
DO $$
DECLARE r record;
  public_kiosk text[] := ARRAY[
    'kiosk_check_in','kiosk_check_out','kiosk_contractor_lookup','kiosk_pin_is_set',
    'kiosk_prefill_visitor','kiosk_presence_list','kiosk_resident_directory',
    'kiosk_resident_leave','kiosk_resident_return','kiosk_returning_lookup',
    'kiosk_staff_directory','kiosk_supplier_directory','kiosk_watchlist_check',
    'kiosk_emergency_rollcall','kiosk_emergency_mark','kiosk_emergency_progress',
    'verify_kiosk_pin','record_privacy_ack'
  ];
  internal_only text[] := ARRAY[
    'apply_legal_hold_from_link','apply_watchlist_legal_hold','handle_new_user',
    'sync_visit_from_visitor','record_emergency_action','kiosk_emergency_gate',
    'check_emergency_state','check_attendance_status','update_updated_at_column'
  ];
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig, p.proname
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);

    IF r.proname = ANY(internal_only) THEN
      CONTINUE; -- triggers and internal gates: owner/definer only
    ELSIF r.proname = ANY(public_kiosk) THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated', r.sig);
    ELSE
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.sig);
    END IF;
  END LOOP;
END $$;
