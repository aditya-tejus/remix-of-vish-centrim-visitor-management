
-- ---------- A. Emergency event model ----------
ALTER TABLE public.evacuation_drills
  ADD COLUMN IF NOT EXISTS state text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS event_class text NOT NULL DEFAULT 'drill',
  ADD COLUMN IF NOT EXISTS area_id uuid REFERENCES public.wings(id),
  ADD COLUMN IF NOT EXISTS activated_by uuid,
  ADD COLUMN IF NOT EXISTS snapshot_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_notes text,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid;

UPDATE public.evacuation_drills
   SET state = CASE WHEN status = 'active' THEN 'active' ELSE 'resolved' END,
       event_class = CASE WHEN event_type = 'drill' THEN 'drill' ELSE 'real' END,
       snapshot_at = coalesce(snapshot_at, started_at)
 WHERE state = 'active' AND status <> 'active';

CREATE OR REPLACE FUNCTION public.check_emergency_state()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.state NOT IN ('draft','active','paused','resolved','reviewed') THEN
    RAISE EXCEPTION 'Unsupported emergency state: %', NEW.state;
  END IF;
  IF NEW.event_class NOT IN ('drill','real') THEN
    RAISE EXCEPTION 'Emergency must be classified as drill or real';
  END IF;
  NEW.status := CASE WHEN NEW.state IN ('active','paused','draft') THEN 'active' ELSE 'completed' END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_emergency_state ON public.evacuation_drills;
CREATE TRIGGER trg_emergency_state
  BEFORE INSERT OR UPDATE ON public.evacuation_drills
  FOR EACH ROW EXECUTE FUNCTION public.check_emergency_state();

ALTER TABLE public.evacuation_attendance
  ADD COLUMN IF NOT EXISTS note text;

CREATE OR REPLACE FUNCTION public.check_attendance_status()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status NOT IN ('unaccounted','safe','safe_elsewhere','not_located','assistance_required','evacuated_offsite') THEN
    RAISE EXCEPTION 'Unsupported roll call status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_attendance_status ON public.evacuation_attendance;
CREATE TRIGGER trg_attendance_status
  BEFORE INSERT OR UPDATE ON public.evacuation_attendance
  FOR EACH ROW EXECUTE FUNCTION public.check_attendance_status();

CREATE TABLE IF NOT EXISTS public.emergency_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drill_id uuid NOT NULL REFERENCES public.evacuation_drills(id) ON DELETE CASCADE,
  attendance_id uuid REFERENCES public.evacuation_attendance(id) ON DELETE CASCADE,
  person_name text,
  action text NOT NULL,
  previous_status text,
  new_status text,
  reason text,
  note text,
  actor_user_id uuid,
  actor_label text NOT NULL DEFAULT 'unknown',
  source text NOT NULL DEFAULT 'staff_desktop',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.emergency_actions TO authenticated;
GRANT ALL ON public.emergency_actions TO service_role;
ALTER TABLE public.emergency_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read emergency actions" ON public.emergency_actions;
CREATE POLICY "Staff read emergency actions" ON public.emergency_actions
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Staff record emergency actions" ON public.emergency_actions;
CREATE POLICY "Staff record emergency actions" ON public.emergency_actions
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'emergency.mark_safe'));

