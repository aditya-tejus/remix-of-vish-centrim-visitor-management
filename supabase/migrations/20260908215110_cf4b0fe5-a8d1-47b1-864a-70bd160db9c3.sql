
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='settings' AND 'anon' = ANY(roles)
  LOOP
    EXECUTE format('DROP POLICY %I ON public.settings', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Kiosk may read non-contact settings"
ON public.settings FOR SELECT TO anon
USING (
  key NOT ILIKE '%email%'
  AND key NOT ILIKE '%recipient%'
  AND key NOT ILIKE '%phone%'
  AND key NOT ILIKE '%contact%'
  AND key NOT ILIKE '%pin%'
);
