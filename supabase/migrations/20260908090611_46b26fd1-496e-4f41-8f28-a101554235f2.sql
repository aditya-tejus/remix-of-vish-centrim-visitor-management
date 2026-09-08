-- ============================================================
-- STAGE 1A/1C/1E: tenancy foundation, domain boundary, scoped settings
-- Non-destructive. No table drops. All new columns nullable + backfilled.
-- ============================================================

-- ---------- ORGANISATIONS ----------
CREATE TABLE IF NOT EXISTS public.organisations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE,
  jurisdiction text NOT NULL DEFAULT 'AU',
  is_active boolean NOT NULL DEFAULT true,
  is_legacy_placeholder boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organisations TO authenticated;
GRANT ALL ON public.organisations TO service_role;
ALTER TABLE public.organisations ENABLE ROW LEVEL SECURITY;

-- ---------- BRANCHES BECOME SITES ----------
ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS organisation_id uuid REFERENCES public.organisations(id),
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS jurisdiction text,
  ADD COLUMN IF NOT EXISTS site_structure text,
  ADD COLUMN IF NOT EXISTS timezone text,
  ADD COLUMN IF NOT EXISTS is_legacy_placeholder boolean NOT NULL DEFAULT false;

-- ---------- SEED LEGACY ORG + SITE (generic, not customer specific) ----------
INSERT INTO public.organisations (name, code, jurisdiction, is_legacy_placeholder)
SELECT 'Unassigned (legacy)', 'legacy', coalesce((SELECT value FROM public.settings WHERE key = 'jurisdiction'), 'AU'), true
WHERE NOT EXISTS (SELECT 1 FROM public.organisations WHERE is_legacy_placeholder);

INSERT INTO public.branches (name, is_active, organisation_id, code, jurisdiction, site_structure, is_legacy_placeholder)
SELECT 'Unassigned (legacy)', true,
       (SELECT id FROM public.organisations WHERE is_legacy_placeholder LIMIT 1),
       'legacy',
       coalesce((SELECT value FROM public.settings WHERE key = 'jurisdiction'), 'AU'),
       coalesce((SELECT value FROM public.settings WHERE key = 'site_structure'), 'rac'),
       true
WHERE NOT EXISTS (SELECT 1 FROM public.branches WHERE is_legacy_placeholder);

UPDATE public.branches
   SET organisation_id = (SELECT id FROM public.organisations WHERE is_legacy_placeholder LIMIT 1)
 WHERE organisation_id IS NULL;

-- ---------- SITE COLUMN ON EVERY OPERATIONAL TABLE (reuses branch_id naming) ----------
ALTER TABLE public.resident_details      ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id);
ALTER TABLE public.contractor_people     ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id);
ALTER TABLE public.suppliers_min         ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id);
ALTER TABLE public.key_issues            ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id);
ALTER TABLE public.leave_requests        ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id);
ALTER TABLE public.resident_incidents    ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id);
ALTER TABLE public.evacuation_drills     ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id);
ALTER TABLE public.evacuation_attendance ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id);
ALTER TABLE public.evacuation_points     ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id);

-- ---------- BACKFILL LEGACY SITE (documented, reversible: legacy rows are flagged by the placeholder site) ----------
DO $$
DECLARE legacy_site uuid;
BEGIN
  SELECT id INTO legacy_site FROM public.branches WHERE is_legacy_placeholder LIMIT 1;

  UPDATE public.visitors             SET branch_id = legacy_site WHERE branch_id IS NULL;
  UPDATE public.wings                SET branch_id = legacy_site WHERE branch_id IS NULL;
  UPDATE public.staff_members        SET branch_id = legacy_site WHERE branch_id IS NULL;
  UPDATE public.property_keys        SET branch_id = legacy_site WHERE branch_id IS NULL;
  UPDATE public.food_register        SET branch_id = legacy_site WHERE branch_id IS NULL;
  UPDATE public.visitor_watchlist    SET branch_id = legacy_site WHERE branch_id IS NULL;
  UPDATE public.resident_details     SET branch_id = legacy_site WHERE branch_id IS NULL;
  UPDATE public.contractor_people    SET branch_id = legacy_site WHERE branch_id IS NULL;
  UPDATE public.suppliers_min        SET branch_id = legacy_site WHERE branch_id IS NULL;
  UPDATE public.key_issues           SET branch_id = legacy_site WHERE branch_id IS NULL;
  UPDATE public.leave_requests       SET branch_id = legacy_site WHERE branch_id IS NULL;
  UPDATE public.resident_incidents   SET branch_id = legacy_site WHERE branch_id IS NULL;
  UPDATE public.evacuation_drills    SET branch_id = legacy_site WHERE branch_id IS NULL;
  UPDATE public.evacuation_attendance SET branch_id = legacy_site WHERE branch_id IS NULL;
  UPDATE public.evacuation_points    SET branch_id = legacy_site WHERE branch_id IS NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_visitors_branch ON public.visitors(branch_id);
