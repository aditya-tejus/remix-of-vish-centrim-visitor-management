
-- Create audit_log table for tracking automated actions
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  records_affected integer DEFAULT 0,
  performed_by text NOT NULL DEFAULT 'system',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read audit logs" ON public.audit_log FOR SELECT USING (true);
CREATE POLICY "System can insert audit logs" ON public.audit_log FOR INSERT WITH CHECK (true);

-- Enable pg_cron and pg_net extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
