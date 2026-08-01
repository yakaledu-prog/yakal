-- ============================================================
-- Two things a finished session is missing: what it was worth, and what the
-- student thought of it.
--
-- Payment was tracked per invoice, so a tutor who taught six lessons on one
-- purchase saw one line and could not tell which sessions it covered. Money is
-- earned a session at a time, so it is now tracked a session at a time, and the
-- tutor's earnings page is that ledger.
--
-- Ratings had no home at all. Session notes were standing in for them, which
-- answered a different question: a note says what was covered, a rating says
-- whether it was any good, and only the second one adds up to a tutor's
-- reputation.
-- ============================================================

-- ---------- what a session is worth ----------

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payout_cents integer,
  ADD COLUMN IF NOT EXISTS payout_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS payout_requested_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sessions_payout_status_check'
  ) THEN
    ALTER TABLE public.sessions ADD CONSTRAINT sessions_payout_status_check
      CHECK (payout_status IN ('none', 'requested', 'paid'));
  END IF;
END $$;

COMMENT ON COLUMN public.sessions.payout_cents IS
  'The tutor''s share of this one session, split from the invoice at fulfilment.';

CREATE INDEX IF NOT EXISTS sessions_payout_status_idx
  ON public.sessions (tutor_id, payout_status);

-- A payout can now settle one session rather than a whole invoice.
ALTER TABLE public.tutor_payouts
  ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES public.sessions(id) ON DELETE SET NULL;

-- Sessions that already exist were booked before any of this. Their invoice is
-- findable through the enrolment, and its payout splits evenly across the
-- sessions it bought, remainder to the earliest so the pennies are not lost.
WITH matched AS (
  SELECT
    s.id AS session_id,
    i.id AS invoice_id,
    i.payout_cents AS total,
    COUNT(*) OVER (PARTITION BY i.id) AS n,
    ROW_NUMBER() OVER (PARTITION BY i.id ORDER BY s.date, s.start_time) AS rn
  FROM public.sessions s
  JOIN public.enrolments e
    ON e.student_id = s.student_id AND e.course_id = s.course_id
  JOIN public.invoices i
    ON i.id = e.invoice_id AND i.status = 'paid'
  WHERE s.invoice_id IS NULL AND s.course_id IS NOT NULL
)
UPDATE public.sessions s
   SET invoice_id = m.invoice_id,
       payout_cents = (m.total / m.n) + CASE WHEN m.rn = 1 THEN m.total % m.n ELSE 0 END
  FROM matched m
 WHERE s.id = m.session_id;

-- ---------- what the student thought ----------

CREATE TABLE IF NOT EXISTS public.session_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  rated_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ratee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stars smallint NOT NULL CHECK (stars BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  -- One rating per person per session. A student who changes their mind
  -- updates it; they do not get a second vote.
  UNIQUE (session_id, rated_by)
);

CREATE INDEX IF NOT EXISTS session_ratings_ratee_idx ON public.session_ratings (ratee_id);

ALTER TABLE public.session_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ratings visible to the people in the session"
  ON public.session_ratings FOR SELECT
  USING (
    rated_by = auth.uid()
    OR ratee_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.sessions s
      JOIN public.parent_student_links l
        ON l.student_id = s.student_id AND l.parent_id = auth.uid() AND l.status = 'active'
      WHERE s.id = session_ratings.session_id
    )
    OR public.is_admin()
  );

-- Only the student who sat the session, and only once it has ended. Rating a
-- lesson that has not happened is not an opinion, it is noise.
CREATE POLICY "students rate their own finished sessions"
  ON public.session_ratings FOR INSERT
  TO authenticated
  WITH CHECK (
    rated_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = session_ratings.session_id
        AND s.student_id = auth.uid()
        AND s.tutor_id = session_ratings.ratee_id
        AND (s.date + s.start_time) AT TIME ZONE 'UTC' < now()
    )
  );

CREATE POLICY "students can change their own rating"
  ON public.session_ratings FOR UPDATE
  TO authenticated
  USING (rated_by = auth.uid())
  WITH CHECK (rated_by = auth.uid());

/**
 * A tutor's standing, as an average and a count.
 *
 * The count matters as much as the average: 5.0 from one lesson and 4.6 from
 * ninety are not the same claim, and showing only the number implies they are.
 */
CREATE OR REPLACE VIEW public.tutor_ratings AS
  SELECT
    ratee_id AS tutor_id,
    ROUND(AVG(stars)::numeric, 2) AS average_stars,
    COUNT(*)::integer AS rating_count
  FROM public.session_ratings
  GROUP BY ratee_id;

GRANT SELECT ON public.tutor_ratings TO authenticated, anon;

-- ---------- asking to be paid ----------

/**
 * The tutor says a session happened and asks for their share.
 *
 * This is the only way a session becomes payable, and it is deliberately not a
 * plain UPDATE: the checks below are the whole point.
 *
 * Attendance is corroborating, not gating. Where we have records, both people
 * must actually have been in the room; where we have none, the request still
 * goes through and carries that fact to the admin, because a tutor who taught
 * a lesson over a phone line should not go unpaid for our missing telemetry.
 */
CREATE OR REPLACE FUNCTION public.request_session_payment(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session   public.sessions%ROWTYPE;
  v_ends_at   timestamptz;
  v_rows      integer;
  v_tutor_min integer;
  v_student_min integer;
  v_needed    integer;
BEGIN
  SELECT * INTO v_session FROM public.sessions WHERE id = p_session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That session no longer exists.';
  END IF;

  IF v_session.tutor_id <> auth.uid() THEN
    RAISE EXCEPTION 'Only the tutor who taught a session can ask to be paid for it.';
  END IF;

  IF v_session.payout_status <> 'none' THEN
    RAISE EXCEPTION 'Payment for that session has already been requested.';
  END IF;

  v_ends_at := (v_session.date + v_session.start_time) AT TIME ZONE 'UTC'
               + (v_session.duration_minutes || ' minutes')::interval;
  IF now() < v_ends_at THEN
    RAISE EXCEPTION 'That session has not finished yet.';
  END IF;

  IF v_session.status = 'cancelled' THEN
    RAISE EXCEPTION 'That session was cancelled.';
  END IF;

  -- Half the booked hour, capped at thirty minutes: enough to distinguish a
  -- lesson from someone opening the room and leaving.
  v_needed := LEAST(30, GREATEST(v_session.duration_minutes / 2, 1));

  SELECT COUNT(*),
         COALESCE(MAX(seconds) FILTER (WHERE role = 'tutor'), 0) / 60,
         COALESCE(MAX(seconds) FILTER (WHERE role = 'student'), 0) / 60
    INTO v_rows, v_tutor_min, v_student_min
    FROM public.session_attendance
   WHERE session_id = p_session_id;

  IF v_rows > 0 AND (v_tutor_min < v_needed OR v_student_min < v_needed) THEN
    RAISE EXCEPTION
      'Our records show % minutes for you and % minutes for the student, and a session needs % from each. Ask an admin to review it.',
      v_tutor_min, v_student_min, v_needed;
  END IF;

  UPDATE public.sessions
     SET status = 'completed',
         payout_status = 'requested',
         payout_requested_at = now(),
         updated_at = now()
   WHERE id = p_session_id;

  RETURN jsonb_build_object(
    'attendance_known', v_rows > 0,
    'tutor_minutes', v_tutor_min,
    'student_minutes', v_student_min
  );
END;
$$;

REVOKE ALL ON FUNCTION public.request_session_payment(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.request_session_payment(uuid) TO authenticated;
