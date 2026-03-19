
-- Create feedback_surveys table
CREATE TABLE public.feedback_surveys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  assigned_types TEXT[] NOT NULL DEFAULT ARRAY['visitor']::TEXT[],
  trigger_point TEXT NOT NULL DEFAULT 'checkout',
  source TEXT NOT NULL DEFAULT 'built_in',
  external_url TEXT DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add survey_id to feedback_questions (nullable for backward compat)
ALTER TABLE public.feedback_questions ADD COLUMN survey_id UUID REFERENCES public.feedback_surveys(id) ON DELETE CASCADE;

-- Add survey_id to feedback_responses for grouping
ALTER TABLE public.feedback_responses ADD COLUMN survey_id UUID REFERENCES public.feedback_surveys(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.feedback_surveys ENABLE ROW LEVEL SECURITY;

-- RLS policies for feedback_surveys
CREATE POLICY "Anyone can read feedback surveys" ON public.feedback_surveys FOR SELECT USING (true);
CREATE POLICY "Admins can insert feedback surveys" ON public.feedback_surveys FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update feedback surveys" ON public.feedback_surveys FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete feedback surveys" ON public.feedback_surveys FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
