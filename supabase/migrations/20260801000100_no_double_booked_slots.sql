-- ============================================================
-- A child cannot be in two lessons at once.
--
-- Slots are picked per course, so nothing stopped a parent buying Chemistry at
-- Monday 4pm and then Physics at Monday 4pm for the same child. The booking
-- grid had no idea the other purchase existed.
--
-- The UI now hides slots that are already taken, but the UI is a snapshot: two
-- tabs open, or a slow payment, and it is out of date. This is the guarantee
-- underneath it.
--
-- Only the child is enforced here. A tutor teaching two students at the same
-- hour is also wrong today, but it is wrong by policy rather than by physics:
-- a group class would be exactly that row, and an index would make it
-- impossible to add later. That one is caught before checkout instead.
-- ============================================================

-- Existing duplicates, all of them from repeated test bookings of the same
-- slot. Keep one per slot, preferring the row attached to a course, then the
-- oldest, so the copy that a package counts against is the one that survives.
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY student_id, date, start_time
      ORDER BY (course_id IS NULL), created_at
    ) AS rn
  FROM public.sessions
  WHERE status <> 'cancelled'
)
DELETE FROM public.sessions s
USING ranked r
WHERE s.id = r.id
  AND r.rn > 1;

-- Cancelled sessions are excluded: an hour that was given up is free again,
-- and the record of it should not block rebooking the same time.
CREATE UNIQUE INDEX IF NOT EXISTS sessions_student_slot_unique
  ON public.sessions (student_id, date, start_time)
  WHERE status <> 'cancelled';

-- ------------------------------------------------------------
-- Which hours a tutor is already spoken for.
--
-- A parent cannot read another family's sessions, and should not be able to.
-- But they do need to know an hour is gone, or two families buy the same hour
-- and one of them finds out when the tutor does not turn up.
--
-- So this returns times and nothing else: no student, no course, no subject.
-- Enough to grey out a button, not enough to learn anything about anyone.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tutor_busy_slots(
  p_tutor_id uuid,
  p_from date,
  p_to date
)
RETURNS TABLE (busy_date date, busy_time time without time zone)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.date, s.start_time
  FROM public.sessions s
  WHERE s.tutor_id = p_tutor_id
    AND s.status <> 'cancelled'
    AND s.date BETWEEN p_from AND p_to
  GROUP BY s.date, s.start_time;
$$;

REVOKE ALL ON FUNCTION public.tutor_busy_slots(uuid, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tutor_busy_slots(uuid, date, date) TO authenticated;
