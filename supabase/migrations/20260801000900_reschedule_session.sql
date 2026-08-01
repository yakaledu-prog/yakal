-- ============================================================
-- Moving a booked session.
--
-- Only tutors could update a session, so the Reschedule button on the student
-- and parent side had nowhere to write and was wired to a mock calendar with
-- hard-coded November dates.
--
-- Opening UPDATE to students and parents would let them write status and notes
-- too, so the move goes through this instead. It is the only way any of them
-- can change a session's time, and it re-checks every rule the picker draws:
-- a client that could pick an hour the tutor never offered could book it.
-- ============================================================

CREATE OR REPLACE FUNCTION public.reschedule_session(
  p_session_id uuid,
  p_date date,
  p_start_time time
)
RETURNS public.sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.sessions%ROWTYPE;
  v_avail   public.tutor_availability%ROWTYPE;
  v_dow     integer;
  v_row     integer;
  v_updated public.sessions%ROWTYPE;
BEGIN
  SELECT * INTO v_session FROM public.sessions WHERE id = p_session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That session no longer exists.';
  END IF;

  -- The three people a session belongs to. A counselor or admin moving it goes
  -- through the same door, which is why is_admin is here rather than a policy.
  IF NOT (
    v_session.student_id = auth.uid()
    OR v_session.tutor_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.parent_student_links l
      WHERE l.student_id = v_session.student_id
        AND l.parent_id = auth.uid()
        AND l.status = 'active'
    )
    OR public.is_admin()
  ) THEN
    RAISE EXCEPTION 'You cannot move this session.';
  END IF;

  IF v_session.status <> 'upcoming' THEN
    RAISE EXCEPTION 'Only an upcoming session can be moved.';
  END IF;

  -- A session that has already started is not rescheduled, it is missed. That
  -- is a conversation with the tutor, not a calendar edit.
  IF (v_session.date + v_session.start_time) AT TIME ZONE 'UTC' < now() THEN
    RAISE EXCEPTION 'That session has already started.';
  END IF;

  IF (p_date + p_start_time) AT TIME ZONE 'UTC' < now() THEN
    RAISE EXCEPTION 'Pick a time in the future.';
  END IF;

  -- The picker only draws hours the tutor published, but the picker is the
  -- client. Check the same grid here.
  SELECT * INTO v_avail FROM public.tutor_availability WHERE tutor_id = v_session.tutor_id;
  IF FOUND THEN
    v_dow := EXTRACT(DOW FROM p_date)::integer;          -- 0 = Sunday, as the grid is stored
    v_row := EXTRACT(HOUR FROM p_start_time)::integer - 8; -- the grid starts at 8 AM

    IF v_dow = ANY (COALESCE(v_avail.disabled_days, ARRAY[]::integer[])) THEN
      RAISE EXCEPTION 'The tutor does not teach on that day.';
    END IF;

    IF v_row < 0
       OR v_row >= COALESCE(array_length(v_avail.time_grid, 1), 0)
       OR COALESCE(v_avail.time_grid[v_row + 1][v_dow + 1], 0) = 0
    THEN
      RAISE EXCEPTION 'The tutor is not available at that time.';
    END IF;
  END IF;

  -- sessions_student_slot_unique catches the student being double booked. The
  -- tutor's own clash has no index behind it, so it is asked for directly.
  IF EXISTS (
    SELECT 1 FROM public.sessions s
    WHERE s.tutor_id = v_session.tutor_id
      AND s.id <> v_session.id
      AND s.date = p_date
      AND s.start_time = p_start_time
      AND s.status <> 'cancelled'
  ) THEN
    RAISE EXCEPTION 'The tutor is already teaching then.';
  END IF;

  UPDATE public.sessions
     SET date = p_date, start_time = p_start_time, updated_at = now()
   WHERE id = p_session_id
  RETURNING * INTO v_updated;

  RETURN v_updated;

EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'There is already a session booked at that time.';
END;
$$;

REVOKE ALL ON FUNCTION public.reschedule_session(uuid, date, time) FROM public;
GRANT EXECUTE ON FUNCTION public.reschedule_session(uuid, date, time) TO authenticated;

-- Everyone in a session needs to see the tutor's published hours to pick a new
-- one. The table was readable only by its owner, so the picker came back empty
-- for the student looking at it.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'tutor_availability' AND policyname = 'Published hours are readable'
  ) THEN
    CREATE POLICY "Published hours are readable"
      ON public.tutor_availability FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;
