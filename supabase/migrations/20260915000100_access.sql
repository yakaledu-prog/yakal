-- Signup can no longer choose to be an admin, and a parent can no longer attach
-- themselves to a student.
--
-- handle_new_user copied raw_user_meta_data->>'role' into profiles.role and held
-- only tutors and counselors for approval. signUp is public and the anon key
-- ships in the bundle, so one request with role "admin" produced an active admin.
-- 20260822000100 guards role on UPDATE; signup is an INSERT, so that guard never
-- ran.
--
-- Nothing legitimate makes an admin through signup. scripts/seed.ts and
-- scripts/update_admin.ts write profiles.role with the service role, which the
-- privileged-columns trigger allows.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text := lower(coalesce(NEW.raw_user_meta_data->>'role', 'student'));
  v_status text;
BEGIN
  -- The four roles a person can ask for. Anything else, admin included, becomes
  -- a student rather than an error, so a malformed signup still gets a profile
  -- instead of an auth user with nothing attached.
  IF v_role NOT IN ('student', 'parent', 'tutor', 'counselor') THEN
    v_role := 'student';
  END IF;

  -- Tutors and counselors require admin approval
  IF v_role IN ('tutor', 'counselor') THEN
    v_status := 'pending';
  ELSE
    v_status := 'active';
  END IF;

  INSERT INTO public.profiles (id, email, full_name, role, status, avatar_url, is_onboarded)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    v_role,
    v_status,
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NULL),
    false
  );
  RETURN NEW;
END;
$$;

-- The baseline granted this to anon and authenticated. Nobody calls a trigger
-- function directly, and its privileges are not checked when the trigger fires.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------
-- Parent links
--
-- "Parents can create link requests" checked that the caller was the parent but
-- not the status, and the status column accepts 'active'. So a parent could
-- insert an active link to any student and become their parent everywhere that
-- phrase is used: the child's sessions and messages, rescheduling and
-- cancelling, and every access check built on it. The student side had USING
-- and no WITH CHECK, so a student could move a link to a different parent_id.
--
-- A link becomes active only when the student accepts it (respondToChildLink,
-- which writes status and nothing else) or through the invite functions, which
-- are SECURITY DEFINER and unaffected by any of this.
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "Parents can create link requests" ON public.parent_student_links;
CREATE POLICY "Parents can create link requests" ON public.parent_student_links
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = parent_id AND status = 'pending');

DROP POLICY IF EXISTS "Students can approve/reject link requests" ON public.parent_student_links;
CREATE POLICY "Students can approve/reject link requests" ON public.parent_student_links
  FOR UPDATE TO authenticated
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

-- Status is the only thing a student decides. The updated_at trigger still
-- runs: column privileges apply to what a statement sets, not to what a trigger
-- sets on its behalf.
REVOKE UPDATE ON public.parent_student_links FROM anon, authenticated;
GRANT UPDATE (status) ON public.parent_student_links TO authenticated;
REVOKE INSERT, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.parent_student_links FROM anon;
