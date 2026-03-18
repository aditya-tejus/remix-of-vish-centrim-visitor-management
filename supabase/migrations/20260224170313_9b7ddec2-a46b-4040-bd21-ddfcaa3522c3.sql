
-- Table for configurable health screening questions
CREATE TABLE public.health_questions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  question text NOT NULL,
  type text NOT NULL DEFAULT 'yesno' CHECK (type IN ('yesno', 'text', 'textarea', 'select', 'checkbox', 'file')),
  required boolean NOT NULL DEFAULT false,
  placeholder text,
  options jsonb DEFAULT '[]'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.health_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active health questions" ON public.health_questions
  FOR SELECT USING (true);

CREATE POLICY "Admins can insert health questions" ON public.health_questions
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update health questions" ON public.health_questions
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete health questions" ON public.health_questions
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Table for configurable vaccination fields
CREATE TABLE public.vaccination_fields (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  label text NOT NULL,
  field_type text NOT NULL DEFAULT 'date' CHECK (field_type IN ('date', 'text', 'select', 'file')),
  options jsonb DEFAULT '[]'::jsonb,
  required boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.vaccination_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read vaccination fields" ON public.vaccination_fields
  FOR SELECT USING (true);

CREATE POLICY "Admins can insert vaccination fields" ON public.vaccination_fields
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update vaccination fields" ON public.vaccination_fields
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete vaccination fields" ON public.vaccination_fields
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Seed default health questions
INSERT INTO public.health_questions (question, type, required, placeholder, options, sort_order) VALUES
  ('Do you have a fever or feel unusually warm?', 'yesno', true, null, '[]', 1),
  ('Do you have a new continuous cough?', 'yesno', true, null, '[]', 2),
  ('Have you lost your sense of taste or smell?', 'yesno', true, null, '[]', 3),
  ('Been in contact with a COVID-19 positive person (last 7 days)?', 'yesno', true, null, '[]', 4),
  ('Have you had diarrhea or vomiting (last 48 hours)?', 'yesno', true, null, '[]', 5),
  ('If yes to any above, please describe symptoms', 'textarea', false, 'Describe symptoms...', '[]', 6),
  ('Recent travel destination (if any)', 'text', false, 'Country or region...', '[]', 7),
  ('COVID-19 vaccination status', 'select', false, null, '["Not Vaccinated", "Partially Vaccinated", "Fully Vaccinated", "Boosted"]', 8),
  ('I consent to health screening and temperature check', 'checkbox', true, null, '[]', 9),
  ('Upload medical evidence (if applicable)', 'file', false, null, '[]', 10);

-- Seed default vaccination fields
INSERT INTO public.vaccination_fields (name, label, field_type, required, sort_order) VALUES
  ('influenza_date', 'Flu Vaccine Date', 'date', false, 1),
  ('covid_dose1_date', 'COVID Dose 1', 'date', false, 2),
  ('covid_dose2_date', 'COVID Dose 2', 'date', false, 3);
