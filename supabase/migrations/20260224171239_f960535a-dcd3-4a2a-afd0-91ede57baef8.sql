
CREATE TABLE public.gdpr_requirements (
  id text NOT NULL PRIMARY KEY,
  status text NOT NULL DEFAULT 'not-implemented' CHECK (status IN ('implemented', 'not-implemented', 'not-confirmed', 'partial')),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.gdpr_requirements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read gdpr requirements" ON public.gdpr_requirements
  FOR SELECT USING (true);

CREATE POLICY "Admins can update gdpr requirements" ON public.gdpr_requirements
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert gdpr requirements" ON public.gdpr_requirements
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Seed with default statuses
INSERT INTO public.gdpr_requirements (id, status) VALUES
  ('privacy_notice', 'implemented'),
  ('consent_checkbox', 'implemented'),
  ('privacy_policy_link', 'not-implemented'),
  ('data_retention', 'implemented'),
  ('data_export_sar', 'implemented'),
  ('data_correction', 'implemented'),
  ('right_to_erasure', 'not-confirmed'),
  ('automated_cleanup', 'not-implemented'),
  ('audit_trail', 'not-confirmed'),
  ('encryption_at_rest', 'partial'),
  ('rbac', 'partial'),
  ('dpa', 'not-implemented'),
  ('health_screening', 'implemented'),
  ('vaccination_records', 'implemented');
