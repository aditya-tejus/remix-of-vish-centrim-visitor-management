-- 1. Outcome rules live on the question itself (all additive and nullable)
ALTER TABLE public.health_questions
  ADD COLUMN IF NOT EXISTS expected_answer text,
  ADD COLUMN IF NOT EXISTS warning_answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS severity text NOT NULL DEFAULT 'info',
  ADD COLUMN IF NOT EXISTS staff_message text,
  ADD COLUMN IF NOT EXISTS outcome_action text NOT NULL DEFAULT 'none';

ALTER TABLE public.health_questions
  ADD CONSTRAINT health_questions_severity_chk CHECK (severity IN ('info','warning','critical')),
  ADD CONSTRAINT health_questions_action_chk CHECK (outcome_action IN ('none','flag','block'));

-- 2. Outcome recorded on the arrival (no duplicate copy of sensitive answers)
ALTER TABLE public.visitors
  ADD COLUMN IF NOT EXISTS screening_outcome text,
  ADD COLUMN IF NOT EXISTS screening_flags jsonb;

-- 3. Permissioned supervisor override for a blocked sign-in
CREATE OR REPLACE FUNCTION public.override_screening_block(p_reason text, p_context jsonb DEFAULT '{}'::jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in before approving a blocked check-in';
  END IF;
  IF NOT (public.has_permission(auth.uid(), 'settings.administer')
          AND public.has_permission(auth.uid(), 'screening.view')) THEN
    RAISE EXCEPTION 'You do not have permission to approve a blocked check-in';
  END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) < 10 THEN
    RAISE EXCEPTION 'A reason of at least 10 characters is required';
  END IF;

  INSERT INTO public.audit_log (action, details, records_affected, performed_by, user_id, change_reason)
  VALUES (
    'screening.block_overridden',
    COALESCE(p_context, '{}'::jsonb),
    1,
    COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), 'Staff'),
    auth.uid(),
    btrim(p_reason)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.override_screening_block(text, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.override_screening_block(text, jsonb) TO authenticated;

-- 4. Configuration auditing written by the database, so it cannot be skipped
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
    -- only the columns that actually changed
    FOR v_key IN SELECT jsonb_object_keys(v_after) LOOP
      IF v_key NOT IN ('updated_at') AND (v_before -> v_key) IS DISTINCT FROM (v_after -> v_key) THEN
        v_changed := v_changed || jsonb_build_object(
          v_key, jsonb_build_object('before', v_before -> v_key, 'after', v_after -> v_key)
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
    jsonb_strip_nulls(jsonb_build_object(
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
    )),
    1,
    COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), 'System'),
    auth.uid(),
    v_reason
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Only the configuration keys this stage governs are audited on settings
CREATE OR REPLACE FUNCTION public.log_config_setting_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text := COALESCE(NEW.key, OLD.key);
BEGIN
  IF v_key ~ '^(screening_enabled_|vaccination_enabled_|privacy_required_|person_type_)'
     OR v_key ~ '@(screening_enabled_|vaccination_enabled_|privacy_required_|person_type_)'
     OR v_key LIKE 'site:%' THEN
    RETURN public.log_config_change();
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS audit_health_questions ON public.health_questions;
CREATE TRIGGER audit_health_questions
AFTER INSERT OR UPDATE OR DELETE ON public.health_questions
FOR EACH ROW EXECUTE FUNCTION public.log_config_change();

DROP TRIGGER IF EXISTS audit_vaccination_fields ON public.vaccination_fields;
CREATE TRIGGER audit_vaccination_fields
AFTER INSERT OR UPDATE OR DELETE ON public.vaccination_fields
FOR EACH ROW EXECUTE FUNCTION public.log_config_change();

DROP TRIGGER IF EXISTS audit_form_fields ON public.form_fields;
CREATE TRIGGER audit_form_fields
AFTER INSERT OR UPDATE OR DELETE ON public.form_fields
FOR EACH ROW EXECUTE FUNCTION public.log_config_change();