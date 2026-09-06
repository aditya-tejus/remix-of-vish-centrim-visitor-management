CREATE TABLE public.food_register (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_visitor_id uuid REFERENCES public.visitors(id) ON DELETE SET NULL,
  resident_name text NOT NULL,
  visitor_id uuid REFERENCES public.visitors(id) ON DELETE SET NULL,
  brought_by_name text NOT NULL,
  food_description text NOT NULL,
  food_type text NOT NULL DEFAULT 'other',
  shared_with_others boolean NOT NULL DEFAULT false,
  shared_resident_ids uuid[] NOT NULL DEFAULT '{}',
  shared_resident_names text[] NOT NULL DEFAULT '{}',
  notes text,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'check_in',
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.food_register TO authenticated;
GRANT INSERT ON public.food_register TO anon;
GRANT ALL ON public.food_register TO service_role;

ALTER TABLE public.food_register ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view food register"
ON public.food_register FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'staff') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Staff can insert food register"
ON public.food_register FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'staff') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Staff can update food register"
ON public.food_register FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'staff') OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'staff') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Staff can delete food register"
ON public.food_register FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'staff') OR public.has_role(auth.uid(), 'admin'));

-- Kiosk (unauthenticated) self check-in can only add a record, never read it back.
CREATE POLICY "Kiosk can record food at check-in"
ON public.food_register FOR INSERT TO anon
WITH CHECK (source = 'check_in' AND recorded_at > now() - interval '1 day' AND recorded_at < now() + interval '1 day');

CREATE INDEX idx_food_register_recorded_at ON public.food_register (recorded_at DESC);
CREATE INDEX idx_food_register_resident ON public.food_register (resident_visitor_id);

CREATE TRIGGER update_food_register_updated_at
BEFORE UPDATE ON public.food_register
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();