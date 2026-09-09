CREATE OR REPLACE FUNCTION public.log_config_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_before jsonb := '{}'::jsonb;
  v_after jsonb := '{}'::jsonb;
  v_changed jsonb := '{}'::jsonb;
  v_key text;
  v_action text;
  v_reason text := NULLIF(current_setting('app.change_reason', true), '');
  v_branch uuid := NULL;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_after := to_jsonb(NEW);
    v_action := TG_TABLE_NAME || '.created';
  ELSIF TG_OP = 'DELETE' THEN
    v_before := to_jsonb(OLD);
    v_action := TG_TABLE_NAME || '.deleted';
  ELSE
    v_before := to_jsonb(OLD);
    v_after := to_jsonb(NEW);
    v_action := TG_TABLE_NAME || '.updated';
    FOR v_key IN SELECT jsonb_object_keys(v_after) LOOP
      IF v_key NOT IN ('updated_at') AND (v_before -> v_key) IS DISTINCT FROM (v_after -> v_key) THEN
        v_changed := v_changed || jsonb_build_object(
          v_key, jsonb_build_object(
            'before', COALESCE(v_before -> v_key, 'null'::jsonb),
            'after', COALESCE(v_after -> v_key, 'null'::jsonb)
          )
        );
      END IF;
    END LOOP;
    IF v_changed = '{}'::jsonb THEN
      RETURN COALESCE(NEW, OLD);
    END IF;
  END IF;

  IF TG_TABLE_NAME = 'settings' THEN
    v_action := 'setting.' || lower(TG_OP);
  END IF;

  BEGIN
    v_branch := NULLIF(COALESCE(v_after ->> 'branch_id', v_before ->> 'branch_id'), '')::uuid;
  EXCEPTION WHEN others THEN
    v_branch := NULL;
  END;

  INSERT INTO public.audit_log (action, details, records_affected, performed_by, user_id, change_reason)
  VALUES (
    v_action,
    jsonb_build_object(
      'table', TG_TABLE_NAME,
      'operation', TG_OP,
      'record_id', COALESCE(v_after ->> 'id', v_before ->> 'id'),
      'branch_id', v_branch,
      'label', COALESCE(v_after ->> 'label', v_after ->> 'question', v_after ->> 'key',
                        v_before ->> 'label', v_before ->> 'question', v_before ->> 'key'),
      'visitor_type', COALESCE(v_after ->> 'visitor_type', v_before ->> 'visitor_type'),
      'changes', CASE WHEN TG_OP = 'UPDATE' THEN v_changed ELSE NULL END,
      'before', CASE WHEN TG_OP = 'DELETE' THEN v_before ELSE NULL END,
      'after', CASE WHEN TG_OP = 'INSERT' THEN v_after ELSE NULL END
    ),
    1,
    COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), 'System'),
    auth.uid(),
    v_reason
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.log_config_change() FROM public, anon, authenticated;