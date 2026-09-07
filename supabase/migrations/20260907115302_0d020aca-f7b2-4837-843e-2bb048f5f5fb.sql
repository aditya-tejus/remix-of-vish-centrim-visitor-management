ALTER TABLE public.evacuation_attendance
  ADD COLUMN IF NOT EXISTS assistance_level text,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS emergency_contact_name text,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone text,
  ADD COLUMN IF NOT EXISTS area_label text,
  ADD COLUMN IF NOT EXISTS room_label text,
  ADD COLUMN IF NOT EXISTS parent_visitor_id uuid REFERENCES public.visitors(id),
  ADD COLUMN IF NOT EXISTS companion_index integer;

ALTER TABLE public.evacuation_drills
  ADD COLUMN IF NOT EXISTS unaccounted_reason text,
  ADD COLUMN IF NOT EXISTS event_type text NOT NULL DEFAULT 'drill';

INSERT INTO public.settings (key, value)
VALUES ('site_structure', 'rac')
ON CONFLICT (key) DO NOTHING;