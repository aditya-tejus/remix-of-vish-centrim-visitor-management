-- Allow public inserts on health_questions
CREATE POLICY "Anyone can insert health questions"
ON public.health_questions FOR INSERT
TO public
WITH CHECK (true);

-- Allow public updates on health_questions
CREATE POLICY "Anyone can update health questions"
ON public.health_questions FOR UPDATE
TO public
USING (true);

-- Allow public deletes on health_questions
CREATE POLICY "Anyone can delete health questions"
ON public.health_questions FOR DELETE
TO public
USING (true);

-- Allow public inserts on form_fields
CREATE POLICY "Anyone can insert form fields"
ON public.form_fields FOR INSERT
TO public
WITH CHECK (true);

-- Allow public updates on form_fields
CREATE POLICY "Anyone can update form fields"
ON public.form_fields FOR UPDATE
TO public
USING (true);

-- Allow public deletes on form_fields
CREATE POLICY "Anyone can delete form fields"
ON public.form_fields FOR DELETE
TO public
USING (true);

-- Allow public inserts on vaccination_fields
CREATE POLICY "Anyone can insert vaccination fields"
ON public.vaccination_fields FOR INSERT
TO public
WITH CHECK (true);

-- Allow public updates on vaccination_fields
CREATE POLICY "Anyone can update vaccination fields"
ON public.vaccination_fields FOR UPDATE
TO public
USING (true);

-- Allow public deletes on vaccination_fields
CREATE POLICY "Anyone can delete vaccination fields"
ON public.vaccination_fields FOR DELETE
TO public
USING (true);

-- Allow public inserts on feedback_surveys
CREATE POLICY "Anyone can insert feedback surveys"
ON public.feedback_surveys FOR INSERT
TO public
WITH CHECK (true);

-- Allow public updates on feedback_surveys
CREATE POLICY "Anyone can update feedback surveys"
ON public.feedback_surveys FOR UPDATE
TO public
USING (true);

-- Allow public deletes on feedback_surveys
CREATE POLICY "Anyone can delete feedback surveys"
ON public.feedback_surveys FOR DELETE
TO public
USING (true);

-- Allow public inserts on feedback_questions
CREATE POLICY "Anyone can insert feedback questions"
ON public.feedback_questions FOR INSERT
TO public
WITH CHECK (true);

-- Allow public updates on feedback_questions
CREATE POLICY "Anyone can update feedback questions"
ON public.feedback_questions FOR UPDATE
TO public
USING (true);

-- Allow public deletes on feedback_questions
CREATE POLICY "Anyone can delete feedback questions"
ON public.feedback_questions FOR DELETE
TO public
USING (true);

-- Also relax settings table
CREATE POLICY "Anyone can insert settings"
ON public.settings FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY "Anyone can update settings"
ON public.settings FOR UPDATE
TO public
USING (true);