-- Booking an advising hour, after the tier has been paid for.
--
-- Slots are chosen from the plan page rather than during checkout. That keeps
-- payment and the calendar apart: a card that fails cannot leave hours held,
-- and by the time anyone is picking, the counsellor is already assigned so
-- there is exactly one calendar to draw.
--
-- A function rather than an insert policy, because the rule that matters is
-- the monthly allowance and a limit enforced in the browser is not a limit.
-- Parents cannot insert sessions at all; this is the one way in, and it checks
-- everything before it writes.

CREATE OR REPLACE FUNCTION public.book_advising_session(
  p_student uuid,
  p_date date,
  p_start time,
  p_duration int DEFAULT 60
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan          record;
  v_limit         int;
  v_used          int;
  v_session_id    uuid;
BEGIN
  -- Who is asking. The student themselves, or a parent actively linked to
  -- them. Anyone else gets the same answer as a stranger.
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

  -- There has to be something to book against, and somebody to book with.
  SELECT ap.id, ap.counselor_id, t.sessions_per_month
  INTO v_plan
  FROM public.admissions_plans ap
  JOIN public.admissions_tiers t ON t.id = ap.tier_id
  WHERE ap.student_id = p_student
    AND ap.status IN ('active', 'past_due')
  LIMIT 1;

  IF v_plan.id IS NULL THEN
    RAISE EXCEPTION 'No active counselling plan for this student' USING ERRCODE = 'P0002';
  END IF;

  IF v_plan.counselor_id IS NULL THEN
    RAISE EXCEPTION 'No counsellor has been assigned yet' USING ERRCODE = 'P0002';
  END IF;

  -- Nothing in the past. The week grid runs Sunday to Saturday, so the current
  -- week still shows days that have gone.
  IF (p_date + p_start) < now() THEN
    RAISE EXCEPTION 'That time has already passed' USING ERRCODE = '22007';
  END IF;

  -- The monthly allowance. Null means the tier sets no ceiling.
  v_limit := v_plan.sessions_per_month;
  IF v_limit IS NOT NULL THEN
    SELECT count(*) INTO v_used
    FROM public.sessions s
    WHERE s.student_id = p_student
      AND s.kind = 'advising'
      AND s.status IN ('upcoming', 'completed')
      AND s.date >= date_trunc('month', p_date)::date
      AND s.date <  (date_trunc('month', p_date) + interval '1 month')::date;

    IF v_used >= v_limit THEN
      RAISE EXCEPTION 'That month''s advising sessions are already used up (% of %)',
        v_used, v_limit USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- The counsellor has to actually be free. Their own sessions, whoever they
  -- are with, not just this student's.
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
    p_student, v_plan.counselor_id, NULL, 'advising', 'College advising',
    p_date, p_start, coalesce(p_duration, 60), 'online', 'upcoming'
  )
  RETURNING id INTO v_session_id;

  RETURN v_session_id;
END;
$$;

REVOKE ALL ON FUNCTION public.book_advising_session(uuid, date, time, int) FROM anon;
GRANT EXECUTE ON FUNCTION public.book_advising_session(uuid, date, time, int) TO authenticated;

-- Releasing one again.
--
-- Without this, Change slots is a button that stops working the moment the
-- allowance is spent, which is exactly when somebody wants to move an hour.
-- Cancelling frees the slot for the counsellor and the month's count for the
-- family, so a booking can be replaced rather than only added.
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

  IF v_session.kind <> 'advising' THEN
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

REVOKE ALL ON FUNCTION public.cancel_advising_session(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.cancel_advising_session(uuid) TO authenticated;
