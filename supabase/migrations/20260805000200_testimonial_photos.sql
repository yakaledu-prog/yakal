-- Somewhere for an admin to put a testimonial photo.
--
-- Not the avatars bucket. Its write policies are scoped to
-- (storage.foldername(name))[1] = auth.uid(), which is right for "your own
-- picture" and wrong here: an admin uploads a photo of somebody else, and
-- making that fit would mean filing it under the admin's own id, where the
-- next person to look would never find it.

INSERT INTO storage.buckets (id, name, public)
VALUES ('testimonials', 'testimonials', true)
ON CONFLICT (id) DO NOTHING;

-- Public read, because these appear on the marketing page, which is read by
-- people who have not signed up.
DROP POLICY IF EXISTS "Testimonial photos are publicly readable" ON storage.objects;
CREATE POLICY "Testimonial photos are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'testimonials');

-- Only admins write. Anyone signed in would mean any student could put an
-- image on the landing page.
DROP POLICY IF EXISTS "Admins upload testimonial photos" ON storage.objects;
CREATE POLICY "Admins upload testimonial photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'testimonials' AND public.is_admin());

DROP POLICY IF EXISTS "Admins replace testimonial photos" ON storage.objects;
CREATE POLICY "Admins replace testimonial photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'testimonials' AND public.is_admin())
  WITH CHECK (bucket_id = 'testimonials' AND public.is_admin());

DROP POLICY IF EXISTS "Admins delete testimonial photos" ON storage.objects;
CREATE POLICY "Admins delete testimonial photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'testimonials' AND public.is_admin());
