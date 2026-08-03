-- Admins can read the work set on any course.
--
-- assignments had three policies and none of them mentioned an admin: a tutor
-- reaches their own, a student and their parent reach the ones set on a course
-- they are enrolled on. So the only person who can see across the whole
-- programme could see none of it, and an admin page would have rendered an
-- empty list rather than an error, which is the worse of the two.
--
-- Read only. Assignments are written in Google Classroom and pushed from
-- scripts/classroom-sync; an admin editing one here would put the two out of
-- step with nothing to reconcile them.
DROP POLICY IF EXISTS assignments_admin_read ON public.assignments;
CREATE POLICY assignments_admin_read
  ON public.assignments
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- Submissions, for the same reason: the count of who has turned a piece of
-- work in is most of what the list is worth looking at.
DROP POLICY IF EXISTS submissions_admin_read ON public.submissions;
CREATE POLICY submissions_admin_read
  ON public.submissions
  FOR SELECT TO authenticated
  USING (public.is_admin());
