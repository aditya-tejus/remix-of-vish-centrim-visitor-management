ALTER TABLE public.visitors ADD COLUMN IF NOT EXISTS accompanied_by text;
ALTER TABLE public.visitors ADD COLUMN IF NOT EXISTS accompanied_by_name text;