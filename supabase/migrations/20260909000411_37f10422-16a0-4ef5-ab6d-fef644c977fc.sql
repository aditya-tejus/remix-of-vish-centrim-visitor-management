-- A closed emergency is a point-in-time record. Once it is resolved, the only
-- permitted change is adding the post-event review (and moving resolved ->
-- reviewed). Nothing else may be altered, and it can never be reopened.
CREATE OR REPLACE FUNCTION public.guard_closed_drill()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.state NOT IN ('resolved','reviewed') THEN
    RETURN NEW;
  END IF;

  -- Only resolved -> reviewed is allowed; never back to an open state.
  IF NEW.state <> OLD.state AND NOT (OLD.state = 'resolved' AND NEW.state = 'reviewed') THEN
    RAISE EXCEPTION 'This emergency is closed and cannot be reopened or changed.';
  END IF;

  IF NEW.title IS DISTINCT FROM OLD.title
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.event_type IS DISTINCT FROM OLD.event_type
     OR NEW.event_class IS DISTINCT FROM OLD.event_class
     OR NEW.branch_id IS DISTINCT FROM OLD.branch_id
     OR NEW.area_id IS DISTINCT FROM OLD.area_id
     OR NEW.started_at IS DISTINCT FROM OLD.started_at
     OR NEW.started_by IS DISTINCT FROM OLD.started_by
     OR NEW.ended_at IS DISTINCT FROM OLD.ended_at
     OR NEW.snapshot_at IS DISTINCT FROM OLD.snapshot_at
     OR NEW.total_people IS DISTINCT FROM OLD.total_people
     OR NEW.accounted_for IS DISTINCT FROM OLD.accounted_for
     OR NEW.notes IS DISTINCT FROM OLD.notes
     OR NEW.unaccounted_reason IS DISTINCT FROM OLD.unaccounted_reason
  THEN
    RAISE EXCEPTION 'This emergency is closed. Its record cannot be changed — add a review note instead.';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_guard_closed_drill ON public.evacuation_drills;
CREATE TRIGGER trg_guard_closed_drill
BEFORE UPDATE ON public.evacuation_drills
FOR EACH ROW EXECUTE FUNCTION public.guard_closed_drill();

REVOKE ALL ON FUNCTION public.guard_closed_drill() FROM anon, authenticated;