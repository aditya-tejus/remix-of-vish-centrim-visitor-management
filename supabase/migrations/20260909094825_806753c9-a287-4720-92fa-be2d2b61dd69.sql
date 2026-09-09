REVOKE ALL ON FUNCTION public.log_config_change() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_config_setting_change() FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.log_config_setting_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text := COALESCE(NEW.key, OLD.key);
BEGIN
  IF v_key ~ '(screening_enabled_|vaccination_enabled_|privacy_required_|person_type_|outbreak_mode)' THEN
    RETURN public.log_config_change();
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.log_config_setting_change() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS audit_config_settings ON public.settings;
CREATE TRIGGER audit_config_settings
AFTER INSERT OR UPDATE OR DELETE ON public.settings
FOR EACH ROW EXECUTE FUNCTION public.log_config_setting_change();