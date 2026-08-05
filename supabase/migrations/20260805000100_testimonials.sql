-- Testimonials on the marketing page, editable without a deploy.
--
-- They were three entries hardcoded in src/sections/Testimonials.tsx, so
-- changing a quote meant a developer, a commit and a deploy. That is fine for
-- something that never changes and wrong for marketing copy, which is exactly
-- the thing a non-developer wants to edit on a Friday.
--
-- Same shape as blog_posts: a table an admin edits and the public reads. The
-- difference is the policies, because blog_posts has
-- "Enable all access for anon USING (true)", which lets anyone who has the
-- anon key create and delete posts. Not repeated here.

CREATE TABLE IF NOT EXISTS public.testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  -- "Algebra Student", "Parent of two". Free text, because the useful label
  -- differs per person and an enum would be wrong within a week.
  role text NOT NULL DEFAULT '',
  quote text NOT NULL,
  -- Null is normal. The card falls back to a generated avatar rather than
  -- leaving a hole, so a testimonial can be added before a photo exists.
  avatar_url text,
  -- Unpublished is the draft state: written, not yet on the site.
  published boolean NOT NULL DEFAULT false,
  -- Lowest first. Ties break on created_at so the order never shuffles
  -- between visits, which is the bug that makes a carousel look broken.
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS testimonials_published_idx
  ON public.testimonials (published, sort_order, created_at);

ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;

-- Supabase grants anon and authenticated ALL on new tables in public through
-- ALTER DEFAULT PRIVILEGES. RLS would still stop a write, but there is no
-- reason for the grant to exist, and an accidentally permissive policy later
-- would then be the only thing standing between anon and this table.
REVOKE ALL ON public.testimonials FROM anon, authenticated;
GRANT SELECT ON public.testimonials TO anon, authenticated;

-- Anyone may read a published one. That is the point: the landing page is
-- read by people who have not signed up.
DROP POLICY IF EXISTS "Published testimonials are public" ON public.testimonials;
CREATE POLICY "Published testimonials are public" ON public.testimonials
  FOR SELECT USING (published);

-- Admins see drafts too, and are the only ones who may write.
DROP POLICY IF EXISTS "Admins read every testimonial" ON public.testimonials;
CREATE POLICY "Admins read every testimonial" ON public.testimonials
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Admins write testimonials" ON public.testimonials;
CREATE POLICY "Admins write testimonials" ON public.testimonials
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

GRANT INSERT, UPDATE, DELETE ON public.testimonials TO authenticated;

CREATE OR REPLACE FUNCTION public.touch_testimonials_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS testimonials_touch_updated_at ON public.testimonials;
CREATE TRIGGER testimonials_touch_updated_at
  BEFORE UPDATE ON public.testimonials
  FOR EACH ROW EXECUTE FUNCTION public.touch_testimonials_updated_at();

-- The three that were in the component, so the page looks identical the
-- moment it starts reading from here. Their images moved to public/ to get
-- stable URLs: bundled assets get a content hash at build time, which is not
-- something a database row can point at.
INSERT INTO public.testimonials (name, role, quote, avatar_url, published, sort_order)
SELECT * FROM (VALUES
  ('David Warner', 'Algebra Student',
   'Yakal''s tutoring completely changed my approach to learning. I was struggling with Algebra, but my tutor broke concepts into easy-to-understand steps.',
   '/testimonials/david.webp', true, 10),
  ('Sarah Taylor', 'Physics & Calculus Student',
   'I used to struggle with Physics and Calculus, but Yakal made these subjects understandable and even enjoyable. The personalized approach meant I was always working on my weaknesses.',
   '/testimonials/sarah.webp', true, 20),
  ('Ellyse Perry', 'SAT Prep Student',
   'I loved how flexible Yakal''s sessions were. Each lesson was tailored to my pace and learning style. I finally feel like I''m learning efficiently and achieving real results.',
   '/testimonials/ellyse.webp', true, 30)
) AS seed(name, role, quote, avatar_url, published, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.testimonials);
