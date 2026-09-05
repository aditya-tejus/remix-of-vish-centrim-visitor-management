REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

REVOKE ALL ON FUNCTION public.ensure_user_bootstrap() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.ensure_user_bootstrap() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.kiosk_prefill_visitor(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.kiosk_prefill_visitor(text, text) TO anon, authenticated, service_role;