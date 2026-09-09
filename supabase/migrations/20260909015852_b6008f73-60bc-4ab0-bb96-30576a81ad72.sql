-- Phase 7C: additive fields on the existing check-in record. No new group or people model.
ALTER TABLE public.visitors
  ADD COLUMN IF NOT EXISTS group_label text,
  ADD COLUMN IF NOT EXISTS group_organiser_name text,
  ADD COLUMN IF NOT EXISTS group_organiser_contact text,
  ADD COLUMN IF NOT EXISTS terms_confirmed_by text,
  ADD COLUMN IF NOT EXISTS terms_confirmation_mode text,
  ADD COLUMN IF NOT EXISTS volunteer_role text,
  ADD COLUMN IF NOT EXISTS volunteer_supervisor text,
  ADD COLUMN IF NOT EXISTS volunteer_expected_end timestamptz,
  ADD COLUMN IF NOT EXISTS visit_reason_other text;

COMMENT ON COLUMN public.visitors.terms_confirmation_mode IS
  'self = the person confirmed for themselves; organiser_declared = an organiser confirmed on behalf of an assisted/child attendee.';

CREATE INDEX IF NOT EXISTS visitors_group_id_idx ON public.visitors (group_id) WHERE group_id IS NOT NULL;

-- "Other" is available but inactive: a site must switch it on before it appears anywhere.
INSERT INTO public.person_types (key, label, sort_order, is_active)
VALUES ('other', 'Other', 6, false)
ON CONFLICT (key) DO NOTHING;