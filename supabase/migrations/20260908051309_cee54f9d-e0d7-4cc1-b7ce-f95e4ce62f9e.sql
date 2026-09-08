ALTER TABLE public.evacuation_attendance
  ADD COLUMN IF NOT EXISTS responsible_staff text,
  ADD COLUMN IF NOT EXISTS associated_with text;