CREATE INDEX IF NOT EXISTS idx_resident_details_branch ON public.resident_details(branch_id);
CREATE INDEX IF NOT EXISTS idx_key_issues_branch ON public.key_issues(branch_id);
CREATE INDEX IF NOT EXISTS idx_evac_attendance_branch ON public.evacuation_attendance(branch_id);

-- ---------- STAFF SITE ACCESS ----------
CREATE TABLE IF NOT EXISTS public.user_site_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, branch_id)
);
GRANT SELECT ON public.user_site_access TO authenticated;
GRANT ALL ON public.user_site_access TO service_role;
ALTER TABLE public.user_site_access ENABLE ROW LEVEL SECURITY;

-- every existing account keeps access to the legacy site so the prototype stays usable
INSERT INTO public.user_site_access (user_id, branch_id, is_default)
SELECT ur.user_id, (SELECT id FROM public.branches WHERE is_legacy_placeholder LIMIT 1), true
FROM public.user_roles ur
ON CONFLICT DO NOTHING;

-- ---------- SITE SCOPE HELPERS (used by RLS, so SECURITY DEFINER + stable) ----------
CREATE OR REPLACE FUNCTION public.current_user_site_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT branch_id FROM public.user_site_access WHERE user_id = auth.uid()
  UNION
  SELECT b.id FROM public.branches b
   WHERE public.has_role(auth.uid(), 'admin');
$$;

