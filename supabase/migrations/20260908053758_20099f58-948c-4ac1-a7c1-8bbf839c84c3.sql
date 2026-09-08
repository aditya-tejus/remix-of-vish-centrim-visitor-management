CREATE TABLE IF NOT EXISTS public.kiosk_security (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pin_hash text NOT NULL,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.kiosk_security TO authenticated;
GRANT ALL ON public.kiosk_security TO service_role;

ALTER TABLE public.kiosk_security ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage kiosk security" ON public.kiosk_security;
CREATE POLICY "Admins manage kiosk security"
ON public.kiosk_security FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_kiosk_security_updated_at
BEFORE UPDATE ON public.kiosk_security
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Admin-only: set or replace the kiosk staff PIN.
CREATE OR REPLACE FUNCTION public.set_kiosk_pin(p_pin text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  h text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only administrators can set the kiosk PIN';
  END IF;
  IF btrim(coalesce(p_pin, '')) !~ '^[0-9]{4,8}$' THEN
    RAISE EXCEPTION 'PIN must be 4 to 8 digits';
  END IF;

  h := md5('centrim-kiosk-pin:' || btrim(p_pin));

  IF EXISTS (SELECT 1 FROM public.kiosk_security) THEN
    UPDATE public.kiosk_security SET pin_hash = h, updated_by = auth.uid();
  ELSE
    INSERT INTO public.kiosk_security (pin_hash, updated_by) VALUES (h, auth.uid());
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_kiosk_pin(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_kiosk_pin(text) TO authenticated;

-- Kiosk: returns only true/false; never exposes the stored value.
CREATE OR REPLACE FUNCTION public.verify_kiosk_pin(p_pin text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.kiosk_security
    WHERE pin_hash = md5('centrim-kiosk-pin:' || btrim(coalesce(p_pin, '')))
  );
$$;

GRANT EXECUTE ON FUNCTION public.verify_kiosk_pin(text) TO anon, authenticated;

-- Has a PIN been configured yet? (no secret exposure)
CREATE OR REPLACE FUNCTION public.kiosk_pin_is_set()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.kiosk_security);
$$;

GRANT EXECUTE ON FUNCTION public.kiosk_pin_is_set() TO anon, authenticated;

-- Allow the kiosk (unauthenticated device) to run an evacuation roll call.
GRANT SELECT, INSERT, UPDATE ON public.evacuation_drills TO anon;
GRANT SELECT, INSERT, UPDATE ON public.evacuation_attendance TO anon;

DROP POLICY IF EXISTS "Kiosk can read drills" ON public.evacuation_drills;
CREATE POLICY "Kiosk can read drills" ON public.evacuation_drills FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Kiosk can start drills" ON public.evacuation_drills;
CREATE POLICY "Kiosk can start drills" ON public.evacuation_drills FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "Kiosk can update drills" ON public.evacuation_drills;
CREATE POLICY "Kiosk can update drills" ON public.evacuation_drills FOR UPDATE TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Kiosk can read attendance" ON public.evacuation_attendance;
CREATE POLICY "Kiosk can read attendance" ON public.evacuation_attendance FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Kiosk can seed attendance" ON public.evacuation_attendance;
CREATE POLICY "Kiosk can seed attendance" ON public.evacuation_attendance FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "Kiosk can mark attendance" ON public.evacuation_attendance;
CREATE POLICY "Kiosk can mark attendance" ON public.evacuation_attendance FOR UPDATE TO anon USING (true) WITH CHECK (true);