-- Counsellors, once there is more than one of them.
--
-- Two things were true while there was exactly one. Neither survives a second
-- hire, and the sign-up gate is about to open:
--
--   1. Nothing assigned a counsellor. A family bought a tier, got a plan and an
--      unlocked service, and no person. counselor_id on the application was
--      read by the counsellor's own dashboard and written by nothing, so the
--      only students any counsellor could see were the seeded ones.
--
--   2. Every policy on this side of the product said is_counselor(). That reads
--      as "a counsellor may see this", but with two of them it means each can
--      read and edit the other's students: their personal statements, their
--      college lists, their notes. Fine as shorthand for a team of one, a leak
--      the day it stops being one.

-- ---------------------------------------------------------------------------
-- 1. The assignment itself
-- ---------------------------------------------------------------------------

ALTER TABLE public.admissions_plans
  ADD COLUMN IF NOT EXISTS counselor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS admissions_plans_counselor_idx
  ON public.admissions_plans(counselor_id) WHERE counselor_id IS NOT NULL;

COMMENT ON COLUMN public.admissions_plans.counselor_id IS
  'Who is working with this family. Assigned when the plan is created; an admin can move it.';

-- ---------------------------------------------------------------------------
-- 2. Choosing one
-- ---------------------------------------------------------------------------

/**
 * The active counsellor with the fewest live plans.
 *
 * Least loaded rather than round robin: round robin counts sign-ups, not work,
 * so a counsellor whose families all finish in November keeps being handed more
 * while somebody who joined later sits idle. Ties break on who joined first,
 * which keeps the result stable rather than arbitrary.
 *
 * Returns null when nobody is available. That is not an error: the plan is
 * still granted, the family still gets the product, and the row shows up
 * unassigned for an admin to place. Refusing the purchase because nobody has
 * been hired yet would be the wrong failure.
 */
CREATE OR REPLACE FUNCTION public.next_counselor()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id
  FROM public.profiles p
  LEFT JOIN public.admissions_plans ap
    ON ap.counselor_id = p.id
   AND ap.status IN ('active', 'past_due')
  WHERE p.role = 'counselor'
    AND p.status = 'active'
  GROUP BY p.id, p.created_at
  ORDER BY count(ap.id), p.created_at
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.next_counselor() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.next_counselor() TO service_role;

-- Existing plans predate the column. Give them the same treatment a new
-- purchase gets rather than leaving live families unassigned.
UPDATE public.admissions_plans
SET counselor_id = public.next_counselor()
WHERE counselor_id IS NULL
  AND status IN ('active', 'past_due');

-- ---------------------------------------------------------------------------
-- 3. Who a counsellor can see
-- ---------------------------------------------------------------------------

/**
 * True when this counsellor is the one working with this student.
 *
 * The plan is the record of the engagement, so it is what decides. The
 * application row is a workspace and can exist before anyone has been assigned.
 */
CREATE OR REPLACE FUNCTION public.is_my_advisee(p_student uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admissions_plans ap
    WHERE ap.student_id = p_student
      AND ap.counselor_id = auth.uid()
      AND ap.status IN ('active', 'past_due')
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_my_advisee(uuid) TO authenticated;

-- The applications. Replaces the two overlapping is_counselor() policies that
-- between them handed every counsellor everything.
DROP POLICY IF EXISTS "Counselors can view and update all applications" ON public.college_guide_applications;
DROP POLICY IF EXISTS college_guide_applications_counselor_all ON public.college_guide_applications;
DROP POLICY IF EXISTS college_guide_applications_counselor_own ON public.college_guide_applications;

CREATE POLICY college_guide_applications_counselor_own
  ON public.college_guide_applications
  FOR ALL TO authenticated
  USING (public.is_counselor() AND public.is_my_advisee(student_id))
  WITH CHECK (public.is_counselor() AND public.is_my_advisee(student_id));

-- The plans. Same shape: a counsellor sees the engagements that are theirs.
DROP POLICY IF EXISTS admissions_plans_read ON public.admissions_plans;

CREATE POLICY admissions_plans_read
  ON public.admissions_plans
  FOR SELECT TO authenticated
  USING (
    auth.uid() = student_id
    OR auth.uid() = purchased_by
    OR auth.uid() = counselor_id
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.parent_student_links psl
      WHERE psl.parent_id = auth.uid()
        AND psl.status = 'active'
        AND psl.student_id = admissions_plans.student_id
    )
  );
