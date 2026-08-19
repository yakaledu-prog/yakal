-- ============================================================
-- Cancelling a lesson, and the money that follows it.
--
-- The published policy at /cancellation-policy has always said 24 hours'
-- notice, a 50% fee inside that, and a full charge for a no-show. None of it
-- was implemented. cancelSession set status to 'cancelled' from the browser and
-- that was the whole of it: no notice window, nobody refunded, and the tutor's
-- held hour worth nothing either way.
--
-- Publishing a term you do not honour is worse than having no term, so this is
-- the policy as written rather than a new one.
-- ============================================================

-- ------------------------------------------------------------
-- When a lesson actually starts
--
-- sessions store a naive date and a naive time, so turning them into a moment
-- needs a zone, and two places were using different ones. reschedule_session
-- read them as UTC; sessions_due_for_completion reads them as the platform's
-- zone. The same lesson therefore had two start times four or five hours apart,
-- which is most of a notice window.
--
-- The platform runs US Eastern, which is what ZOOM_TIMEZONE defaults to and
-- what every meeting is created in, so that is the right answer and UTC was the
-- bug. One function now, so the two can no longer drift.
-- ------------------------------------------------------------
-- The zone stays an argument rather than being baked in, defaulting to the
-- platform's. A hardcoded zone here would silently disagree with ZOOM_TIMEZONE
-- the day anybody changed that, which is the same class of bug this replaces.
CREATE OR REPLACE FUNCTION public.session_starts_at(
  p_date date,
  p_start_time time,
  p_timezone text DEFAULT 'America/New_York'
)
RETURNS timestamptz
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT (p_date + p_start_time) AT TIME ZONE p_timezone;
$$;

COMMENT ON FUNCTION public.session_starts_at(date, time, text) IS
  'A session''s naive date and time as a real moment. The one place that conversion is written.';

-- ------------------------------------------------------------
-- What was given back, and why
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  -- Which lesson, when a purchase of several is only partly refunded. Null for
  -- a refund of the whole thing.
  session_id uuid REFERENCES public.sessions(id) ON DELETE SET NULL,

  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  currency text NOT NULL DEFAULT 'usd',

  -- Which rule produced it. Kept so a total can be explained later without
  -- anybody having to remember what the policy said last year.
  --
  --   in_notice        cancelled with 24 hours or more to go, refunded in full
  --   late             cancelled inside 24 hours, half kept per the policy
  --   tutor_cancelled  the tutor called it off, so the family pays nothing
  --   admin            somebody decided, and the note says why
  reason text NOT NULL CHECK (reason IN ('in_notice', 'late', 'tutor_cancelled', 'admin')),
  note text,

  stripe_refund_id text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed')),

  requested_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One live refund per lesson. Cancelling twice, or a retried request, must not
-- give the money back twice.
CREATE UNIQUE INDEX IF NOT EXISTS refunds_one_per_session
  ON public.refunds (session_id)
  WHERE session_id IS NOT NULL AND status <> 'failed';

CREATE INDEX IF NOT EXISTS refunds_invoice_idx ON public.refunds (invoice_id);

COMMENT ON TABLE public.refunds IS
  'Money given back, and which rule of the published cancellation policy produced it.';

-- ------------------------------------------------------------
-- Access
--
-- New tables arrive with anon and authenticated granted everything by the
-- project's default privileges, so the grant is revoked before any policy is
-- written. See supabase/migrations/20260805000100_testimonials.sql.
-- ------------------------------------------------------------
REVOKE ALL ON public.refunds FROM anon, authenticated;
GRANT SELECT ON public.refunds TO authenticated;

ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS refunds_own_select ON public.refunds;
DROP POLICY IF EXISTS refunds_admin_all ON public.refunds;

-- The family who paid can see what came back to them.
CREATE POLICY refunds_own_select ON public.refunds
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
       WHERE i.id = refunds.invoice_id
         AND i.parent_id = auth.uid()
    )
  );

-- Writes are the server's, through the service role. There is deliberately no
-- policy letting anybody else insert: a row here is a claim that money moved.
CREATE POLICY refunds_admin_all ON public.refunds
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ------------------------------------------------------------
-- Reschedule: the same clock as everything else
--
-- Redefined only to replace the UTC conversion. Everything else about who may
-- move a session and how late is unchanged, and the reasoning for the
-- asymmetry is in 20260809000200.
-- ------------------------------------------------------------
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

  v_starts_at := public.session_starts_at(v_session.date, v_session.start_time);

  IF v_starts_at < now() THEN
    RAISE EXCEPTION 'That session has already started.';
  END IF;

  IF NOT v_is_tutor AND NOT v_is_staff AND v_starts_at < now() + interval '24 hours' THEN
    RAISE EXCEPTION 'Sessions can only be moved more than 24 hours in advance. Message your tutor to ask.';
  END IF;

  IF v_is_tutor AND COALESCE(btrim(p_reason), '') = '' THEN
    RAISE EXCEPTION 'Give the student a reason for the change.';
  END IF;

  IF public.session_starts_at(p_date, p_start_time) < now() THEN
    RAISE EXCEPTION 'Pick a time in the future.';
  END IF;

  SELECT * INTO v_avail FROM public.tutor_availability WHERE tutor_id = v_session.tutor_id;
  IF FOUND THEN
    v_dow := EXTRACT(DOW FROM p_date)::integer;
    v_row := EXTRACT(HOUR FROM p_start_time)::integer - 8;

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
END;
$$;

-- Completion reads the same clock, so a lesson cannot be finished by one
-- function while another still thinks it is hours away.
CREATE OR REPLACE FUNCTION public.sessions_due_for_completion(
  p_timezone text DEFAULT 'America/New_York',
  p_limit int DEFAULT 200
)
RETURNS TABLE (
  id uuid,
  tutor_id uuid,
  student_id uuid,
  subject text,
  session_date date,
  start_time time,
  duration_minutes int,
  mode text,
  tutor_earning_cents int,
  invoice_id uuid,
  attendance jsonb,
  attendance_checked_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.tutor_id, s.student_id, s.subject, s.date, s.start_time,
         s.duration_minutes, s.mode, s.tutor_earning_cents, s.invoice_id,
         s.attendance, s.attendance_checked_at
    FROM public.sessions s
   WHERE s.status = 'upcoming'
     AND public.session_starts_at(s.date, s.start_time, p_timezone)
         + make_interval(mins => s.duration_minutes) < now()
   ORDER BY s.date, s.start_time
   LIMIT p_limit;
$$;

REVOKE ALL ON FUNCTION public.sessions_due_for_completion(text, int) FROM public, anon, authenticated;

-- Why it was called off, in the words of whoever did.
--
-- Its own column rather than sessions.notes: those are the tutor's record of
-- what was covered in a lesson, and overwriting them with "child is ill" would
-- destroy the one thing on the row worth keeping.
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS cancel_reason text;
