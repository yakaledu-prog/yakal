-- blog_posts was writable by the entire internet.
--
-- The baseline schema carried three policies, two of them "Enable all access"
-- with USING (true): one for anon and one for authenticated. Postgres defaults
-- an ALL policy's WITH CHECK to its USING expression, so that grants insert,
-- update and delete as well as select. Paired with GRANT ALL ON blog_posts TO
-- anon, and an anon key that ships inside the browser bundle by design, that
-- meant anyone who opened devtools could publish, rewrite or delete any post.
--
-- Verified against the local stack before writing this: an unauthenticated
-- POST to /rest/v1/blog_posts returned 201 and the row it had created.
--
-- What it should have been: the public reads published posts, admins do
-- everything, and nobody else touches it. Draft posts stop being world
-- readable as a side effect, which they always should have been.

-- The three permissive policies, by the names the baseline gave them.
DROP POLICY IF EXISTS "Enable all access for anon" ON public.blog_posts;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.blog_posts;
DROP POLICY IF EXISTS "Enable read access for all" ON public.blog_posts;

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

-- The grant is what the policies sit on top of. ALL to anon is never right:
-- a permissive policy added later would be the only thing between the table
-- and the public internet.
REVOKE ALL ON public.blog_posts FROM anon, authenticated;
GRANT SELECT ON public.blog_posts TO anon, authenticated;
-- Admins write from the browser with their own session, so the authenticated
-- role needs the privilege and the policy below decides who may use it.
GRANT INSERT, UPDATE, DELETE ON public.blog_posts TO authenticated;

-- Anyone, signed in or not, may read a published post. That is the landing
-- page, the blog index and the post page.
CREATE POLICY "Published posts are public"
  ON public.blog_posts FOR SELECT
  USING (status = 'published');

-- Admins see drafts too, and are the only ones who may write.
CREATE POLICY "Admins read every post"
  ON public.blog_posts FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admins write posts"
  ON public.blog_posts FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
