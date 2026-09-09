ALTER TABLE public.form_fields
  ADD COLUMN IF NOT EXISTS help_text text,
  ADD COLUMN IF NOT EXISTS is_editable boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS options jsonb;