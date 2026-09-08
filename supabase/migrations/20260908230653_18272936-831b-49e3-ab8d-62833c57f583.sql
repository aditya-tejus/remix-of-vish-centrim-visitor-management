-- Supplier credentials: permission-scoped instead of "any signed-in user"
DROP POLICY IF EXISTS "Staff read supplier credentials" ON public.supplier_credentials;
DROP POLICY IF EXISTS "Staff can insert supplier credentials" ON public.supplier_credentials;
DROP POLICY IF EXISTS "Staff can update supplier credentials" ON public.supplier_credentials;
DROP POLICY IF EXISTS "Staff can delete supplier credentials" ON public.supplier_credentials;

CREATE POLICY "Supplier credentials visible to permitted staff"
ON public.supplier_credentials FOR SELECT TO authenticated
USING (public.has_permission(auth.uid(), 'contractor.credentials.view'));

CREATE POLICY "Supplier credentials added by permitted staff"
ON public.supplier_credentials FOR INSERT TO authenticated
WITH CHECK (public.has_permission(auth.uid(), 'contractor.credentials.manage'));

CREATE POLICY "Supplier credentials updated by permitted staff"
ON public.supplier_credentials FOR UPDATE TO authenticated
USING (public.has_permission(auth.uid(), 'contractor.credentials.manage'))
WITH CHECK (public.has_permission(auth.uid(), 'contractor.credentials.manage'));

CREATE POLICY "Supplier credentials removed by permitted staff"
ON public.supplier_credentials FOR DELETE TO authenticated
USING (public.has_permission(auth.uid(), 'contractor.credentials.manage'));

-- Contractor person credentials: also require access to that person's site
DROP POLICY IF EXISTS "Contractor credentials added by permitted staff" ON public.contractor_credentials;
DROP POLICY IF EXISTS "Contractor credentials updated by permitted staff" ON public.contractor_credentials;

CREATE POLICY "Contractor credentials added by permitted staff"
ON public.contractor_credentials FOR INSERT TO authenticated
WITH CHECK (
  public.has_permission(auth.uid(), 'contractor.credentials.manage')
  AND EXISTS (
    SELECT 1 FROM public.contractor_people p
    WHERE p.id = contractor_credentials.person_id
      AND public.user_can_access_site(p.branch_id)
  )
);

CREATE POLICY "Contractor credentials updated by permitted staff"
ON public.contractor_credentials FOR UPDATE TO authenticated
USING (
  public.has_permission(auth.uid(), 'contractor.credentials.manage')
  AND EXISTS (
    SELECT 1 FROM public.contractor_people p
    WHERE p.id = contractor_credentials.person_id
      AND public.user_can_access_site(p.branch_id)
  )
)
WITH CHECK (public.has_permission(auth.uid(), 'contractor.credentials.manage'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_credentials TO authenticated;
GRANT ALL ON public.supplier_credentials TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.contractor_credentials TO authenticated;
GRANT ALL ON public.contractor_credentials TO service_role;