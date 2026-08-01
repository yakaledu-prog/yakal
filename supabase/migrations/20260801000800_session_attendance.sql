-- ============================================================
-- Did the session actually happen?
--
-- Tutors are paid per session, so something has to answer that question
-- without taking the tutor's word for it. Zoom is the obvious source and it is
-- closed to us: /past_meetings/{id}/participants answers 400 "Only available
-- for Paid or ZMP account" on the free plan, whatever scopes the app holds.
--
-- So attendance is recorded from our own meeting client instead, which turns
-- out to be the better witness anyway: it knows the signed-in user id rather
-- than a display name somebody typed.
--
-- Time is accumulated by heartbeat rather than measured from a join and a
-- leave. A browser that is closed hard never sends a leave, and a tab left
-- open overnight would otherwise bank eight hours. Each beat adds only the
-- gap since the last one, capped, so neither case lies.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.session_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('tutor', 'student', 'counselor')),
  first_joined_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  seconds integer NOT NULL DEFAULT 0,
  UNIQUE (session_id, user_id)
);

CREATE INDEX IF NOT EXISTS session_attendance_session_idx
  ON public.session_attendance (session_id);

COMMENT ON COLUMN public.session_attendance.seconds IS
  'Accumulated by heartbeat, never derived from first_joined_at, so a tab left open does not read as attendance.';

ALTER TABLE public.session_attendance ENABLE ROW LEVEL SECURITY;

-- Everyone involved in a session can see who attended it: the two people in
-- the room, the parents of the student, and staff.
CREATE POLICY "attendance visible to the people in the session"
  ON public.session_attendance FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = session_attendance.session_id
        AND (
          s.tutor_id = auth.uid()
          OR s.student_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.parent_student_links l
            WHERE l.student_id = s.student_id
              AND l.parent_id = auth.uid()
              AND l.status = 'active'
          )
        )
    )
    OR public.is_admin()
  );

-- No INSERT or UPDATE policy on purpose. Rows are only ever written by
-- record_attendance below, which checks the caller belongs in the session and
-- that the clock is anywhere near it. A client that could write this table
-- directly could write itself a payout.

-- ============================================================
-- The heartbeat.
--
-- Called by the meeting client every minute or so. Returns the running total
-- so the caller can show it, and refuses politely rather than raising when the
-- caller has no business in this session.
-- ============================================================
CREATE OR REPLACE FUNCTION public.record_attendance(p_session_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session   public.sessions%ROWTYPE;
  v_role      text;
  v_starts_at timestamptz;
  v_total     integer;
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
  v_starts_at := (v_session.date + v_session.start_time) AT TIME ZONE 'UTC';
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
