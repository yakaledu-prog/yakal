-- ============================================================
-- The second function left behind by dropping courses.tutor_id.
--
-- 20260906000100_course_tutors replaced the single tutor on a course with the
-- course_tutors roster. messageable_contacts was fixed in 20260909000300; this
-- is the other one, and it failed the same silent way: a SQL function body is
-- resolved when it runs, so the migration applied cleanly and every later call
-- raised "column c.tutor_id does not exist".
--
-- teaches_student gates who may read a student's diagnostic results, and it is
-- called from the diagnostic_results policies. So the error surfaced as a 400
-- on the student's own diagnostics page, where their completed tests showed as
-- "0 / 5 completed" with the results silently unreadable.
--
-- Deliberately not "anyone on the roster". A course carries several tutors now,
-- and a colleague who has never met this student has no business reading how
-- they scored. The rule is the tutor who actually teaches them:
--
--   they have a session together, whatever became of it, or
--   the tutor is the one named on the invoice behind the enrolment
--
-- which is the same pair messageable_contacts settled on, for the same reason.
-- ============================================================

CREATE OR REPLACE FUNCTION public.teaches_student(p_student uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.sessions s
    WHERE s.student_id = p_student
      AND s.tutor_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.enrolments e
    JOIN public.invoices i ON i.id = e.invoice_id
    WHERE e.student_id = p_student
      AND i.tutor_id = auth.uid()
      AND e.status IN ('active', 'completed')
  );
$$;

GRANT EXECUTE ON FUNCTION public.teaches_student(uuid) TO authenticated;
