-- Add companion_details column to visitors table
ALTER TABLE public.visitors ADD COLUMN companion_details jsonb DEFAULT '[]'::jsonb;

-- Seed companion field settings for all visitor types
INSERT INTO public.form_fields (field_key, label, field_type, required, sort_order, is_active, visitor_type) VALUES
  ('companion_name', 'Name', 'text', true, 100, true, 'visitor'),
  ('companion_phone', 'Phone', 'text', false, 101, true, 'visitor'),
  ('companion_email', 'Email', 'text', false, 102, true, 'visitor'),
  ('companion_relation', 'Relation', 'text', false, 103, true, 'visitor'),
  ('companion_name', 'Name', 'text', true, 100, true, 'contractor'),
  ('companion_phone', 'Phone', 'text', false, 101, true, 'contractor'),
  ('companion_email', 'Email', 'text', false, 102, true, 'contractor'),
  ('companion_relation', 'Relation', 'text', false, 103, true, 'contractor'),
  ('companion_name', 'Name', 'text', true, 100, true, 'resident'),
  ('companion_phone', 'Phone', 'text', false, 101, true, 'resident'),
  ('companion_email', 'Email', 'text', false, 102, true, 'resident'),
  ('companion_relation', 'Relation', 'text', false, 103, true, 'resident'),
  ('companion_name', 'Name', 'text', true, 100, true, 'staff'),
  ('companion_phone', 'Phone', 'text', false, 101, true, 'staff'),
  ('companion_email', 'Email', 'text', false, 102, true, 'staff'),
  ('companion_relation', 'Relation', 'text', false, 103, true, 'staff');
