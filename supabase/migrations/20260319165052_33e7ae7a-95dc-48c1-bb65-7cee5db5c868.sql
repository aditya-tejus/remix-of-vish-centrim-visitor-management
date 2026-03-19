INSERT INTO settings (key, value) VALUES
  ('kiosk_resident_lookup_mode', 'search_first'),
  ('kiosk_staff_lookup_mode', 'search_first')
ON CONFLICT (key) DO NOTHING;