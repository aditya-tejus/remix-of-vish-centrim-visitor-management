CREATE OR REPLACE FUNCTION public.inherit_attendance_branch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.branch_id IS NULL THEN
    SELECT branch_id INTO NEW.branch_id FROM public.evacuation_drills WHERE id = NEW.drill_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inherit_attendance_branch ON public.evacuation_attendance;
CREATE TRIGGER trg_inherit_attendance_branch
BEFORE INSERT ON public.evacuation_attendance
FOR EACH ROW EXECUTE FUNCTION public.inherit_attendance_branch();

CREATE INDEX IF NOT EXISTS idx_evac_drills_open_branch
  ON public.evacuation_drills(branch_id, started_at DESC)
  WHERE state IN ('draft','active','paused');