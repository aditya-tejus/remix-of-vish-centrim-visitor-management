DROP POLICY IF EXISTS "Anyone can read audit logs" ON public.audit_log;
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_log;

GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT INSERT ON public.audit_log TO anon;
GRANT ALL ON public.audit_log TO service_role;

CREATE POLICY "Admins can read audit logs"
ON public.audit_log FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

CREATE POLICY "Staff can write audit logs"
ON public.audit_log FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

CREATE POLICY "Kiosk can log health screening blocks"
ON public.audit_log FOR INSERT TO anon
WITH CHECK (action = 'kiosk_health_block' AND user_id IS NULL);
