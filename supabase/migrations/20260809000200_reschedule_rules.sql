-- Who may move a session, and how late.
--
-- Until now anyone in the session could move it to any free slot, right up to
-- the moment it started. The published cancellation policy has always said 24
-- hours' notice, so the code and the promise disagreed.
--
-- The rule is deliberately asymmetric, because the 24 hours is not a fairness
-- rule, it is there to protect the tutor's blocked-out time from a last-minute
-- client change. Applying it to the tutor would invert what it is for: a tutor
-- who cannot move a session can only cancel it or fail to appear, and both are
-- worse for the student than a new time.
--
--   student, parent   may move it while it is more than 24 hours away
--   tutor             may move it at any time, and must say why
--   admin, counselor  may move it at any time, no reason required
--
-- The reason is stored rather than only sent, so "why was this moved twice"
-- has an answer later, when the notification has long been read and dismissed.

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS reschedule_reason text,
  ADD COLUMN IF NOT EXISTS rescheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS rescheduled_by uuid REFERENCES auth.users(id);

-- The old three-argument form is replaced, not overloaded. Two functions with
-- the same name and a defaulted argument is how a caller silently keeps hitting
-- the version without the checks.
DROP FUNCTION IF EXISTS public.reschedule_session(uuid, date, time);

CREATE OR REPLACE FUNCTION public.reschedule_session(
  p_session_id uuid,
  p_date date,
  p_start_time time,
  p_reason text DEFAULT NULL
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
  v_is_tutor boolean;
  v_is_staff boolean;
  v_starts_at timestamptz;
BEGIN
  SELECT * INTO v_session FROM public.sessions WHERE id = p_session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That session no longer exists.';
  END IF;

  v_is_tutor := v_session.tutor_id = auth.uid();
  v_is_staff := public.is_admin();

  IF NOT (
    v_session.student_id = auth.uid()
    OR v_is_tutor
    OR EXISTS (
      SELECT 1 FROM public.parent_student_links l
      WHERE l.student_id = v_session.student_id
        AND l.parent_id = auth.uid()
        AND l.status = 'active'
    )
    OR v_is_staff
  ) THEN
    RAISE EXCEPTION 'You cannot move this session.';
  END IF;

  IF v_session.status <> 'upcoming' THEN
    RAISE EXCEPTION 'Only an upcoming session can be moved.';
  END IF;

  v_starts_at := (v_session.date + v_session.start_time) AT TIME ZONE 'UTC';

  -- A session that has already started is not rescheduled, it is missed. That
  -- is a conversation with the tutor, not a calendar edit.
  IF v_starts_at < now() THEN
    RAISE EXCEPTION 'That session has already started.';
  END IF;

  -- The client side hides the button inside the window, but the client is the
  -- client. This is where the rule actually holds.
  IF NOT v_is_tutor AND NOT v_is_staff AND v_starts_at < now() + interval '24 hours' THEN
    RAISE EXCEPTION 'Sessions can only be moved more than 24 hours in advance. Message your tutor to ask.';
  END IF;

  -- Asked of the tutor only. They are moving a time the student already
  -- arranged their day around, and "no reason given" is what makes that feel
  -- arbitrary rather than unavoidable.
  IF v_is_tutor AND COALESCE(btrim(p_reason), '') = '' THEN
    RAISE EXCEPTION 'Give the student a reason for the change.';
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
     SET date = p_date,
         start_time = p_start_time,
         reschedule_reason = NULLIF(btrim(COALESCE(p_reason, '')), ''),
         rescheduled_at = now(),
         rescheduled_by = auth.uid(),
         updated_at = now()
   WHERE id = p_session_id
  RETURNING * INTO v_updated;

  RETURN v_updated;

EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'There is already a session booked at that time.';
END;
$$;

REVOKE ALL ON FUNCTION public.reschedule_session(uuid, date, time, text) FROM public;
GRANT EXECUTE ON FUNCTION public.reschedule_session(uuid, date, time, text) TO authenticated;
