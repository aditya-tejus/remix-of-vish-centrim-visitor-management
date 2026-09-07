ALTER TABLE public.key_issues
  ADD COLUMN IF NOT EXISTS issued_to_staff_id uuid REFERENCES public.staff_members(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS key_issues_issued_to_staff_id_idx ON public.key_issues (issued_to_staff_id);