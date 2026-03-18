-- Add visitor_type column to health_questions
ALTER TABLE public.health_questions
ADD COLUMN visitor_type text NOT NULL DEFAULT 'visitor';

-- Update existing rows to 'visitor' (the default)
-- No action needed since DEFAULT handles it

-- Add visitor_type column to vaccination_fields
ALTER TABLE public.vaccination_fields
ADD COLUMN visitor_type text NOT NULL DEFAULT 'visitor';

-- Add indexes for filtering
CREATE INDEX idx_health_questions_visitor_type ON public.health_questions(visitor_type);
CREATE INDEX idx_vaccination_fields_visitor_type ON public.vaccination_fields(visitor_type);