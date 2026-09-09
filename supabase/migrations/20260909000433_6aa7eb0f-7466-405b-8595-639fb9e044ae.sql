-- Trigger functions are never called directly by clients.
REVOKE ALL ON FUNCTION public.guard_closed_drill() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.guard_closed_drill() FROM anon, authenticated;