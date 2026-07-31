-- ============================================================
-- Storage for tutor and counselor CVs.
--
-- The onboarding wizard already asked applicants to upload one and wrote the
-- result to profiles.resume_url, but neither the column nor the bucket existed:
-- the only bucket was 'avatars'. The upload failed every time, which is why no
-- admin has ever had a CV to review.
--
-- Unlike avatars this bucket is private. A CV carries a home address and a
-- phone number, and a public bucket hands that to anyone who guesses the URL.
-- Readers get a short-lived signed URL instead.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS resume_url text;

COMMENT ON COLUMN public.profiles.resume_url IS
  'Storage path of the applicant CV inside the private resumes bucket. Read it with createSignedUrl, not getPublicUrl.';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'resumes',
  'resumes',
  false,
  10485760,  -- 10MB
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Path convention is <user_id>/<filename>, the same as avatars.

DROP POLICY IF EXISTS "Applicants can upload their own CV" ON storage.objects;
CREATE POLICY "Applicants can upload their own CV"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'resumes'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Applicants can replace their own CV" ON storage.objects;
CREATE POLICY "Applicants can replace their own CV"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'resumes'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Applicants can delete their own CV" ON storage.objects;
CREATE POLICY "Applicants can delete their own CV"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'resumes'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- An applicant can see their own CV back; an admin can see any, because
-- reviewing them is the whole point of the approval queue.
DROP POLICY IF EXISTS "Own CV and admins" ON storage.objects;
CREATE POLICY "Own CV and admins"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'resumes'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_admin()
    )
  );
