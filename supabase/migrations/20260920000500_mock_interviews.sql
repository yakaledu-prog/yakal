-- Phase 7: what the plans sell, delivered.
--
-- 1. Mock interviews can be booked. Premier and Elite list them, and the tier
--    has carried mock_interviews_limit for months, but there was no way to book
--    one: the meter read "0 of 1" for ever.
-- 2. A month whose only delivery was a mock interview counts as delivered, so
--    the counsellor who ran it is paid for that month.
-- 3. An essay review is written, and read, only by the student's own
--    counsellor or an admin. Any counsellor could log a review round against
--    any student's essay, using up that family's rounds.

-- ============================================================
-- 1. Booking and cancelling a mock interview
-- ============================================================
--
-- book_advising_session, with two differences. The allowance is per plan, not
-- per month: an interview is prepared for once or twice across an application
-- season, and a monthly refill would sell six where the tier says one. And a
-- limit of 0 means the tier has none, which is a refusal rather than a meter.
-- Null is unlimited, as for every other quota.

CREATE OR REPLACE FUNCTION public.book_mock_interview(
  p_student uuid,
  p_date date,
  p_start time without time zone,
  p_duration integer DEFAULT 60
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan       record;
  v_used       int;
  v_session_id uuid;
BEGIN
  IF auth.uid() <> p_student
     AND NOT EXISTS (
       SELECT 1 FROM public.parent_student_links psl
       WHERE psl.parent_id = auth.uid()
         AND psl.student_id = p_student
         AND psl.status = 'active'
     )
  THEN
    RAISE EXCEPTION 'Not your student' USING ERRCODE = '42501';
  END IF;

  -- Locked, so two tabs booking the last interview at once cannot both count
  -- the same zero.
  SELECT ap.id, ap.counselor_id, ap.created_at, t.mock_interviews_limit
  INTO v_plan
  FROM public.admissions_plans ap
  JOIN public.admissions_tiers t ON t.id = ap.tier_id
  WHERE ap.student_id = p_student
    AND ap.status IN ('active', 'past_due')
  LIMIT 1
  FOR UPDATE OF ap;

  IF v_plan.id IS NULL THEN
    RAISE EXCEPTION 'No active counselling plan for this student' USING ERRCODE = 'P0002';
  END IF;
  IF v_plan.counselor_id IS NULL THEN
    RAISE EXCEPTION 'No counsellor has been assigned yet' USING ERRCODE = 'P0002';
  END IF;
  IF v_plan.mock_interviews_limit = 0 THEN
    RAISE EXCEPTION 'This plan does not include mock interviews' USING ERRCODE = 'P0001';
  END IF;

  IF (p_date + p_start) < now() THEN
    RAISE EXCEPTION 'That time has already passed' USING ERRCODE = '22007';
  END IF;

  -- Over the plan's life. Booked counts as much as held, for the reason the
  -- advising meter gives: a slot held is one nobody else can have.
  IF v_plan.mock_interviews_limit IS NOT NULL THEN
    SELECT count(*) INTO v_used
    FROM public.sessions s
    WHERE s.student_id = p_student
      AND s.kind = 'mock_interview'
      AND s.status IN ('upcoming', 'completed')
      AND s.created_at >= v_plan.created_at;

    IF v_used >= v_plan.mock_interviews_limit THEN
      RAISE EXCEPTION 'This plan''s mock interviews are already used (% of %)',
        v_used, v_plan.mock_interviews_limit USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.sessions s
    WHERE s.tutor_id = v_plan.counselor_id
      AND s.date = p_date
      AND s.start_time = p_start
      AND s.status <> 'cancelled'
  ) THEN
    RAISE EXCEPTION 'That hour has just been taken' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.sessions (
    student_id, tutor_id, course_id, kind, subject,
    date, start_time, duration_minutes, mode, status
  )
  VALUES (
    p_student, v_plan.counselor_id, NULL, 'mock_interview', 'Mock interview',
    p_date, p_start, coalesce(p_duration, 60), 'online', 'upcoming'
  )
  RETURNING id INTO v_session_id;

  RETURN v_session_id;
