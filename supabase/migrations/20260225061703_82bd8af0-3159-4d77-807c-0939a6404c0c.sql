
CREATE TABLE public.form_fields (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  field_key text NOT NULL,
  label text NOT NULL,
  field_type text NOT NULL DEFAULT 'text',
  required boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  visitor_type text NOT NULL DEFAULT 'visitor',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.form_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read form fields" ON public.form_fields FOR SELECT USING (true);
CREATE POLICY "Admins can insert form fields" ON public.form_fields FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update form fields" ON public.form_fields FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete form fields" ON public.form_fields FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Seed default fields for each visitor type
INSERT INTO public.form_fields (field_key, label, field_type, required, sort_order, visitor_type) VALUES
  ('first_name', 'First Name', 'text', true, 1, 'visitor'),
  ('surname', 'Surname', 'text', true, 2, 'visitor'),
  ('email', 'Email', 'email', true, 3, 'visitor'),
  ('mobile', 'Phone', 'tel', true, 4, 'visitor'),
  ('first_name', 'First Name', 'text', true, 1, 'contractor'),
  ('surname', 'Surname', 'text', true, 2, 'contractor'),
  ('email', 'Email', 'email', true, 3, 'contractor'),
  ('mobile', 'Phone', 'tel', true, 4, 'contractor'),
  ('first_name', 'First Name', 'text', true, 1, 'resident'),
  ('surname', 'Surname', 'text', true, 2, 'resident'),
  ('email', 'Email', 'email', true, 3, 'resident'),
  ('mobile', 'Phone', 'tel', true, 4, 'resident'),
  ('first_name', 'First Name', 'text', true, 1, 'staff'),
  ('surname', 'Surname', 'text', true, 2, 'staff'),
  ('email', 'Email', 'email', true, 3, 'staff'),
  ('mobile', 'Phone', 'tel', true, 4, 'staff');
