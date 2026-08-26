-- ============================================================
-- Attendance was never recorded, because it was looking at the wrong clock.
--
-- record_attendance credits time only around the booked slot, so a pair cannot
-- open the room on a quiet Sunday and bank an hour against a session next
-- month. That guard is right. The moment it compared against was not:
--
--   (date + start_time) AT TIME ZONE 'UTC'
--
-- Everything else on the platform reads these naive columns as US Eastern,
-- which is what ZOOM_TIMEZONE defaults to and what every meeting is created in.
-- session_starts_at() exists precisely so the two cannot drift, and this
-- function predates it.
--
-- The effect: a 10:00 lesson was treated as 10:00 UTC, which is 06:00 Eastern.
-- The credit window ran 05:30 to 12:00 Eastern while the lesson ran 10:00 to
-- 11:00 Eastern. Close enough to look plausible, far enough that a lesson in
-- the afternoon banked nothing at all. session_attendance is empty, and this is
-- why.
--
-- Same bug, same shape, as the one 20260819000400 fixed in reschedule_session.
-- This is the function that migration missed.
-- ============================================================

CREATE OR REPLACE FUNCTION public.record_attendance(p_session_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.sessions%ROWTYPE;
  v_role text;
  v_starts_at timestamptz;
  v_total integer;
BEGIN
  SELECT * INTO v_session FROM public.sessions WHERE id = p_session_id;
  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  IF v_session.tutor_id = auth.uid() THEN
    v_role := 'tutor';
  ELSIF v_session.student_id = auth.uid() THEN
    v_role := 'student';
  ELSE
    -- Not their session. Silent rather than loud: this is called on a timer,
    -- and an error would surface as a broken meeting screen.
    RETURN 0;
  END IF;

  -- Credit is only given around the booked time. Otherwise a pair could open
  -- the room on a quiet Sunday and bank an hour against a session next month.
  --
  -- Through session_starts_at now, so this reads the same clock as completion,
  -- cancellation and rescheduling.
  v_starts_at := public.session_starts_at(v_session.date, v_session.start_time);
  IF now() < v_starts_at - interval '30 minutes'
     OR now() > v_starts_at + (v_session.duration_minutes || ' minutes')::interval + interval '2 hours'
  THEN
    RETURN 0;
  END IF;

  INSERT INTO public.session_attendance (session_id, user_id, role)
  VALUES (p_session_id, auth.uid(), v_role)
  ON CONFLICT (session_id, user_id) DO UPDATE
    SET
      -- Only the gap since the last beat, and never more than two minutes of
      -- it, so a client that went quiet for an hour is credited with two
      -- minutes rather than an hour.
      seconds = public.session_attendance.seconds
                + LEAST(EXTRACT(EPOCH FROM now() - public.session_attendance.last_seen_at)::integer, 120),
      last_seen_at = now()
  RETURNING seconds INTO v_total;

  RETURN v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.record_attendance(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.record_attendance(uuid) TO authenticated;