CREATE OR REPLACE FUNCTION public.record_emergency_action()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.emergency_actions (
    drill_id, attendance_id, person_name, action, previous_status, new_status,
    note, actor_user_id, actor_label, source
  ) VALUES (
    NEW.drill_id, NEW.id, NEW.person_name,
    CASE WHEN TG_OP = 'INSERT' THEN 'seeded' ELSE 'status_change' END,
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.status ELSE NULL END,
    NEW.status, NEW.note, auth.uid(),
    coalesce(NEW.marked_by, (SELECT email FROM auth.users WHERE id = auth.uid()), 'kiosk'),
    CASE WHEN auth.uid() IS NULL THEN 'kiosk' ELSE 'staff_desktop' END
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_record_emergency_action ON public.evacuation_attendance;
CREATE TRIGGER trg_record_emergency_action
  AFTER INSERT OR UPDATE ON public.evacuation_attendance
  FOR EACH ROW EXECUTE FUNCTION public.record_emergency_action();

-- ---------- Kiosk access log ----------
CREATE TABLE IF NOT EXISTS public.kiosk_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purpose text NOT NULL,
  outcome text NOT NULL,
  branch_id uuid,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.kiosk_access_log TO authenticated;
GRANT ALL ON public.kiosk_access_log TO service_role;
ALTER TABLE public.kiosk_access_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Administrators read kiosk access attempts" ON public.kiosk_access_log;
CREATE POLICY "Administrators read kiosk access attempts" ON public.kiosk_access_log
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ---------- Kiosk emergency: purpose-specific functions only ----------
REVOKE ALL ON public.evacuation_drills FROM anon;
REVOKE ALL ON public.evacuation_attendance FROM anon;
REVOKE ALL ON public.evacuation_points FROM anon;
REVOKE ALL ON public.emergency_actions FROM anon;

CREATE OR REPLACE FUNCTION public.kiosk_emergency_gate(p_pin text, p_purpose text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE recent_failures int; ok boolean;
BEGIN
  SELECT count(*) INTO recent_failures
    FROM public.kiosk_access_log
   WHERE purpose = 'emergency' AND outcome = 'denied'
     AND created_at > now() - interval '15 minutes';

  IF recent_failures >= 5 THEN
    INSERT INTO public.kiosk_access_log (purpose, outcome, detail)
    VALUES ('emergency', 'locked_out', p_purpose);
    RAISE EXCEPTION 'Too many incorrect attempts. Try again later.';
  END IF;

  ok := public.verify_kiosk_pin(p_pin);
  INSERT INTO public.kiosk_access_log (purpose, outcome, detail)
  VALUES ('emergency', CASE WHEN ok THEN 'granted' ELSE 'denied' END, p_purpose);

  IF NOT ok THEN
    RAISE EXCEPTION 'Incorrect PIN';
  END IF;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.kiosk_emergency_rollcall(p_pin text)
RETURNS TABLE(
  attendance_id uuid, drill_id uuid, drill_title text, drill_state text, event_class text,
  person_name text, person_type text, location_label text, contact_phone text,
  status text, assistance_level text, marked_safe_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_drill uuid;
BEGIN
  PERFORM public.kiosk_emergency_gate(p_pin, 'rollcall');
  SELECT id INTO v_drill FROM public.evacuation_drills
   WHERE state IN ('active','paused') ORDER BY started_at DESC LIMIT 1;
  IF v_drill IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT a.id, d.id, d.title, d.state, d.event_class,
         a.person_name, a.person_type,
         nullif(btrim(coalesce(a.area_label,'') || ' ' || coalesce(a.room_label,'')), ''),
         a.contact_phone, a.status, a.assistance_level, a.marked_safe_at
    FROM public.evacuation_attendance a
    JOIN public.evacuation_drills d ON d.id = a.drill_id
   WHERE a.drill_id = v_drill
   ORDER BY a.person_name;
END;
$$;

CREATE OR REPLACE FUNCTION public.kiosk_emergency_mark(
  p_pin text, p_attendance_id uuid, p_status text, p_marked_by text DEFAULT NULL, p_reason text DEFAULT NULL
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_prev text;
BEGIN
  PERFORM public.kiosk_emergency_gate(p_pin, 'mark');
  IF p_status NOT IN ('unaccounted','safe','safe_elsewhere','not_located','assistance_required') THEN
    RAISE EXCEPTION 'Unsupported roll call status';
  END IF;

  SELECT status INTO v_prev FROM public.evacuation_attendance WHERE id = p_attendance_id;
  IF v_prev IS NULL THEN RETURN false; END IF;

  UPDATE public.evacuation_attendance
     SET status = p_status,
         marked_safe_at = CASE WHEN p_status = 'unaccounted' THEN NULL ELSE now() END,
         marked_by = coalesce(nullif(btrim(coalesce(p_marked_by,'')), ''), 'Kiosk (PIN)')
   WHERE id = p_attendance_id;

  IF p_reason IS NOT NULL THEN
    UPDATE public.emergency_actions SET reason = p_reason
     WHERE id = (
       SELECT id FROM public.emergency_actions
        WHERE attendance_id = p_attendance_id
        ORDER BY created_at DESC LIMIT 1
     );
  END IF;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.kiosk_emergency_progress(p_pin text)
RETURNS TABLE(total integer, accounted integer, outstanding integer, drill_title text, event_class text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_drill uuid;
BEGIN
  PERFORM public.kiosk_emergency_gate(p_pin, 'progress');
  SELECT id INTO v_drill FROM public.evacuation_drills
   WHERE state IN ('active','paused') ORDER BY started_at DESC LIMIT 1;
  IF v_drill IS NULL THEN RETURN; END IF;
  RETURN QUERY
  SELECT count(*)::int,
         count(*) FILTER (WHERE a.status IN ('safe','safe_elsewhere'))::int,
         count(*) FILTER (WHERE a.status NOT IN ('safe','safe_elsewhere'))::int,
         d.title, d.event_class
    FROM public.evacuation_attendance a
    JOIN public.evacuation_drills d ON d.id = a.drill_id
   WHERE a.drill_id = v_drill
   GROUP BY d.title, d.event_class;
END;
$$;

GRANT EXECUTE ON FUNCTION public.kiosk_emergency_rollcall(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kiosk_emergency_mark(text, uuid, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kiosk_emergency_progress(text) TO anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.kiosk_emergency_gate(text, text) FROM anon, authenticated;
