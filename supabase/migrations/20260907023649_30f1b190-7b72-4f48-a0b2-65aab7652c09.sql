DELETE FROM public.settings WHERE key = 'contractor_credential_enforcement';
INSERT INTO public.settings (key, value) VALUES ('contractor_mandatory_credentials', '[]')
ON CONFLICT (key) DO NOTHING;