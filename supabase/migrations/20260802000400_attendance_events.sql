-- ============================================================
-- Precise join and leave, on top of the heartbeat.
--
-- The heartbeat answers "was somebody there", robustly: it survives a crashed
-- tab, a slept laptop and a closed lid, because last_seen_at is the truth and
-- the two minute cap keeps a silent client from banking an hour.
--
-- What it cannot give is the exact edges. A beat every few minutes means the
-- recorded start is up to one interval late and the end up to one interval
-- early, and those edges are what a tutor is paid against.
--
-- The Zoom SDK does know the edges. onMeetingStatus fires on connect and on
-- the meeting ending, onUserJoin and onUserLeave fire per participant, and all
-- of it is client-side: no REST call, so no paid plan.
--
-- So both, deliberately. Events for precision, heartbeat for robustness. They
-- fail in opposite directions, which is the whole reason to keep the pair:
-- events never fire when a browser is killed, and the heartbeat is coarse.
-- ============================================================

ALTER TABLE public.session_attendance
  ADD COLUMN IF NOT EXISTS first_joined_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_left_at timestamptz;

COMMENT ON COLUMN public.session_attendance.first_joined_at IS
  'When the Zoom SDK reported this person joining. Null if only the heartbeat ever ran, e.g. the events were missed.';
COMMENT ON COLUMN public.session_attendance.last_left_at IS
  'When the SDK reported them leaving or the meeting ending. Null means they never left cleanly, which is normal for a crashed tab.';

-- ------------------------------------------------------------
-- Recording an edge
--
-- Same guards as the heartbeat: it has to be your session, and it has to be
-- around the booked time. A client that could report its own edges could
-- report itself a payout.
--
-- 'leave' accrues the gap since the last beat before stamping, so the tail
-- between the final heartbeat and the meeting ending is not lost. It is capped
-- the same way, for the same reason.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_attendance_event(
  p_session_id uuid,
  p_event text
)
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

  v_starts_at := (v_session.date + v_session.start_time) AT TIME ZONE 'UTC';
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
$$;

COMMENT ON FUNCTION public.record_attendance_event(uuid, text) IS
  'Records a join or leave reported by the Zoom SDK. Guarded like record_attendance: your own session, around the booked time.';

GRANT EXECUTE ON FUNCTION public.record_attendance_event(uuid, text) TO authenticated;

-- ------------------------------------------------------------
-- Did both sides actually turn up
--
-- The question a payout is really asking. Counted here rather than in the
-- client so that "both attended" means one thing everywhere.
-- ------------------------------------------------------------
DROP VIEW IF EXISTS public.v_session_attendance_summary;
CREATE VIEW public.v_session_attendance_summary
WITH (security_invoker = true) AS
SELECT
  a.session_id,
  count(*) FILTER (WHERE a.role = 'tutor')   > 0 AS tutor_present,
  count(*) FILTER (WHERE a.role = 'student') > 0 AS student_present,
  min(a.first_joined_at)                            AS started_at,
  max(a.last_left_at)                               AS ended_at,
  -- The shorter of the two: a lesson lasts as long as both people were in it.
  min(a.seconds)                                    AS overlap_seconds,
  max(a.seconds)                                    AS longest_seconds
FROM public.session_attendance a
GROUP BY a.session_id;

GRANT SELECT ON public.v_session_attendance_summary TO authenticated;
