
REVOKE EXECUTE ON FUNCTION public.kiosk_hash(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.kiosk_random_code() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.kiosk_device_event(uuid, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.kiosk_device_site(text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.kiosk_require_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.kiosk_issue_code(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.kiosk_provision_device(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.kiosk_rename_device(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.kiosk_set_device_status(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.kiosk_rotate_token(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.kiosk_replace_device(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kiosk_provision_device(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.kiosk_rename_device(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.kiosk_set_device_status(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.kiosk_rotate_token(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.kiosk_replace_device(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.kiosk_issue_code(uuid) TO authenticated;
