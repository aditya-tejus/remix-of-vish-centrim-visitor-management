
-- Phase 5: Database Foundation

-- 1. Create staff_members table
CREATE TABLE public.staff_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  surname text NOT NULL,
  role text NOT NULL DEFAULT 'staff',
  department text,
  phone text,
  email text,
  is_active boolean NOT NULL DEFAULT true,
  branch_id uuid REFERENCES public.branches(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read staff members" ON public.staff_members
  FOR SELECT TO public USING (true);

CREATE POLICY "Admins can insert staff members" ON public.staff_members
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update staff members" ON public.staff_members
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete staff members" ON public.staff_members
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- 2. Extend resident_details
ALTER TABLE public.resident_details
  ADD COLUMN IF NOT EXISTS mobility_level text DEFAULT 'independent',
  ADD COLUMN IF NOT EXISTS dols_lps_flag boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS risk_assessment_level text DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS medication_notes text,
  ADD COLUMN IF NOT EXISTS mobility_aids text[],
  ADD COLUMN IF NOT EXISTS destination_categories text[];

-- 3. Extend visitors
ALTER TABLE public.visitors
  ADD COLUMN IF NOT EXISTS group_id uuid,
  ADD COLUMN IF NOT EXISTS work_type text,
  ADD COLUMN IF NOT EXISTS work_location text,
  ADD COLUMN IF NOT EXISTS print_status text DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS qr_code text,
  ADD COLUMN IF NOT EXISTS visit_purpose text,
  ADD COLUMN IF NOT EXISTS visited_resident_ids uuid[],
  ADD COLUMN IF NOT EXISTS safeguarding_hold boolean DEFAULT false;

-- 4. Extend audit_log
ALTER TABLE public.audit_log
  ADD COLUMN IF NOT EXISTS change_reason text;

-- 5. Seed staff members
INSERT INTO public.staff_members (first_name, surname, role, department, phone, email) VALUES
  ('Helen', 'Carter', 'GP', 'Medical', '07700 900100', 'helen.carter@care.example'),
  ('Amy', 'Roberts', 'Nurse', 'Care', '07700 900101', 'amy.roberts@care.example'),
  ('Mark', 'Stevens', 'Manager', 'Admin', '07700 900102', 'mark.stevens@care.example'),
  ('Sarah', 'Thompson', 'Carer', 'Care', '07700 900103', 'sarah.thompson@care.example'),
  ('David', 'Wilson', 'Physiotherapist', 'Allied Health', '07700 900104', 'david.wilson@care.example'),
  ('Jane', 'Brown', 'Activities Coordinator', 'Wellbeing', '07700 900105', 'jane.brown@care.example');

-- 6. Seed resident records (visitors of type resident + resident_details)
-- First create visitor records for residents
INSERT INTO public.visitors (first_name, surname, email, mobile, type, status, address, whom_to_visit)
VALUES
  ('Mary', 'Johnson', 'family.johnson@example.com', '07700 800001', 'resident', 'checked-in', 'Room 12, East Wing', ''),
  ('Robert', 'Davis', 'family.davis@example.com', '07700 800002', 'resident', 'checked-in', 'Room 8, West Wing', ''),
  ('Patricia', 'Wilson', 'family.wilson@example.com', '07700 800003', 'resident', 'checked-in', 'Room 3, East Wing', ''),
  ('George', 'Thompson', 'family.thompson@example.com', '07700 800004', 'resident', 'checked-in', 'Room 15, North Wing', ''),
  ('Dorothy', 'Brown', 'family.brown@example.com', '07700 800005', 'resident', 'checked-in', 'Room 6, East Wing', ''),
  ('Frank', 'Harris', 'family.harris@example.com', '07700 800006', 'resident', 'checked-in', 'Room 21, South Wing', ''),
  ('Betty', 'Clark', 'family.clark@example.com', '07700 800007', 'resident', 'checked-in', 'Room 9, West Wing', ''),
  ('Harold', 'Lewis', 'family.lewis@example.com', '07700 800008', 'resident', 'checked-in', 'Room 18, North Wing', '');

-- Now create resident_details for each (linking by matching first_name + surname)
INSERT INTO public.resident_details (visitor_id, room, care_level, key_worker, emergency_contact_name, emergency_contact_phone, mobility_level, dols_lps_flag, risk_assessment_level, notes)
SELECT v.id, 
  CASE 
    WHEN v.first_name = 'Mary' THEN '12'
    WHEN v.first_name = 'Robert' THEN '8'
    WHEN v.first_name = 'Patricia' THEN '3'
    WHEN v.first_name = 'George' THEN '15'
    WHEN v.first_name = 'Dorothy' THEN '6'
    WHEN v.first_name = 'Frank' THEN '21'
    WHEN v.first_name = 'Betty' THEN '9'
    WHEN v.first_name = 'Harold' THEN '18'
  END,
  CASE 
    WHEN v.first_name IN ('Mary', 'George') THEN 'high'
    WHEN v.first_name IN ('Frank', 'Betty') THEN 'low'
    ELSE 'standard'
  END,
  CASE 
    WHEN v.first_name IN ('Mary', 'Robert', 'Patricia', 'George') THEN 'Amy Roberts'
    ELSE 'Sarah Thompson'
  END,
  CASE 
    WHEN v.first_name = 'Mary' THEN 'Tom Johnson'
    WHEN v.first_name = 'Robert' THEN 'Linda Davis'
    WHEN v.first_name = 'Patricia' THEN 'James Wilson'
    WHEN v.first_name = 'George' THEN 'Susan Thompson'
    WHEN v.first_name = 'Dorothy' THEN 'Richard Brown'
    WHEN v.first_name = 'Frank' THEN 'Karen Harris'
    WHEN v.first_name = 'Betty' THEN 'Michael Clark'
    WHEN v.first_name = 'Harold' THEN 'Nancy Lewis'
  END,
  CASE 
    WHEN v.first_name = 'Mary' THEN '07700 700001'
    WHEN v.first_name = 'Robert' THEN '07700 700002'
    WHEN v.first_name = 'Patricia' THEN '07700 700003'
    WHEN v.first_name = 'George' THEN '07700 700004'
    WHEN v.first_name = 'Dorothy' THEN '07700 700005'
    WHEN v.first_name = 'Frank' THEN '07700 700006'
    WHEN v.first_name = 'Betty' THEN '07700 700007'
    WHEN v.first_name = 'Harold' THEN '07700 700008'
  END,
  CASE 
    WHEN v.first_name IN ('Mary', 'George') THEN 'wheelchair'
    WHEN v.first_name IN ('Betty', 'Harold') THEN 'walker'
    ELSE 'independent'
  END,
  CASE WHEN v.first_name = 'George' THEN true ELSE false END,
  CASE 
    WHEN v.first_name IN ('Mary', 'George') THEN 'high'
    WHEN v.first_name IN ('Frank') THEN 'low'
    ELSE 'standard'
  END,
  NULL
FROM public.visitors v
WHERE v.type = 'resident' AND v.first_name IN ('Mary', 'Robert', 'Patricia', 'George', 'Dorothy', 'Frank', 'Betty', 'Harold')
AND NOT EXISTS (SELECT 1 FROM public.resident_details rd WHERE rd.visitor_id = v.id);

-- Enable realtime for staff_members
ALTER PUBLICATION supabase_realtime ADD TABLE public.staff_members;
