CREATE TABLE public.credential_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  short_label text NOT NULL,
  jurisdiction text NOT NULL DEFAULT 'ALL' CHECK (jurisdiction IN ('AU','UK','ALL')),
  is_required boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.credential_types TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.credential_types TO authenticated;
GRANT ALL ON public.credential_types TO service_role;

ALTER TABLE public.credential_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view credential types" ON public.credential_types FOR SELECT USING (true);
CREATE POLICY "Staff can insert credential types" ON public.credential_types FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Staff can update credential types" ON public.credential_types FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Staff can delete credential types" ON public.credential_types FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_credential_types_updated_at BEFORE UPDATE ON public.credential_types
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.supplier_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.suppliers_min(id) ON DELETE CASCADE,
  credential_type_id uuid NOT NULL REFERENCES public.credential_types(id) ON DELETE CASCADE,
  expiry_date date,
  reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (supplier_id, credential_type_id)
);

GRANT SELECT ON public.supplier_credentials TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_credentials TO authenticated;
GRANT ALL ON public.supplier_credentials TO service_role;

ALTER TABLE public.supplier_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view supplier credentials" ON public.supplier_credentials FOR SELECT USING (true);
CREATE POLICY "Staff can insert supplier credentials" ON public.supplier_credentials FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Staff can update supplier credentials" ON public.supplier_credentials FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Staff can delete supplier credentials" ON public.supplier_credentials FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_supplier_credentials_updated_at BEFORE UPDATE ON public.supplier_credentials
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed the three credentials the app previously hard-coded
INSERT INTO public.credential_types (key, label, short_label, jurisdiction, is_required, sort_order) VALUES
  ('dbs', 'DBS Check', 'DBS', 'UK', false, 1),
  ('acws', 'Aged Care Worker Screening', 'ACWS', 'AU', false, 2),
  ('insurance', 'Public Liability Insurance', 'Insurance', 'ALL', false, 3);

-- Backfill existing supplier credential data
INSERT INTO public.supplier_credentials (supplier_id, credential_type_id, expiry_date, reference)
SELECT s.id, ct.id, s.dbs_expiry_date, s.dbs_reference
FROM public.suppliers_min s CROSS JOIN public.credential_types ct
WHERE ct.key = 'dbs' AND (s.dbs_expiry_date IS NOT NULL OR s.dbs_reference IS NOT NULL);

INSERT INTO public.supplier_credentials (supplier_id, credential_type_id, expiry_date, reference)
SELECT s.id, ct.id, s.acws_expiry_date, s.acws_reference
FROM public.suppliers_min s CROSS JOIN public.credential_types ct
WHERE ct.key = 'acws' AND (s.acws_expiry_date IS NOT NULL OR s.acws_reference IS NOT NULL);

INSERT INTO public.supplier_credentials (supplier_id, credential_type_id, expiry_date, reference)
SELECT s.id, ct.id, s.insurance_expiry_date, s.insurance_reference
FROM public.suppliers_min s CROSS JOIN public.credential_types ct
WHERE ct.key = 'insurance' AND (s.insurance_expiry_date IS NOT NULL OR s.insurance_reference IS NOT NULL);

-- Carry over the old mandatory-credentials setting into the new per-type flag
UPDATE public.credential_types ct SET is_required = true
WHERE EXISTS (
  SELECT 1 FROM public.settings s
  WHERE s.key = 'contractor_mandatory_credentials'
    AND s.value LIKE '%"' || ct.key || '"%'
);

DELETE FROM public.settings WHERE key = 'contractor_mandatory_credentials';