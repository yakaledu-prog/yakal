-- Phase 4: the blog, the contact inbox and notifications stop being writable,
-- or readable, by people they are not for.
--
-- All three were built with policies of USING (true) and Supabase's default
-- grant of everything to anon and authenticated, so:
--   * anybody, signed in or not, could create, rewrite or delete blog posts,
--     and drafts were readable by the public;
--   * any signed-in user could read every contact form submission, names,
--     emails and phone numbers included;
--   * any signed-in user could write a notification to any other user, with
--     any title, any text and any link, and the email half would then send it
--     from Yakal's own address.

-- ============================================================
-- Blog
-- ============================================================

DROP POLICY IF EXISTS "Enable all access for anon" ON public.blog_posts;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.blog_posts;
DROP POLICY IF EXISTS "Enable read access for all" ON public.blog_posts;

REVOKE ALL ON public.blog_posts FROM anon, authenticated;
GRANT SELECT ON public.blog_posts TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.blog_posts TO authenticated;

-- Drafts are for admins. The public blog pages already filtered on status in
-- the browser, which hid a draft from the list and not from anybody asking.
CREATE POLICY blog_posts_read ON public.blog_posts
  FOR SELECT TO anon, authenticated
  USING (status = 'published' OR public.is_admin());

CREATE POLICY blog_posts_admin_insert ON public.blog_posts
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY blog_posts_admin_update ON public.blog_posts
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY blog_posts_admin_delete ON public.blog_posts
  FOR DELETE TO authenticated USING (public.is_admin());

-- ============================================================
-- Contact inbox
-- ============================================================
--
-- The form posts to api/contact.ts, which now writes with the service role, so
-- nobody needs to insert from a browser. Admins read the inbox and mark
-- messages handled; the update policy is new, and without it "mark handled"
-- changed nothing and reported success.

DROP POLICY IF EXISTS "Allow authenticated reads" ON public.contact_messages;
DROP POLICY IF EXISTS "Allow public inserts" ON public.contact_messages;

REVOKE ALL ON public.contact_messages FROM anon, authenticated;
GRANT SELECT ON public.contact_messages TO authenticated;
GRANT UPDATE (status) ON public.contact_messages TO authenticated;

CREATE POLICY contact_messages_admin_read ON public.contact_messages
  FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY contact_messages_admin_update ON public.contact_messages
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================================
-- Notifications
-- ============================================================

-- Who wrote it. Stamped by the trigger below, never taken from the row: a
-- column default could simply be overwritten by the client.
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS notifications_email_lookup_idx
  ON public.notifications (user_id, template, created_by, created_at DESC);

-- SECURITY INVOKER on purpose. current_user is only 'authenticated' when a
-- browser is inserting; the server (service_role) and the security definer
-- functions that notify (scan_message, the invite functions) run as other
-- roles, and their rows stay created_by null, which the email half never
-- needs because the server sends its own mail.
CREATE OR REPLACE FUNCTION public.stamp_notification_creator()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notifications_stamp_creator ON public.notifications;
CREATE TRIGGER notifications_stamp_creator
  BEFORE INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.stamp_notification_creator();

-- May the signed-in person send this template to this person?
--
-- One case per template the browser sends, and nothing else: eleven call
-- sites, each a relationship that already exists in the database. Anything
-- the server sends goes through the service role and does not come here.
CREATE OR REPLACE FUNCTION public.may_notify(p_target uuid, p_template text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  my_role text;
  their_role text;
BEGIN
  IF me IS NULL OR p_target IS NULL OR p_target = me THEN
    RETURN false;
  END IF;

  SELECT role INTO my_role FROM profiles WHERE id = me;
  SELECT role INTO their_role FROM profiles WHERE id = p_target;

  CASE p_template
    -- A student asking a linked parent to unlock or buy something.
    WHEN 'unlockRequest', 'courseRequest' THEN
      RETURN EXISTS (SELECT 1 FROM parent_student_links
                     WHERE parent_id = p_target AND student_id = me AND status = 'active');

    -- A student answering a parent's link request, either way.
    WHEN 'parentLinkDecided' THEN
      RETURN EXISTS (SELECT 1 FROM parent_student_links
                     WHERE parent_id = p_target AND student_id = me
                       AND status IN ('active', 'rejected'));

    -- A parent declining their child's request.
    WHEN 'unlockRequestDeclined' THEN
      RETURN EXISTS (SELECT 1 FROM parent_student_links
                     WHERE parent_id = me AND student_id = p_target AND status = 'active');

    -- A parent asking to link: only to the student they just asked.
    WHEN 'parentLink' THEN
      RETURN EXISTS (SELECT 1 FROM parent_student_links
                     WHERE parent_id = me AND student_id = p_target AND status = 'pending');

    -- A tutor or counsellor applying to teach tells the admins.
    WHEN 'courseApplication' THEN
      RETURN my_role IN ('tutor', 'counselor') AND their_role = 'admin';

    WHEN 'courseApplicationDecided', 'accountApproved' THEN
      RETURN my_role = 'admin';

    -- An essay reviewed by the student's own counsellor, or an admin.
    WHEN 'essayReview' THEN
      RETURN my_role = 'admin' OR public.is_my_advisee(p_target);

    -- A session moved: the tutor tells the student, and the student, a linked
    -- parent or an admin tells the tutor. The session must be theirs.
    WHEN 'sessionMoved' THEN
      RETURN my_role = 'admin'
        OR EXISTS (SELECT 1 FROM sessions s WHERE s.tutor_id = me AND s.student_id = p_target)
        OR EXISTS (
          SELECT 1 FROM sessions s
          WHERE s.tutor_id = p_target
            AND (s.student_id = me
                 OR EXISTS (SELECT 1 FROM parent_student_links l
                            WHERE l.parent_id = me AND l.student_id = s.student_id
                              AND l.status = 'active'))
        );

    ELSE
      RETURN false;
  END CASE;
END;
$$;

REVOKE ALL ON FUNCTION public.may_notify(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.may_notify(uuid, text) TO authenticated;

DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON public.notifications;
CREATE POLICY notifications_insert ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (template IS NOT NULL AND public.may_notify(user_id, template));

-- Marking read and archiving, and nothing else: recipients could rewrite the
-- title, link and template of their own rows, which the app then rendered as
-- if Yakal had sent it.
DROP POLICY IF EXISTS "Users can mark their notifications read" ON public.notifications;
CREATE POLICY notifications_update_own ON public.notifications
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

REVOKE ALL ON public.notifications FROM anon, authenticated;
GRANT SELECT, INSERT ON public.notifications TO authenticated;
GRANT UPDATE (is_read, archived) ON public.notifications TO authenticated;

-- A link is a path inside the app and nothing else. The service worker opens
-- it on a tap, and "//evil.example" or "/\evil.example" are both read by a
-- browser as another site. Validated, not NOT VALID: a NOT VALID check is
-- still enforced on update, and would stop an old row being marked read.
UPDATE public.notifications
   SET link = NULL
 WHERE link IS NOT NULL AND link !~ '^/([A-Za-z0-9_-][^[:space:]\\]*)?$';

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_link_relative;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_link_relative
  CHECK (link IS NULL OR link ~ '^/([A-Za-z0-9_-][^[:space:]\\]*)?$');
