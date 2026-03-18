
-- Branches table
CREATE TABLE public.branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read branches" ON public.branches FOR SELECT TO public USING (true);
CREATE POLICY "Admins can insert branches" ON public.branches FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update branches" ON public.branches FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete branches" ON public.branches FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Branch notification settings
CREATE TABLE public.branch_notification_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT true,
  notification_emails jsonb NOT NULL DEFAULT '[]'::jsonb,
  notification_staff jsonb NOT NULL DEFAULT '[]'::jsonb,
  notification_timing jsonb NOT NULL DEFAULT '["on_the_day"]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.branch_notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read branch notification settings" ON public.branch_notification_settings FOR SELECT TO public USING (true);
CREATE POLICY "Admins can insert branch notification settings" ON public.branch_notification_settings FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update branch notification settings" ON public.branch_notification_settings FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete branch notification settings" ON public.branch_notification_settings FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Insert a default branch
INSERT INTO public.branches (name) VALUES ('Main Branch');

-- Add branch_id to visitors for branch-scoping (optional, nullable)
ALTER TABLE public.visitors ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id);
