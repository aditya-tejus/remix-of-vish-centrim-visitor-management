CREATE TABLE public.contractor_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  input_type text NOT NULL DEFAULT 'yesno',
  options jsonb,
  owner_scope text NOT NULL DEFAULT 'visit',
  answered_by text NOT NULL DEFAULT 'contractor',
  validity_days integer,
  required boolean NOT NULL DEFAULT true,
  blocks_on_no boolean NOT NULL DEFAULT false,
  jurisdiction text NOT NULL DEFAULT 'ALL',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contractor_questions TO authenticated;
GRANT SELECT ON public.contractor_questions TO anon;
GRANT ALL ON public.contractor_questions TO service_role;

ALTER TABLE public.contractor_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read contractor questions"
  ON public.contractor_questions FOR SELECT USING (true);
CREATE POLICY "Staff can insert contractor questions"
  ON public.contractor_questions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Staff can update contractor questions"
  ON public.contractor_questions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Staff can delete contractor questions"
  ON public.contractor_questions FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_contractor_questions_updated_at
  BEFORE UPDATE ON public.contractor_questions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.contractor_question_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.contractor_questions(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES public.suppliers_min(id) ON DELETE CASCADE,
  person_id uuid REFERENCES public.contractor_people(id) ON DELETE CASCADE,
  answer jsonb,
  answered_by text,
  answered_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX contractor_question_answers_supplier_key
  ON public.contractor_question_answers (question_id, supplier_id) WHERE supplier_id IS NOT NULL;
CREATE UNIQUE INDEX contractor_question_answers_person_key
  ON public.contractor_question_answers (question_id, person_id) WHERE person_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contractor_question_answers TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.contractor_question_answers TO anon;
GRANT ALL ON public.contractor_question_answers TO service_role;

ALTER TABLE public.contractor_question_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read contractor answers"
  ON public.contractor_question_answers FOR SELECT USING (true);
CREATE POLICY "Kiosk and staff can record contractor answers"
  ON public.contractor_question_answers FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    OR EXISTS (
      SELECT 1 FROM public.contractor_questions q
      WHERE q.id = question_id AND q.answered_by = 'contractor'
    )
  );
CREATE POLICY "Kiosk and staff can update contractor answers"
  ON public.contractor_question_answers FOR UPDATE
  USING (
    auth.uid() IS NOT NULL
    OR EXISTS (
      SELECT 1 FROM public.contractor_questions q
      WHERE q.id = question_id AND q.answered_by = 'contractor'
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    OR EXISTS (
      SELECT 1 FROM public.contractor_questions q
      WHERE q.id = question_id AND q.answered_by = 'contractor'
    )
  );
CREATE POLICY "Staff can delete contractor answers"
  ON public.contractor_question_answers FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_contractor_question_answers_updated_at
  BEFORE UPDATE ON public.contractor_question_answers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();