
-- Wings / Units table
CREATE TABLE public.wings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text DEFAULT '#6B7280',
  floor text,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.wings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read wings" ON public.wings FOR SELECT TO public USING (true);
CREATE POLICY "Admins can insert wings" ON public.wings FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update wings" ON public.wings FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete wings" ON public.wings FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Resident details (extended info linked to visitors of type 'resident')
CREATE TABLE public.resident_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id uuid REFERENCES public.visitors(id) ON DELETE CASCADE NOT NULL UNIQUE,
  wing_id uuid REFERENCES public.wings(id) ON DELETE SET NULL,
  room text,
  care_level text DEFAULT 'standard',
  key_worker text,
  photo_url text,
  emergency_contact_name text,
  emergency_contact_phone text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.resident_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read resident details" ON public.resident_details FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can insert resident details" ON public.resident_details FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Authenticated can update resident details" ON public.resident_details FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can delete resident details" ON public.resident_details FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Visitor watchlist
CREATE TABLE public.visitor_watchlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  surname text NOT NULL,
  photo_url text,
  reason text NOT NULL,
  instructions text,
  alert_type text DEFAULT 'soft' CHECK (alert_type IN ('soft', 'hard')),
  added_by text NOT NULL DEFAULT 'system',
  is_active boolean DEFAULT true,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.visitor_watchlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read watchlist" ON public.visitor_watchlist FOR SELECT TO public USING (true);
CREATE POLICY "Authenticated can insert watchlist" ON public.visitor_watchlist FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update watchlist" ON public.visitor_watchlist FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can delete watchlist" ON public.visitor_watchlist FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Seed default wings
INSERT INTO public.wings (name, floor, sort_order) VALUES
  ('Wing A', 'Ground Floor', 1),
  ('Wing B', 'Ground Floor', 2),
  ('Memory Care', 'Level 1', 3),
  ('Palliative', 'Level 1', 4);
