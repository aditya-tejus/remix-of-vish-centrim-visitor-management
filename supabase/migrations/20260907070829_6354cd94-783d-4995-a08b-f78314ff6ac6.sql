-- Personal (permanent) visitor code
ALTER TABLE public.visitors ADD COLUMN IF NOT EXISTS person_qr text;
CREATE INDEX IF NOT EXISTS idx_visitors_person_qr ON public.visitors (person_qr);
CREATE INDEX IF NOT EXISTS idx_visitors_mobile ON public.visitors (mobile);

-- Property keys
CREATE TABLE public.property_keys (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key_label text NOT NULL,
  key_type text NOT NULL DEFAULT 'front_door',
  property_label text,
  resident_visitor_id uuid REFERENCES public.visitors(id) ON DELETE SET NULL,
  resident_name text,
  wing_id uuid REFERENCES public.wings(id) ON DELETE SET NULL,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  copy_number integer NOT NULL DEFAULT 1,
  storage_location text,
  status text NOT NULL DEFAULT 'available',
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_keys TO authenticated;
GRANT ALL ON public.property_keys TO service_role;
ALTER TABLE public.property_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view keys" ON public.property_keys FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can add keys" ON public.property_keys FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Staff can update keys" ON public.property_keys FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admins can delete keys" ON public.property_keys FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_property_keys_updated_at
BEFORE UPDATE ON public.property_keys
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Key issue / return history
CREATE TABLE public.key_issues (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key_id uuid NOT NULL REFERENCES public.property_keys(id) ON DELETE CASCADE,
  issued_to_name text NOT NULL,
  issued_to_type text NOT NULL DEFAULT 'contractor',
  visitor_id uuid REFERENCES public.visitors(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES public.suppliers_min(id) ON DELETE SET NULL,
  issued_at timestamp with time zone NOT NULL DEFAULT now(),
  issued_by text NOT NULL,
  expected_return timestamp with time zone,
  returned_at timestamp with time zone,
  returned_to text,
  condition_notes text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.key_issues TO authenticated;
GRANT ALL ON public.key_issues TO service_role;
ALTER TABLE public.key_issues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view key issues" ON public.key_issues FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can issue keys" ON public.key_issues FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Staff can update key issues" ON public.key_issues FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admins can delete key issues" ON public.key_issues FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_key_issues_key_id ON public.key_issues (key_id);
CREATE INDEX IF NOT EXISTS idx_key_issues_open ON public.key_issues (key_id) WHERE returned_at IS NULL;

CREATE TRIGGER update_key_issues_updated_at
BEFORE UPDATE ON public.key_issues
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Returning-visitor lookup for the kiosk (returns at most one row, never a list)
CREATE OR REPLACE FUNCTION public.kiosk_returning_lookup(
  p_first text DEFAULT NULL,
  p_last text DEFAULT NULL,
  p_mobile text DEFAULT NULL,
  p_qr text DEFAULT NULL
)
RETURNS TABLE(
  first_name text,
  surname text,
  email text,
  mobile text,
  address text,
  whom_to_visit text,
  visited_resident_ids uuid[],
  person_qr text,
  last_visit timestamp with time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT v.first_name, v.surname, v.email, v.mobile, v.address, v.whom_to_visit,
         v.visited_resident_ids, v.person_qr, v.check_in_time
  FROM public.visitors v
  WHERE v.type <> 'resident'
    AND (
      (
        coalesce(btrim(p_qr), '') <> ''
        AND v.person_qr = btrim(upper(p_qr))
      )
      OR (
        coalesce(btrim(p_mobile), '') <> ''
        AND regexp_replace(coalesce(v.mobile, ''), '[^0-9]', '', 'g')
            = regexp_replace(p_mobile, '[^0-9]', '', 'g')
        AND length(regexp_replace(p_mobile, '[^0-9]', '', 'g')) >= 6
      )
      OR (
        coalesce(btrim(p_first), '') <> ''
        AND coalesce(btrim(p_last), '') <> ''
        AND lower(v.first_name) = lower(btrim(p_first))
        AND lower(v.surname) = lower(btrim(p_last))
      )
    )
  ORDER BY v.check_in_time DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.kiosk_returning_lookup(text, text, text, text) TO anon, authenticated;