END;
$$;

REVOKE ALL ON FUNCTION public.book_mock_interview(uuid, date, time without time zone, integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.book_mock_interview(uuid, date, time without time zone, integer) TO authenticated;

-- Cancelling is the same rule for both kinds: the family's own session, and
-- only before it starts. One function, so the two cannot drift apart.
CREATE OR REPLACE FUNCTION public.cancel_advising_session(p_session uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session record;
BEGIN
  SELECT s.id, s.student_id, s.date, s.start_time, s.kind, s.status
  INTO v_session
  FROM public.sessions s
  WHERE s.id = p_session;

  IF v_session.id IS NULL THEN
    RAISE EXCEPTION 'No such session' USING ERRCODE = 'P0002';
  END IF;

  IF v_session.kind NOT IN ('advising', 'mock_interview') THEN
    RAISE EXCEPTION 'That is not an advising session' USING ERRCODE = '42501';
  END IF;

  IF auth.uid() <> v_session.student_id
     AND NOT EXISTS (
       SELECT 1 FROM public.parent_student_links psl
       WHERE psl.parent_id = auth.uid()
         AND psl.student_id = v_session.student_id
         AND psl.status = 'active'
     )
  THEN
    RAISE EXCEPTION 'Not your session' USING ERRCODE = '42501';
  END IF;

  -- An hour that has already happened is a record, not a plan. Letting it be
  -- cancelled afterwards would hand back an allowance that was really spent.
  IF (v_session.date + v_session.start_time) < now() THEN
    RAISE EXCEPTION 'That session has already started' USING ERRCODE = '22007';
  END IF;

  UPDATE public.sessions SET status = 'cancelled' WHERE id = p_session;
END;
$$;

-- ============================================================
-- 2. A mock interview is delivery
-- ============================================================

CREATE OR REPLACE FUNCTION public.counselling_period_delivered(
  p_plan uuid,
  p_from timestamp with time zone,
  p_to timestamp with time zone
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.sessions s
      JOIN public.admissions_plans p ON p.id = p_plan
     WHERE s.kind IN ('advising', 'mock_interview')
       AND s.tutor_id = p.counselor_id
       AND s.student_id = p.student_id
       AND s.status = 'completed'
       AND public.session_starts_at(s.date, s.start_time) >= p_from
       AND public.session_starts_at(s.date, s.start_time) < p_to
  )
  OR EXISTS (
    SELECT 1
      FROM public.essay_reviews r
      JOIN public.essays e ON e.id = r.essay_id
      JOIN public.admissions_plans p ON p.id = p_plan
     WHERE r.counselor_id = p.counselor_id
       AND e.student_id = p.student_id
       AND r.action IN ('returned', 'approved')
       AND r.created_at >= p_from
       AND r.created_at < p_to
  );
$$;

-- ============================================================
-- 3. Essay reviews belong to the student's own counsellor
-- ============================================================

DROP POLICY IF EXISTS essay_reviews_counselor_write ON public.essay_reviews;
CREATE POLICY essay_reviews_counselor_write ON public.essay_reviews
  FOR INSERT TO authenticated
  WITH CHECK (
    counselor_id = auth.uid()
    AND (
      public.is_admin()
      OR EXISTS (
        SELECT 1 FROM public.essays e
        WHERE e.id = essay_reviews.essay_id
          AND public.is_my_advisee(e.student_id)
      )
    )
  );

-- Read by the same people, plus the family. "Any counsellor" read every
-- student's review history, which is the student's work and their
-- counsellor's comments on it.
DROP POLICY IF EXISTS essay_reviews_read ON public.essay_reviews;
CREATE POLICY essay_reviews_read ON public.essay_reviews
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.essays e
      WHERE e.id = essay_reviews.essay_id
        AND (
          e.student_id = auth.uid()
          OR public.is_my_advisee(e.student_id)
          OR EXISTS (
            SELECT 1 FROM public.parent_student_links psl
            WHERE psl.parent_id = auth.uid()
              AND psl.status = 'active'
              AND psl.student_id = e.student_id
          )
        )
    )
  );
