-- ============================================================
-- The other half of the attendance clock bug.
--
-- 20260825000300 moved record_attendance onto session_starts_at, and missed
-- record_attendance_event, which carried the identical line. So the precise
-- join and leave edges from the meeting SDK were being discarded for exactly
-- the same reason the heartbeat was: the credit window was computed from the
-- booked slot read as UTC while the rest of the platform reads it as US
-- Eastern, and never overlapped the lesson.
--
-- Found by scripts/verify/attendance.mjs, which had been failing on the half
-- that was fixed and passing on the half that was not, because its own fixture
-- also wrote the slot in UTC.
-- ============================================================

CREATE OR REPLACE FUNCTION public.record_attendance_event(p_session_id uuid, p_event text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_session   public.sessions%ROWTYPE;
  v_role      text;
  v_starts_at timestamptz;
  v_total     integer;
BEGIN
  IF p_event NOT IN ('join', 'leave') THEN
    RETURN 0;
  END IF;

  SELECT * INTO v_session FROM public.sessions WHERE id = p_session_id;
  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  IF v_session.tutor_id = auth.uid() THEN
    v_role := 'tutor';
  ELSIF v_session.student_id = auth.uid() THEN
    v_role := 'student';
  ELSE
    RETURN 0;
  END IF;

  v_starts_at := public.session_starts_at(v_session.date, v_session.start_time);
  IF now() < v_starts_at - interval '30 minutes'
     OR now() > v_starts_at + (v_session.duration_minutes || ' minutes')::interval + interval '2 hours'
  THEN
    RETURN 0;
  END IF;

  IF p_event = 'join' THEN
    INSERT INTO public.session_attendance (session_id, user_id, role, first_joined_at)
    VALUES (p_session_id, auth.uid(), v_role, now())
    ON CONFLICT (session_id, user_id) DO UPDATE
      SET
        -- The first join is the one that counts. Rejoining after a dropout
        -- should not rewrite when they arrived.
        first_joined_at = COALESCE(public.session_attendance.first_joined_at, now()),
        -- Reset the clock rather than accruing: the gap before a join is time
        -- they were not in the meeting.
        last_seen_at = now()
      RETURNING seconds INTO v_total;
  ELSE
    INSERT INTO public.session_attendance (session_id, user_id, role, last_left_at)
    VALUES (p_session_id, auth.uid(), v_role, now())
    ON CONFLICT (session_id, user_id) DO UPDATE
      SET
        seconds = public.session_attendance.seconds
                  + LEAST(EXTRACT(EPOCH FROM now() - public.session_attendance.last_seen_at)::integer, 300),
        last_seen_at = now(),
        last_left_at = now()
      RETURNING seconds INTO v_total;
  END IF;

  RETURN COALESCE(v_total, 0);
END;
$function$
