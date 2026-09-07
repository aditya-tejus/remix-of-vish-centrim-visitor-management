ALTER TABLE public.credential_types
  ADD COLUMN IF NOT EXISTS holder_scope text NOT NULL DEFAULT 'company',
  ADD COLUMN IF NOT EXISTS requires_document boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.contractor_people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  surname text NOT NULL,
  mobile text,
  email text,
  supplier_id uuid REFERENCES public.suppliers_min(id) ON DELETE SET NULL,
  person_qr text UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contractor_people TO authenticated;
GRANT ALL ON public.contractor_people TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.contractor_people TO anon;

ALTER TABLE public.contractor_people ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage contractor people"
  ON public.contractor_people FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Kiosk can read contractor people"
  ON public.contractor_people FOR SELECT TO anon USING (true);

CREATE POLICY "Kiosk can add contractor people"
  ON public.contractor_people FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Kiosk can update contractor people"
  ON public.contractor_people FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.contractor_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.contractor_people(id) ON DELETE CASCADE,
  credential_type_id uuid NOT NULL REFERENCES public.credential_types(id) ON DELETE CASCADE,
  expiry_date date,
  reference text,
  document_path text,
  verification_status text NOT NULL DEFAULT 'pending',
  uploaded_by text,
  uploaded_at timestamptz,
  verified_by text,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (person_id, credential_type_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contractor_credentials TO authenticated;
GRANT ALL ON public.contractor_credentials TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.contractor_credentials TO anon;

ALTER TABLE public.contractor_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage contractor credentials"
  ON public.contractor_credentials FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Kiosk can read contractor credentials"
  ON public.contractor_credentials FOR SELECT TO anon USING (true);

CREATE POLICY "Kiosk can add contractor credentials"
  ON public.contractor_credentials FOR INSERT TO anon
  WITH CHECK (verification_status = 'pending');

CREATE POLICY "Kiosk can update contractor credentials"
  ON public.contractor_credentials FOR UPDATE TO anon
  USING (true) WITH CHECK (verification_status = 'pending');

CREATE TRIGGER update_contractor_people_updated_at
  BEFORE UPDATE ON public.contractor_people
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_contractor_credentials_updated_at
  BEFORE UPDATE ON public.contractor_credentials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.visitors
  ADD COLUMN IF NOT EXISTS contractor_person_id uuid REFERENCES public.contractor_people(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS compliance_status text;