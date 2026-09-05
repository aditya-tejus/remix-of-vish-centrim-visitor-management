CREATE OR REPLACE FUNCTION public.apply_watchlist_legal_hold()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.legal_hold IS TRUE THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.visitor_watchlist w
    WHERE w.is_active IS TRUE
      AND lower(btrim(w.first_name)) = lower(btrim(NEW.first_name))
      AND lower(btrim(w.surname)) = lower(btrim(NEW.surname))
  ) THEN
    NEW.legal_hold := true;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_watchlist_legal_hold() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_visitors_watchlist_legal_hold ON public.visitors;
CREATE TRIGGER trg_visitors_watchlist_legal_hold
BEFORE INSERT OR UPDATE OF first_name, surname ON public.visitors
FOR EACH ROW EXECUTE FUNCTION public.apply_watchlist_legal_hold();

UPDATE public.visitors v
SET legal_hold = true
WHERE v.legal_hold IS NOT TRUE
  AND EXISTS (
    SELECT 1 FROM public.visitor_watchlist w
    WHERE w.is_active IS TRUE
      AND lower(btrim(w.first_name)) = lower(btrim(v.first_name))
      AND lower(btrim(w.surname)) = lower(btrim(v.surname))
  );