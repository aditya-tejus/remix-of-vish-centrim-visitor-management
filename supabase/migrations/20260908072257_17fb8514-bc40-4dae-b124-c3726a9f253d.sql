ALTER TABLE public.branch_notification_settings ALTER COLUMN branch_id DROP NOT NULL;

ALTER TABLE public.branch_notification_settings
  DROP CONSTRAINT IF EXISTS branch_notification_settings_branch_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS branch_notification_settings_branch_unique
  ON public.branch_notification_settings (branch_id)
  WHERE branch_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS branch_notification_settings_allsites_unique
  ON public.branch_notification_settings ((branch_id IS NULL))
  WHERE branch_id IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.branch_notification_settings TO authenticated;
GRANT SELECT ON public.branch_notification_settings TO anon;
GRANT ALL ON public.branch_notification_settings TO service_role;