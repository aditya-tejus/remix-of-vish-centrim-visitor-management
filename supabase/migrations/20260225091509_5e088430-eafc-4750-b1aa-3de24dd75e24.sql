ALTER TABLE public.feedback_questions ADD COLUMN visitor_type text NOT NULL DEFAULT 'visitor';

-- Update existing questions to apply to all types by duplicating them
INSERT INTO public.feedback_questions (question, category, is_active, sort_order, visitor_type)
SELECT question, category, is_active, sort_order, 'contractor' FROM public.feedback_questions WHERE visitor_type = 'visitor';

INSERT INTO public.feedback_questions (question, category, is_active, sort_order, visitor_type)
SELECT question, category, is_active, sort_order, 'resident' FROM public.feedback_questions WHERE visitor_type = 'visitor';

INSERT INTO public.feedback_questions (question, category, is_active, sort_order, visitor_type)
SELECT question, category, is_active, sort_order, 'staff' FROM public.feedback_questions WHERE visitor_type = 'visitor';