
DO $$ BEGIN
  CREATE TYPE public.app_permission AS ENUM (
    'presence.view',
    'checkin.create',
    'checkout.perform',
    'person.edit',
    'screening.view',
    'assistance.view',
    'credentials.view',
    'emergency.activate',
    'emergency.mark_safe',
    'emergency.export',
    'watchlist.manage',
    'privacy.manage',
    'data.export',
    'data.erase',
    'settings.administer'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.app_role NOT NULL,
  permission public.app_permission NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role, permission)
);

GRANT SELECT ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Signed-in staff can read the permission matrix" ON public.role_permissions;
CREATE POLICY "Signed-in staff can read the permission matrix"
  ON public.role_permissions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Administrators manage the permission matrix" ON public.role_permissions;
CREATE POLICY "Administrators manage the permission matrix"
  ON public.role_permissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Administrators may do everything
INSERT INTO public.role_permissions (role, permission)
SELECT 'admin'::public.app_role, p
FROM unnest(enum_range(NULL::public.app_permission)) AS p
ON CONFLICT DO NOTHING;

-- Day-to-day staff: operations, not governance
INSERT INTO public.role_permissions (role, permission)
SELECT 'staff'::public.app_role, p
FROM unnest(ARRAY[
  'presence.view','checkin.create','checkout.perform','person.edit',
  'screening.view','assistance.view','credentials.view',
  'emergency.activate','emergency.mark_safe','emergency.export',
  'watchlist.manage','data.export'
]::public.app_permission[]) AS p
ON CONFLICT DO NOTHING;

-- Read-only accounts
INSERT INTO public.role_permissions (role, permission)
SELECT 'user'::public.app_role, p
FROM unnest(ARRAY['presence.view']::public.app_permission[]) AS p
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission public.app_permission)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role = ur.role
    WHERE ur.user_id = _user_id AND rp.permission = _permission
  )
$$;

CREATE OR REPLACE FUNCTION public.log_audit(
  _action text,
  _details jsonb DEFAULT '{}'::jsonb,
  _records integer DEFAULT 1,
  _reason text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE new_id uuid;
BEGIN
  INSERT INTO public.audit_log (action, details, records_affected, performed_by, user_id, change_reason)
  VALUES (
    _action,
    coalesce(_details, '{}'::jsonb),
    coalesce(_records, 1),
    coalesce((SELECT email FROM auth.users WHERE id = auth.uid()), 'system'),
    auth.uid(),
    _reason
  )
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_audit(text, jsonb, integer, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.log_audit(text, jsonb, integer, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, public.app_permission) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, public.app_permission) TO authenticated;
