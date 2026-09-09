-- Configuration tables: keep public READ (kiosk needs it), remove anonymous WRITE.
DROP POLICY IF EXISTS "Anyone can insert health questions" ON public.health_questions;
DROP POLICY IF EXISTS "Anyone can update health questions" ON public.health_questions;
DROP POLICY IF EXISTS "Anyone can delete health questions" ON public.health_questions;

DROP POLICY IF EXISTS "Anyone can insert form fields" ON public.form_fields;
DROP POLICY IF EXISTS "Anyone can update form fields" ON public.form_fields;
DROP POLICY IF EXISTS "Anyone can delete form fields" ON public.form_fields;

DROP POLICY IF EXISTS "Anyone can insert vaccination fields" ON public.vaccination_fields;
DROP POLICY IF EXISTS "Anyone can update vaccination fields" ON public.vaccination_fields;
DROP POLICY IF EXISTS "Anyone can delete vaccination fields" ON public.vaccination_fields;

DROP POLICY IF EXISTS "Anyone can insert feedback questions" ON public.feedback_questions;
DROP POLICY IF EXISTS "Anyone can update feedback questions" ON public.feedback_questions;
DROP POLICY IF EXISTS "Anyone can delete feedback questions" ON public.feedback_questions;

DROP POLICY IF EXISTS "Anyone can insert feedback surveys" ON public.feedback_surveys;
DROP POLICY IF EXISTS "Anyone can update feedback surveys" ON public.feedback_surveys;
DROP POLICY IF EXISTS "Anyone can delete feedback surveys" ON public.feedback_surveys;

REVOKE INSERT, UPDATE, DELETE ON public.health_questions, public.form_fields,
  public.vaccination_fields, public.feedback_questions, public.feedback_surveys FROM anon;

-- Settings: full read is for signed-in staff; anon keeps the narrow kiosk policy only.
DROP POLICY IF EXISTS "Anyone can read settings" ON public.settings;
CREATE POLICY "Signed-in staff can read settings"
ON public.settings FOR SELECT TO authenticated USING (true);

-- Contractor answers must not be readable without signing in.
DROP POLICY IF EXISTS "Staff can read contractor answers" ON public.contractor_question_answers;
CREATE POLICY "Signed-in staff can read contractor answers"
ON public.contractor_question_answers FOR SELECT TO authenticated USING (true);