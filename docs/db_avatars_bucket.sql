-- ============================================================
-- YAKAL, Storage bucket for profile photo uploads
-- Run ONCE in Supabase SQL Editor (optional, only needed if you
-- want users to upload their own photos. DiceBear avatars work
-- without this.)
-- ============================================================

-- Public bucket so <img src> works without signed URLs.
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Anyone can view avatars (public bucket).
CREATE POLICY "Avatar images are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- A user may upload/replace/delete ONLY inside their own folder:
-- path convention is  <user_id>/<filename>  (see OnboardingPage upload).
CREATE POLICY "Users can upload their own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can update their own avatar"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete their own avatar"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

SELECT 'avatars bucket ready.' AS status;
