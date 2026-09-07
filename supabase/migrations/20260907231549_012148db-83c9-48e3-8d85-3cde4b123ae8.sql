CREATE POLICY "Staff read contractor documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'contractor-documents');

CREATE POLICY "Staff write contractor documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'contractor-documents');

CREATE POLICY "Staff update contractor documents"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'contractor-documents') WITH CHECK (bucket_id = 'contractor-documents');

CREATE POLICY "Staff delete contractor documents"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'contractor-documents');

CREATE POLICY "Kiosk upload contractor documents"
  ON storage.objects FOR INSERT TO anon
  WITH CHECK (bucket_id = 'contractor-documents' AND (storage.foldername(name))[1] = 'kiosk-uploads');