CREATE OR REPLACE FUNCTION public.user_can_access_site(_branch_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
     AND (
       _branch_id IS NULL
       OR public.has_role(auth.uid(), 'admin')
       OR EXISTS (SELECT 1 FROM public.user_site_access s
                   WHERE s.user_id = auth.uid() AND s.branch_id = _branch_id)
     );
$$;

CREATE OR REPLACE FUNCTION public.default_site_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT coalesce(
    (SELECT s.branch_id FROM public.user_site_access s
      WHERE s.user_id = auth.uid() ORDER BY s.is_default DESC LIMIT 1),
    (SELECT id FROM public.branches WHERE is_legacy_placeholder LIMIT 1)
  );
$$;

-- organisations / site access policies
DROP POLICY IF EXISTS "orgs readable by authenticated" ON public.organisations;
CREATE POLICY "orgs readable by authenticated" ON public.organisations
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "orgs managed by admins" ON public.organisations;
CREATE POLICY "orgs managed by admins" ON public.organisations
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "own site access readable" ON public.user_site_access;
CREATE POLICY "own site access readable" ON public.user_site_access
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- ---------- SCOPED SETTINGS (Stage 1E) ----------
CREATE TABLE IF NOT EXISTS public.settings_scoped (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  value text NOT NULL,
  scope_type text NOT NULL CHECK (scope_type IN ('global','jurisdiction','organisation','site','area','person_type','role')),
  jurisdiction text,
  organisation_id uuid REFERENCES public.organisations(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE,
  wing_id uuid REFERENCES public.wings(id) ON DELETE CASCADE,
  person_type text,
  role text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_settings_scoped ON public.settings_scoped
  (key, scope_type, coalesce(jurisdiction,''), coalesce(organisation_id,'00000000-0000-0000-0000-000000000000'::uuid),
   coalesce(branch_id,'00000000-0000-0000-0000-000000000000'::uuid), coalesce(wing_id,'00000000-0000-0000-0000-000000000000'::uuid),
   coalesce(person_type,''), coalesce(role,''));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.settings_scoped TO authenticated;
GRANT ALL ON public.settings_scoped TO service_role;
ALTER TABLE public.settings_scoped ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scoped settings readable" ON public.settings_scoped;
CREATE POLICY "scoped settings readable" ON public.settings_scoped
  FOR SELECT TO authenticated USING (branch_id IS NULL OR public.user_can_access_site(branch_id));
DROP POLICY IF EXISTS "scoped settings writable by admins" ON public.settings_scoped;
CREATE POLICY "scoped settings writable by admins" ON public.settings_scoped
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_settings_scoped_updated
  BEFORE UPDATE ON public.settings_scoped
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- inheritance resolver: most specific scope wins, falling back to the legacy flat settings table
CREATE OR REPLACE FUNCTION public.resolve_setting(
  p_key text,
  p_branch_id uuid DEFAULT NULL,
  p_wing_id uuid DEFAULT NULL,
  p_person_type text DEFAULT NULL,
  p_role text DEFAULT NULL,
  p_jurisdiction text DEFAULT NULL
) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT value FROM (
    SELECT s.value,
      CASE s.scope_type
        WHEN 'area' THEN 1 WHEN 'site' THEN 2 WHEN 'person_type' THEN 3
        WHEN 'role' THEN 4 WHEN 'organisation' THEN 5 WHEN 'jurisdiction' THEN 6 ELSE 7 END AS rank
    FROM public.settings_scoped s
    WHERE s.key = p_key
      AND (s.wing_id IS NULL OR s.wing_id = p_wing_id)
      AND (s.branch_id IS NULL OR s.branch_id = p_branch_id)
      AND (s.person_type IS NULL OR s.person_type = p_person_type)
      AND (s.role IS NULL OR s.role = p_role)
      AND (s.jurisdiction IS NULL OR s.jurisdiction = p_jurisdiction)
      AND (s.organisation_id IS NULL OR s.organisation_id =
            (SELECT organisation_id FROM public.branches WHERE id = p_branch_id))
    UNION ALL
    SELECT value, 8 FROM public.settings WHERE key = p_key
  ) t ORDER BY rank LIMIT 1;
$$;

-- ---------- DOMAIN BOUNDARY (Stage 1C): identity separated from visits ----------
CREATE TABLE IF NOT EXISTS public.person_types (
  key text PRIMARY KEY,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true
);
GRANT SELECT ON public.person_types TO authenticated, anon;
GRANT ALL ON public.person_types TO service_role;
ALTER TABLE public.person_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "person types readable" ON public.person_types;
CREATE POLICY "person types readable" ON public.person_types FOR SELECT USING (true);
INSERT INTO public.person_types(key,label,sort_order) VALUES
  ('visitor','Visitor',1),('contractor','Contractor',2),('volunteer','Volunteer',3),
  ('staff','Staff',4),('resident','Resident',5)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.visit_statuses (
  key text PRIMARY KEY,
  label text NOT NULL,
  is_open boolean NOT NULL DEFAULT false
);
GRANT SELECT ON public.visit_statuses TO authenticated, anon;
GRANT ALL ON public.visit_statuses TO service_role;
ALTER TABLE public.visit_statuses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "visit statuses readable" ON public.visit_statuses;
CREATE POLICY "visit statuses readable" ON public.visit_statuses FOR SELECT USING (true);
INSERT INTO public.visit_statuses(key,label,is_open) VALUES
  ('checked-in','On site',true),('checked-out','Left',false),('expected','Expected',true)
ON CONFLICT (key) DO NOTHING;

-- person identity (NOT a visit, NOT a resident record)
CREATE TABLE IF NOT EXISTS public.people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  surname text NOT NULL,
  email text,
  mobile text,
  person_qr text UNIQUE,
  default_person_type text REFERENCES public.person_types(key),
  organisation_id uuid REFERENCES public.organisations(id),
  branch_id uuid REFERENCES public.branches(id),
  external_source text,
  external_id text,
  legacy_visitor_id uuid REFERENCES public.visitors(id),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.people TO authenticated;
GRANT ALL ON public.people TO service_role;
ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "people readable within site" ON public.people;
CREATE POLICY "people readable within site" ON public.people
  FOR SELECT TO authenticated USING (public.user_can_access_site(branch_id));
DROP POLICY IF EXISTS "people writable within site" ON public.people;
CREATE POLICY "people writable within site" ON public.people
  FOR ALL TO authenticated USING (public.user_can_access_site(branch_id)) WITH CHECK (public.user_can_access_site(branch_id));
CREATE TRIGGER trg_people_updated BEFORE UPDATE ON public.people
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.branches(id),
  person_id uuid REFERENCES public.people(id),
  person_type text NOT NULL REFERENCES public.person_types(key),
  status text NOT NULL REFERENCES public.visit_statuses(key) DEFAULT 'checked-in',
  check_in_time timestamptz NOT NULL DEFAULT now(),
  check_out_time timestamptz,
  destination_wing_id uuid REFERENCES public.wings(id),
  destination_resident_person_id uuid REFERENCES public.people(id),
  destination_label text,
  group_id uuid,
  source text NOT NULL DEFAULT 'staff',
  legacy_visitor_id uuid REFERENCES public.visitors(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.visits TO authenticated;
GRANT ALL ON public.visits TO service_role;
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "visits readable within site" ON public.visits;
CREATE POLICY "visits readable within site" ON public.visits
  FOR SELECT TO authenticated USING (public.user_can_access_site(branch_id));
DROP POLICY IF EXISTS "visits writable within site" ON public.visits;
CREATE POLICY "visits writable within site" ON public.visits
  FOR ALL TO authenticated USING (public.user_can_access_site(branch_id)) WITH CHECK (public.user_can_access_site(branch_id));
CREATE TRIGGER trg_visits_updated BEFORE UPDATE ON public.visits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX IF NOT EXISTS idx_visits_branch_status ON public.visits(branch_id, status);

CREATE TABLE IF NOT EXISTS public.visit_parties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id uuid NOT NULL REFERENCES public.visits(id) ON DELETE CASCADE,
  person_id uuid REFERENCES public.people(id),
  display_name text NOT NULL,
  relationship text,
  is_primary boolean NOT NULL DEFAULT false,
  check_in_time timestamptz NOT NULL DEFAULT now(),
  check_out_time timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.visit_parties TO authenticated;
GRANT ALL ON public.visit_parties TO service_role;
ALTER TABLE public.visit_parties ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "visit parties follow visit site" ON public.visit_parties;
CREATE POLICY "visit parties follow visit site" ON public.visit_parties
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.visits v WHERE v.id = visit_id AND public.user_can_access_site(v.branch_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.visits v WHERE v.id = visit_id AND public.user_can_access_site(v.branch_id)));
CREATE TRIGGER trg_visit_parties_updated BEFORE UPDATE ON public.visit_parties
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- compatibility link back to the legacy visitors table (read-only view, no data movement yet)
CREATE OR REPLACE VIEW public.v_legacy_visitor_visits AS
  SELECT v.id AS legacy_visitor_id, v.branch_id, v.type AS person_type, v.status,
         v.check_in_time, v.check_out_time, v.group_id,
         nv.id AS visit_id, np.id AS person_id
  FROM public.visitors v
  LEFT JOIN public.visits nv ON nv.legacy_visitor_id = v.id
  LEFT JOIN public.people np ON np.legacy_visitor_id = v.id;
GRANT SELECT ON public.v_legacy_visitor_visits TO authenticated;

-- ---------- AUDIT ----------
INSERT INTO public.audit_log (action, details, performed_by, records_affected)
VALUES ('stage1_foundation_migration',
        jsonb_build_object('scope','tenancy+domain+settings','destructive',false),
        'system', 0);