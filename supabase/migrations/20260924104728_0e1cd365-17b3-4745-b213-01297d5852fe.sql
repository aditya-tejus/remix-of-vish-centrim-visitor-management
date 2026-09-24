INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM auth.users WHERE email = 'info@ecaret.com.au'
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.audit_log (action, details, records_affected, performed_by, user_id, change_reason)
SELECT 'role_granted', jsonb_build_object('account', 'info@ecaret.com.au', 'role', 'admin'), 1, 'system (owner request)', id, 'Owner asked for this account to be able to edit settings'
FROM auth.users WHERE email = 'info@ecaret.com.au';