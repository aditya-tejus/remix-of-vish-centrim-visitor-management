
-- Create visitors table for check-in records
CREATE TABLE public.visitors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name TEXT NOT NULL,
  surname TEXT NOT NULL,
  email TEXT NOT NULL,
  mobile TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'visitor',
  check_in_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  check_out_time TIMESTAMPTZ,
  whom_to_visit TEXT DEFAULT '',
  address TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'checked-in',
  health_declaration BOOLEAN DEFAULT false,
  additional_visitors INT DEFAULT 0,
  comments TEXT DEFAULT '',
  body_temperature NUMERIC(4,1),
  health_answers JSONB DEFAULT '{}',
  privacy_acknowledged BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.visitors ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert (public check-in form)
CREATE POLICY "Anyone can insert visitors"
  ON public.visitors FOR INSERT
  WITH CHECK (true);

-- Allow anyone to read visitors (dashboard - no auth yet)
CREATE POLICY "Anyone can read visitors"
  ON public.visitors FOR SELECT
  USING (true);

-- Allow anyone to update visitors (for checkout)
CREATE POLICY "Anyone can update visitors"
  ON public.visitors FOR UPDATE
  USING (true);

-- Allow anyone to delete visitors
CREATE POLICY "Anyone can delete visitors"
  ON public.visitors FOR DELETE
  USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.visitors;
