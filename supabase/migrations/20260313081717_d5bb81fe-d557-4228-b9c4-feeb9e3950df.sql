
-- Leave requests table for approval workflow
CREATE TABLE public.leave_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id UUID REFERENCES public.visitors(id) ON DELETE CASCADE,
  resident_name TEXT NOT NULL,
  resident_room TEXT,
  resident_wing TEXT,
  leave_type TEXT,
  reason TEXT,
  expected_departure TIMESTAMP WITH TIME ZONE,
  expected_return TIMESTAMP WITH TIME ZONE,
  companions JSONB DEFAULT '[]'::jsonb,
  comments TEXT DEFAULT '',
  source TEXT NOT NULL DEFAULT 'manual', -- 'manual' | 'external'
  external_reference TEXT, -- ID from external system
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected'
  reviewed_by TEXT,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read leave requests" ON public.leave_requests FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can insert leave requests" ON public.leave_requests FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Authenticated can update leave requests" ON public.leave_requests FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can delete leave requests" ON public.leave_requests FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.leave_requests;
