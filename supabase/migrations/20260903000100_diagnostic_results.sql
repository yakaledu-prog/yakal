-- Where a sat diagnostic actually goes.
--
-- Until now src/services/diagnosticService.ts wrote results to localStorage, so
-- a score lived in one browser: it did not follow the student to another
-- device, and a tutor, parent, or admin saw nothing. The student screen even
-- claimed "Your tutor has been notified", which was never true. This table is
-- the missing half of the feature, tracked in
-- docs/PRODUCTION_UNMOCK_CHECKLIST.md.
--
-- One row per attempt, not per test. Retaking used to overwrite the old score
-- in localStorage; keeping every attempt instead costs nothing now and is what
-- a "score over time" chart will need later, so reads take the latest per test
-- rather than the table enforcing one.
--
-- The client computes the score from the answer key it already holds (the key
-- ships in the diagnostics payload, by design), so a determined student could
-- post a perfect score. That was equally true of the localStorage version: a
-- self-diagnostic is not a graded exam, and the threat is not worth a
-- server-side re-grade.

CREATE TABLE IF NOT EXISTS public.diagnostic_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- The stable slug of the diagnostic, matching diagnostics.slug. Deliberately
  -- not a foreign key: the tests built into src/data/diagnostics.ts have slugs
  -- with no row in the diagnostics table, and a past result should survive a
  -- test being rewritten or deleted. This is the same reasoning the diagnostics
  -- table gives for keying results by slug rather than by its uuid.
  diagnostic_slug text NOT NULL,

  score integer NOT NULL,
  total integer NOT NULL,

  -- Per question, so the student can review what they got wrong and a tutor can
  -- see where, rather than only a bare X out of Y:
  --   [{ "question_id": text, "chosen": int, "correct": int }]
  answers jsonb NOT NULL DEFAULT '[]'::jsonb,

  completed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT diagnostic_results_total_positive CHECK (total > 0),
  CONSTRAINT diagnostic_results_score_bounds CHECK (score >= 0 AND score <= total),
  CONSTRAINT diagnostic_results_answers_is_array CHECK (jsonb_typeof(answers) = 'array')
);

-- The one query everything runs: this student's attempts at each test, newest
-- first, so "latest result per slug" is an index scan.
CREATE INDEX IF NOT EXISTS diagnostic_results_student_idx
  ON public.diagnostic_results (student_id, diagnostic_slug, completed_at DESC);

ALTER TABLE public.diagnostic_results ENABLE ROW LEVEL SECURITY;

-- New tables come with anon and authenticated already granted everything, so
-- lock it down and hand back only what the policies below rely on. No UPDATE:
-- a result is a record of one sitting and is never edited; a retake is a new
-- row. DELETE is for the admin cleanup policy only.
REVOKE ALL ON public.diagnostic_results FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.diagnostic_results TO authenticated;

-- ---------- who is allowed to read a student's results ----------

-- A tutor teaches a student when that student is enrolled on a course the tutor
-- owns. SECURITY DEFINER so the check does not depend on the tutor's own RLS
-- view of enrolments and courses, matching how is_my_advisee is written.
CREATE OR REPLACE FUNCTION public.teaches_student(p_student uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.enrolments e
    JOIN public.courses c ON c.id = e.course_id
    WHERE e.student_id = p_student
      AND c.tutor_id = auth.uid()
      AND e.status IN ('active', 'completed')
  );
$$;

GRANT EXECUTE ON FUNCTION public.teaches_student(uuid) TO authenticated;

-- An active parent link. Pending and rejected links grant nothing: the student
-- has not accepted the connection, so their marks are not the parent's to see.
CREATE OR REPLACE FUNCTION public.is_linked_parent(p_student uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.parent_student_links l
    WHERE l.student_id = p_student
      AND l.parent_id = auth.uid()
      AND l.status = 'active'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_linked_parent(uuid) TO authenticated;

-- ---------- policies ----------

-- The student owns their results: they read and record their own, and nobody
-- else's.
DROP POLICY IF EXISTS diagnostic_results_student_select ON public.diagnostic_results;
CREATE POLICY diagnostic_results_student_select ON public.diagnostic_results
  FOR SELECT TO authenticated
  USING (student_id = auth.uid());

DROP POLICY IF EXISTS diagnostic_results_student_insert ON public.diagnostic_results;
CREATE POLICY diagnostic_results_student_insert ON public.diagnostic_results
  FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid());

-- A tutor reads the results of students they teach.
DROP POLICY IF EXISTS diagnostic_results_tutor_select ON public.diagnostic_results;
CREATE POLICY diagnostic_results_tutor_select ON public.diagnostic_results
  FOR SELECT TO authenticated
  USING (public.teaches_student(student_id));

-- A parent reads the results of a child they are actively linked to.
DROP POLICY IF EXISTS diagnostic_results_parent_select ON public.diagnostic_results;
CREATE POLICY diagnostic_results_parent_select ON public.diagnostic_results
  FOR SELECT TO authenticated
  USING (public.is_linked_parent(student_id));

-- A counsellor reads the results of their current advisees. Same gate the
-- admissions tables use, so a counsellor sees exactly the students who are
-- theirs and no others.
DROP POLICY IF EXISTS diagnostic_results_counselor_select ON public.diagnostic_results;
CREATE POLICY diagnostic_results_counselor_select ON public.diagnostic_results
  FOR SELECT TO authenticated
  USING (public.is_counselor() AND public.is_my_advisee(student_id));

-- An admin sees and can remove any result.
DROP POLICY IF EXISTS diagnostic_results_admin_all ON public.diagnostic_results;
CREATE POLICY diagnostic_results_admin_all ON public.diagnostic_results
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
