
-- Create suppliers_min table for contractor supplier autocomplete
CREATE TABLE public.suppliers_min (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  abn text,
  company_number text,
  contact_name text,
  contact_phone text,
  contact_email text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.suppliers_min ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read suppliers" ON public.suppliers_min FOR SELECT TO public USING (true);
CREATE POLICY "Admins can insert suppliers" ON public.suppliers_min FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update suppliers" ON public.suppliers_min FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete suppliers" ON public.suppliers_min FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Add signature_url to visitors
ALTER TABLE public.visitors ADD COLUMN IF NOT EXISTS signature_url text;

-- Add supplier_id to visitors for contractor check-ins
ALTER TABLE public.visitors ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.suppliers_min(id);

-- Add contractor_screening jsonb to visitors for storing screening answers
ALTER TABLE public.visitors ADD COLUMN IF NOT EXISTS contractor_screening jsonb DEFAULT '{}'::jsonb;
