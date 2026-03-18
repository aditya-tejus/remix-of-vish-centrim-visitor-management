
-- Create leave_types table for dynamic management
CREATE TABLE public.leave_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  emoji text NOT NULL DEFAULT '📋',
  description text DEFAULT '',
  color text DEFAULT 'amber',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.leave_types ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Anyone can read leave types" ON public.leave_types FOR SELECT USING (true);
CREATE POLICY "Admins can insert leave types" ON public.leave_types FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update leave types" ON public.leave_types FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete leave types" ON public.leave_types FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- Seed default leave types
INSERT INTO public.leave_types (name, emoji, description, sort_order) VALUES
  ('Social Leave', '🏖️', 'Family visit, shopping, outing', 0),
  ('Hospital Leave', '🏥', 'Medical appointment or hospital admission', 1),
  ('Overnight Leave', '🌙', 'Staying away overnight', 2),
  ('Medical Appointment', '👨‍⚕️', 'Doctor, dentist, or specialist visit', 3),
  ('Temporary Leave', '⏳', 'Short-term absence', 4),
  ('Emergency Leave', '🚨', 'Urgent or unplanned departure', 5),
  ('Respite Leave', '🏡', 'Planned respite or short break', 6),
  ('Permanent Exit', '📦', 'Permanent departure from facility', 7);
