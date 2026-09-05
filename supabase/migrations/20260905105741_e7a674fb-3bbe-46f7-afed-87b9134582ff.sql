-- Replace the over-broad anonymous kiosk policies with row-scoped ones
DROP POLICY IF EXISTS "Kiosk can read limited visitor columns" ON public.visitors;
DROP POLICY IF EXISTS "Kiosk can update visit status columns" ON public.visitors;

CREATE POLICY "Kiosk can read today's on-site visitors"
ON public.visitors FOR SELECT TO anon
USING (
  COALESCE(safeguarding_hold, false) = false
  AND (
    status = 'checked-in'
    OR check_in_time >= (now() - interval '24 hours')
  )
);

CREATE POLICY "Kiosk can update today's on-site visitors"
ON public.visitors FOR UPDATE TO anon
USING (
  COALESCE(safeguarding_hold, false) = false
  AND (
    status = 'checked-in'
    OR check_in_time >= (now() - interval '24 hours')
  )
)
WITH CHECK (
  COALESCE(safeguarding_hold, false) = false
  AND check_in_time >= (now() - interval '24 hours')
);
