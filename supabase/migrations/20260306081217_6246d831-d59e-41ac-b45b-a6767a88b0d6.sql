
-- Seed photo_capture, signature_capture, and responsible_staff as dynamic form fields for each visitor type
INSERT INTO public.form_fields (field_key, label, field_type, required, sort_order, is_active, visitor_type)
SELECT field_key, label, field_type, required, sort_order, is_active, visitor_type
FROM (VALUES
  ('photo_capture', 'Photo Required', 'photo', false, 100, false, 'visitor'),
  ('signature_capture', 'Signature Required', 'signature', false, 101, false, 'visitor'),
  ('responsible_staff', 'Responsible Staff', 'text', false, 102, false, 'visitor'),
  ('photo_capture', 'Photo Required', 'photo', false, 100, false, 'contractor'),
  ('signature_capture', 'Signature Required', 'signature', false, 101, false, 'contractor'),
  ('responsible_staff', 'Responsible Staff', 'text', false, 102, false, 'contractor'),
  ('photo_capture', 'Photo Required', 'photo', false, 100, false, 'resident'),
  ('signature_capture', 'Signature Required', 'signature', false, 101, false, 'resident'),
  ('responsible_staff', 'Responsible Staff', 'text', false, 102, false, 'resident'),
  ('photo_capture', 'Photo Required', 'photo', false, 100, false, 'staff'),
  ('signature_capture', 'Signature Required', 'signature', false, 101, false, 'staff'),
  ('responsible_staff', 'Responsible Staff', 'text', false, 102, false, 'staff')
) AS t(field_key, label, field_type, required, sort_order, is_active, visitor_type)
WHERE NOT EXISTS (
  SELECT 1 FROM public.form_fields ff WHERE ff.field_key = t.field_key AND ff.visitor_type = t.visitor_type
);
