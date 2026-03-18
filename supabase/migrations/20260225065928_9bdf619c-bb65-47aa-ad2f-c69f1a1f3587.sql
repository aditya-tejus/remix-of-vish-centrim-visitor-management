-- ============================================
-- EMERGENCY EVACUATION SYSTEM
-- ============================================

-- Evacuation points (pre-configured locations)
CREATE TABLE public.evacuation_points (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text DEFAULT '',
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.evacuation_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read evacuation points" ON public.evacuation_points FOR SELECT USING (true);
CREATE POLICY "Admins can insert evacuation points" ON public.evacuation_points FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update evacuation points" ON public.evacuation_points FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete evacuation points" ON public.evacuation_points FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Evacuation drills
CREATE TABLE public.evacuation_drills (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL DEFAULT 'Evacuation Drill',
  status text NOT NULL DEFAULT 'active',
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  started_by text NOT NULL DEFAULT 'system',
  notes text DEFAULT '',
  total_people integer NOT NULL DEFAULT 0,
  accounted_for integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.evacuation_drills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read evacuation drills" ON public.evacuation_drills FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert drills" ON public.evacuation_drills FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can update drills" ON public.evacuation_drills FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Evacuation attendance (per person tracking)
CREATE TABLE public.evacuation_attendance (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  drill_id uuid NOT NULL REFERENCES public.evacuation_drills(id) ON DELETE CASCADE,
  person_name text NOT NULL,
  person_type text NOT NULL DEFAULT 'visitor',
  visitor_id uuid REFERENCES public.visitors(id) ON DELETE SET NULL,
  evacuation_point_id uuid REFERENCES public.evacuation_points(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'unaccounted',
  marked_safe_at timestamptz,
  marked_by text,
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.evacuation_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read evacuation attendance" ON public.evacuation_attendance FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert attendance" ON public.evacuation_attendance FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can update attendance" ON public.evacuation_attendance FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Enable realtime for evacuation
ALTER PUBLICATION supabase_realtime ADD TABLE public.evacuation_drills;
ALTER PUBLICATION supabase_realtime ADD TABLE public.evacuation_attendance;

-- Seed default evacuation points
INSERT INTO public.evacuation_points (name, description, is_default, sort_order) VALUES
  ('Front Car Park', 'Main assembly point at front entrance', true, 1),
  ('Rear Garden', 'Secondary assembly point at rear garden', true, 2),
  ('Side Gate', 'Side exit assembly area', false, 3);

-- ============================================
-- VISITOR FEEDBACK SYSTEM
-- ============================================

-- Feedback questions (configurable)
CREATE TABLE public.feedback_questions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  question text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.feedback_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read feedback questions" ON public.feedback_questions FOR SELECT USING (true);
CREATE POLICY "Admins can insert feedback questions" ON public.feedback_questions FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update feedback questions" ON public.feedback_questions FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete feedback questions" ON public.feedback_questions FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Feedback responses
CREATE TABLE public.feedback_responses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id uuid REFERENCES public.visitors(id) ON DELETE SET NULL,
  visitor_name text NOT NULL DEFAULT '',
  visitor_type text NOT NULL DEFAULT 'visitor',
  question_id uuid NOT NULL REFERENCES public.feedback_questions(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.feedback_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read feedback responses" ON public.feedback_responses FOR SELECT USING (true);
CREATE POLICY "Anyone can insert feedback responses" ON public.feedback_responses FOR INSERT WITH CHECK (true);

-- Seed default feedback questions
INSERT INTO public.feedback_questions (question, category, sort_order) VALUES
  ('How would you rate your overall visit experience?', 'general', 1),
  ('How welcoming was the staff?', 'staff', 2),
  ('How clean and comfortable was the environment?', 'environment', 3),
  ('How would you rate the communication about your visit?', 'communication', 4),
  ('Would you recommend this care home to others?', 'general', 5);
