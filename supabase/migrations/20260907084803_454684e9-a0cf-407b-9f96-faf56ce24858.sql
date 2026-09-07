ALTER TABLE public.key_issues ADD COLUMN IF NOT EXISTS is_permanent boolean NOT NULL DEFAULT false;

ALTER TABLE public.property_keys ADD COLUMN IF NOT EXISTS lost_at timestamptz;
ALTER TABLE public.property_keys ADD COLUMN IF NOT EXISTS lost_notes text;
ALTER TABLE public.property_keys ADD COLUMN IF NOT EXISTS replaced_by_key_id uuid REFERENCES public.property_keys(id) ON DELETE SET NULL;