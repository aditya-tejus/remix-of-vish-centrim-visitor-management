
CREATE TABLE public.kiosk_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  token_hash text,
  token_prefix text,
  token_issued_at timestamptz,
  token_expires_at timestamptz,
  last_seen_at timestamptz,
  last_seen_version text,
  last_checkin_at timestamptz,
  notes text,
  created_by uuid,
  revoked_by uuid,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.kiosk_activation_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES public.kiosk_devices(id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX kiosk_activation_codes_hash_idx ON public.kiosk_activation_codes(code_hash);

CREATE TABLE public.kiosk_device_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid REFERENCES public.kiosk_devices(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  event text NOT NULL,
  actor_user_id uuid,
  detail jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX kiosk_device_events_device_idx ON public.kiosk_device_events(device_id, created_at DESC);

GRANT SELECT ON public.kiosk_devices TO authenticated;
GRANT ALL ON public.kiosk_devices TO service_role;
GRANT SELECT ON public.kiosk_device_events TO authenticated;
GRANT ALL ON public.kiosk_device_events TO service_role;
GRANT ALL ON public.kiosk_activation_codes TO service_role;

ALTER TABLE public.kiosk_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kiosk_activation_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kiosk_device_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read kiosk devices for their sites"
  ON public.kiosk_devices FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), 'settings.administer') AND public.user_can_access_site(branch_id));

CREATE POLICY "Admins read kiosk device history for their sites"
  ON public.kiosk_device_events FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), 'settings.administer') AND (branch_id IS NULL OR public.user_can_access_site(branch_id)));

CREATE TRIGGER update_kiosk_devices_updated_at
  BEFORE UPDATE ON public.kiosk_devices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
