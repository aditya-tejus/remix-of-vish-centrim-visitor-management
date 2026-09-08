-- 1. Role permission grants -------------------------------------------------
INSERT INTO public.role_permissions (role, permission)
SELECT 'admin'::app_role, p FROM unnest(ARRAY[
  'contractor.view','contractor.manage','contractor.credentials.view','contractor.credentials.manage',
  'keys.view','keys.issue','keys.return','keys.manage','keys.export'
]::app_permission[]) p
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission)
SELECT 'staff'::app_role, p FROM unnest(ARRAY[
  'contractor.view','contractor.manage','contractor.credentials.view','contractor.credentials.manage',
  'keys.view','keys.issue','keys.return'
]::app_permission[]) p
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission)
SELECT 'user'::app_role, p FROM unnest(ARRAY[
  'contractor.view','keys.view'
]::app_permission[]) p
ON CONFLICT DO NOTHING;

-- 2. Access item fields ------------------------------------------------------
ALTER TABLE public.property_keys
  ADD COLUMN IF NOT EXISTS serial_number text,
  ADD COLUMN IF NOT EXISTS damaged_at timestamptz,
  ADD COLUMN IF NOT EXISTS damaged_notes text,
  ADD COLUMN IF NOT EXISTS replaces_key_id uuid REFERENCES public.property_keys(id);

ALTER TABLE public.property_keys ALTER COLUMN branch_id SET DEFAULT public.default_site_id();
ALTER TABLE public.key_issues ALTER COLUMN branch_id SET DEFAULT public.default_site_id();

UPDATE public.property_keys SET branch_id = public.default_site_id() WHERE branch_id IS NULL;
UPDATE public.key_issues ki SET branch_id = k.branch_id
  FROM public.property_keys k WHERE k.id = ki.key_id AND ki.branch_id IS NULL;

CREATE INDEX IF NOT EXISTS property_keys_branch_idx ON public.property_keys(branch_id);
CREATE INDEX IF NOT EXISTS key_issues_branch_idx ON public.key_issues(branch_id);

-- 3. Keys register access ----------------------------------------------------
DROP POLICY IF EXISTS "Staff can view keys" ON public.property_keys;
DROP POLICY IF EXISTS "Staff can add keys" ON public.property_keys;
DROP POLICY IF EXISTS "Staff can update keys" ON public.property_keys;

CREATE POLICY "Keys visible to permitted staff at the site"
ON public.property_keys FOR SELECT TO authenticated
USING (public.has_permission(auth.uid(), 'keys.view') AND public.user_can_access_site(branch_id));

CREATE POLICY "Keys added by permitted staff"
ON public.property_keys FOR INSERT TO authenticated
WITH CHECK (
  (public.has_permission(auth.uid(), 'keys.manage') OR public.has_permission(auth.uid(), 'keys.issue'))
  AND public.user_can_access_site(branch_id)
);

CREATE POLICY "Keys updated by permitted staff"
ON public.property_keys FOR UPDATE TO authenticated
USING (
  public.user_can_access_site(branch_id) AND (
    public.has_permission(auth.uid(), 'keys.manage')
    OR public.has_permission(auth.uid(), 'keys.issue')
    OR public.has_permission(auth.uid(), 'keys.return')
  )
)
WITH CHECK (public.user_can_access_site(branch_id));

DROP POLICY IF EXISTS "Staff can view key issues" ON public.key_issues;
DROP POLICY IF EXISTS "Staff can issue keys" ON public.key_issues;
DROP POLICY IF EXISTS "Staff can update key issues" ON public.key_issues;

CREATE POLICY "Key handovers visible to permitted staff at the site"
ON public.key_issues FOR SELECT TO authenticated
USING (public.has_permission(auth.uid(), 'keys.view') AND public.user_can_access_site(branch_id));

CREATE POLICY "Key handovers created by permitted staff"
ON public.key_issues FOR INSERT TO authenticated
WITH CHECK (public.has_permission(auth.uid(), 'keys.issue') AND public.user_can_access_site(branch_id));

CREATE POLICY "Key handovers closed by permitted staff"
ON public.key_issues FOR UPDATE TO authenticated
USING (
  public.user_can_access_site(branch_id) AND (
    public.has_permission(auth.uid(), 'keys.return') OR public.has_permission(auth.uid(), 'keys.manage')
  )
)
WITH CHECK (public.user_can_access_site(branch_id));

-- 4. Contractor credential access -------------------------------------------
DROP POLICY IF EXISTS "Staff manage contractor credentials" ON public.contractor_credentials;
DROP POLICY IF EXISTS "Staff read contractor credentials" ON public.contractor_credentials;
DROP POLICY IF EXISTS "Staff update contractor credentials" ON public.contractor_credentials;

CREATE POLICY "Contractor credentials visible to permitted staff"
ON public.contractor_credentials FOR SELECT TO authenticated
USING (
  public.has_permission(auth.uid(), 'contractor.credentials.view')
  AND EXISTS (
    SELECT 1 FROM public.contractor_people p
    WHERE p.id = contractor_credentials.person_id AND public.user_can_access_site(p.branch_id)
  )
);

CREATE POLICY "Contractor credentials added by permitted staff"
ON public.contractor_credentials FOR INSERT TO authenticated
WITH CHECK (public.has_permission(auth.uid(), 'contractor.credentials.manage'));

CREATE POLICY "Contractor credentials updated by permitted staff"
ON public.contractor_credentials FOR UPDATE TO authenticated
USING (public.has_permission(auth.uid(), 'contractor.credentials.manage'))
WITH CHECK (public.has_permission(auth.uid(), 'contractor.credentials.manage'));

-- 5. Contractor register access ---------------------------------------------
DROP POLICY IF EXISTS "Staff manage contractor people" ON public.contractor_people;
CREATE POLICY "Contractor people managed by permitted staff"
ON public.contractor_people FOR INSERT TO authenticated
WITH CHECK (public.has_permission(auth.uid(), 'contractor.manage'));

ALTER TABLE public.contractor_people ALTER COLUMN branch_id SET DEFAULT public.default_site_id();

-- 6. Narrow kiosk decision function: outstanding items only ------------------
CREATE OR REPLACE FUNCTION public.kiosk_open_key_holds(p_person_qr text)
RETURNS TABLE(open_items integer, overdue_items integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    count(*)::int AS open_items,
    count(*) FILTER (
      WHERE ki.is_permanent = false
        AND ki.expected_return IS NOT NULL
        AND ki.expected_return < now()
    )::int AS overdue_items
  FROM public.key_issues ki
  JOIN public.visitors v ON v.id = ki.visitor_id
  WHERE ki.returned_at IS NULL
    AND p_person_qr IS NOT NULL
    AND length(trim(p_person_qr)) >= 6
    AND (v.person_qr = upper(trim(p_person_qr)) OR v.qr_code = upper(trim(p_person_qr)));
$$;

REVOKE ALL ON FUNCTION public.kiosk_open_key_holds(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kiosk_open_key_holds(text) TO anon, authenticated;