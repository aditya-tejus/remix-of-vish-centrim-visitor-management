-- 1. Legal hold on visitor records
ALTER TABLE public.visitors ADD COLUMN IF NOT EXISTS legal_hold boolean NOT NULL DEFAULT false;

-- 2. Supplier credential verification (additive, nullable, backward-compatible)
ALTER TABLE public.suppliers_min
  ADD COLUMN IF NOT EXISTS dbs_expiry_date date,
  ADD COLUMN IF NOT EXISTS dbs_reference text,
  ADD COLUMN IF NOT EXISTS acws_expiry_date date,
  ADD COLUMN IF NOT EXISTS acws_reference text,
  ADD COLUMN IF NOT EXISTS insurance_expiry_date date,
  ADD COLUMN IF NOT EXISTS insurance_reference text;

-- 3. Watchlist tightening
ALTER TABLE public.visitor_watchlist
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS reason_category text,
  ADD COLUMN IF NOT EXISTS review_date date;

-- 4. SIRS-style incident records
CREATE TABLE IF NOT EXISTS public.resident_incidents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id uuid REFERENCES public.visitors(id) ON DELETE SET NULL,
  resident_name text NOT NULL,
  incident_type text NOT NULL DEFAULT 'resident_absent',
  priority text NOT NULL DEFAULT 'priority_2',
  description text NOT NULL,
  reported_at timestamp with time zone NOT NULL DEFAULT now(),
  reported_by text NOT NULL DEFAULT 'Staff',
  reported_by_user_id uuid,
  expected_return_date timestamp with time zone,
  status text NOT NULL DEFAULT 'open',
  resolution_notes text,
  resolved_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.resident_incidents TO authenticated;
GRANT ALL ON public.resident_incidents TO service_role;

ALTER TABLE public.resident_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read incidents" ON public.resident_incidents
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'staff') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Staff can create incidents" ON public.resident_incidents
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'staff') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Staff can update incidents" ON public.resident_incidents
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'staff') OR has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'staff') OR has_role(auth.uid(), 'admin'));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_resident_incidents_updated_at ON public.resident_incidents;
CREATE TRIGGER update_resident_incidents_updated_at
  BEFORE UPDATE ON public.resident_incidents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Auto legal hold when a record is linked to an incident or evacuation roll call
CREATE OR REPLACE FUNCTION public.apply_legal_hold_from_link()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.visitor_id IS NOT NULL THEN
    UPDATE public.visitors SET legal_hold = true WHERE id = NEW.visitor_id AND legal_hold = false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS legal_hold_on_incident ON public.resident_incidents;
CREATE TRIGGER legal_hold_on_incident
  AFTER INSERT ON public.resident_incidents
  FOR EACH ROW EXECUTE FUNCTION public.apply_legal_hold_from_link();

DROP TRIGGER IF EXISTS legal_hold_on_evacuation ON public.evacuation_attendance;
CREATE TRIGGER legal_hold_on_evacuation
  AFTER INSERT ON public.evacuation_attendance
  FOR EACH ROW EXECUTE FUNCTION public.apply_legal_hold_from_link();