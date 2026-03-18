ALTER TABLE public.visitors ADD COLUMN expected_return_date timestamp with time zone DEFAULT NULL;
ALTER TABLE public.visitors ADD COLUMN checkout_reason text DEFAULT NULL;