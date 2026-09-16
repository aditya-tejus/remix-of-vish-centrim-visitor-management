CREATE TABLE public.auto_checkout_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  person_type text NOT NULL CHECK (person_type IN ('visitor','contractor','volunteer','staff')),
  enabled boolean NOT NULL DEFAULT false,
  mode text NOT NULL DEFAULT 'hours' CHECK (mode IN ('hours','end_of_day','either')),
  hours integer NOT NULL DEFAULT 12 CHECK (hours BETWEEN 1 AND 72),
  end_of_day_time time NOT NULL DEFAULT '22:00',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (branch_id, person_type)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.auto_checkout_rules TO authenticated;
GRANT ALL ON public.auto_checkout_rules TO service_role;

ALTER TABLE public.auto_checkout_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View auto sign-out rules for accessible sites"
ON public.auto_checkout_rules FOR SELECT TO authenticated
USING (public.user_can_access_site(branch_id));

CREATE POLICY "Administrators manage auto sign-out rules"
ON public.auto_checkout_rules FOR ALL TO authenticated
USING (public.has_permission(auth.uid(), 'settings.administer'::app_permission) AND public.user_can_access_site(branch_id))
WITH CHECK (public.has_permission(auth.uid(), 'settings.administer'::app_permission) AND public.user_can_access_site(branch_id));

CREATE TRIGGER update_auto_checkout_rules_updated_at
BEFORE UPDATE ON public.auto_checkout_rules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.visitors ADD COLUMN IF NOT EXISTS auto_checked_out boolean NOT NULL DEFAULT false;