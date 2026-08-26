-- ============================================================
-- A family saying a lesson did not happen.
--
-- The 72 hour hold exists so a complaint can arrive while the money is still
-- ours. Until now there was no way to make one: the hold protected a window
-- nobody could act in, and a parent whose child was stood up had to email.
--
-- Raising one does not cancel anything. It stops the money where it is and
-- asks a person to decide, because "the tutor never showed" and "the lesson ran
-- and we did not like it" look identical from here and only one of them is a
-- refund.
-- ============================================================

-- ------------------------------------------------------------
-- Held, which is not cancelled
--
-- An upheld dispute cancels an earning and a rejected one releases it, so the
-- state in between has to be distinguishable from both. Reusing 'cancelled'
-- would say the money is gone while somebody is still deciding, and reusing
-- 'pending' would let the next job run pay it out mid-argument.
--
-- Everything that moves money already filters on status = 'pending', so a held
-- row is skipped by the release job and by the admin's manual settle without
-- either of them needing to know this exists.
-- ------------------------------------------------------------
ALTER TABLE public.earnings DROP CONSTRAINT IF EXISTS earnings_status_check;

ALTER TABLE public.earnings
  ADD CONSTRAINT earnings_status_check CHECK (
    status = ANY (ARRAY['pending'::text, 'held'::text, 'settled'::text, 'cancelled'::text, 'reversed'::text])
  );

-- ------------------------------------------------------------
-- The complaint itself
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.session_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  raised_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Which complaint, so a total can be explained later without anybody having
  -- to remember what was meant.
  --
  --   no_show      nobody was there
  --   left_early   it happened, but not for the hour that was paid for
  --   quality      it happened and was not what was bought
  --   other        the note says
  reason text NOT NULL CHECK (reason IN ('no_show', 'left_early', 'quality', 'other')),
  detail text NOT NULL CHECK (length(btrim(detail)) > 0),

  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'upheld', 'rejected')),
  resolved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolution_note text,
  resolved_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One argument at a time. A second complaint about the same lesson while the
-- first is open is the same complaint, and two open rows would let one be
-- upheld and the other rejected.
CREATE UNIQUE INDEX IF NOT EXISTS session_disputes_one_open
  ON public.session_disputes (session_id)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS session_disputes_open_idx
  ON public.session_disputes (created_at DESC)
  WHERE status = 'open';

COMMENT ON TABLE public.session_disputes IS
  'A family saying a lesson did not happen as booked. Holds the tutor''s earning until somebody decides.';

-- ------------------------------------------------------------
-- Access
--
-- New tables arrive with anon and authenticated granted everything by the
-- project's default privileges, so the grant is revoked before any policy is
-- written. See supabase/migrations/20260805000100_testimonials.sql.
-- ------------------------------------------------------------
REVOKE ALL ON public.session_disputes FROM anon, authenticated;
GRANT SELECT, INSERT ON public.session_disputes TO authenticated;

ALTER TABLE public.session_disputes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS session_disputes_read ON public.session_disputes;
DROP POLICY IF EXISTS session_disputes_raise ON public.session_disputes;
DROP POLICY IF EXISTS session_disputes_admin ON public.session_disputes;

-- Everybody who was part of the lesson can see the complaint, the tutor
-- included. Being argued about without being told is worse than the argument.
CREATE POLICY session_disputes_read ON public.session_disputes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.sessions s
       WHERE s.id = session_disputes.session_id
         AND (
           s.student_id = auth.uid()
           OR s.tutor_id = auth.uid()
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

-- Only the family raises one, and only about their own lesson. A tutor cannot
-- dispute their own session: that is a request for review, not a complaint,
-- and it would let them stop their own payout.
CREATE POLICY session_disputes_raise ON public.session_disputes
  FOR INSERT WITH CHECK (
    raised_by = auth.uid()
    AND status = 'open'
    AND EXISTS (
      SELECT 1 FROM public.sessions s
       WHERE s.id = session_disputes.session_id
         AND (
           s.student_id = auth.uid()
           OR EXISTS (
             SELECT 1 FROM public.parent_student_links l
              WHERE l.student_id = s.student_id
                AND l.parent_id = auth.uid()
                AND l.status = 'active'
           )
         )
    )
  );

-- Resolving is an admin's, and goes through the server so the money moves in
-- the same transaction as the verdict.
CREATE POLICY session_disputes_admin ON public.session_disputes
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ------------------------------------------------------------
-- What an admin needs to judge one
--
-- The complaint in the family's words, and who was actually in the room.
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_open_disputes
WITH (security_invoker = true) AS
  SELECT
    d.id,
    d.session_id,
    d.reason,
    d.detail,
    d.created_at,
    d.raised_by,
    raiser.full_name AS raised_by_name,
    s.subject,
    s.date AS session_date,
    s.start_time,
    s.duration_minutes,
    s.status AS session_status,
    s.tutor_id,
    tutor.full_name AS tutor_name,
    s.student_id,
    student.full_name AS student_name,
    -- Evidence, not verdict. Null means our meeting client never saw either of
    -- them, which for an in-person lesson is expected and says nothing.
    att.tutor_present,
    att.student_present,
    att.started_at AS attendance_started_at,
    att.longest_seconds,
    att.overlap_seconds,
    e.id AS earning_id,
    e.amount_cents AS earning_cents,
    e.status AS earning_status,
    i.id AS invoice_id,
    i.amount_cents AS invoice_cents,
    i.stripe_charge_id
  FROM public.session_disputes d
  JOIN public.sessions s ON s.id = d.session_id
  LEFT JOIN public.profiles raiser ON raiser.id = d.raised_by
  LEFT JOIN public.profiles tutor ON tutor.id = s.tutor_id
  LEFT JOIN public.profiles student ON student.id = s.student_id
  LEFT JOIN public.v_session_attendance_summary att ON att.session_id = s.id
  LEFT JOIN public.earnings e ON e.session_id = s.id AND e.voided_at IS NULL
  LEFT JOIN public.invoices i ON i.id = s.invoice_id
 WHERE d.status = 'open';

COMMENT ON VIEW public.v_open_disputes IS
  'Open complaints with the attendance an admin needs to judge them.';

GRANT SELECT ON public.v_open_disputes TO authenticated;

-- A complaint is its own kind of news, for the tutor and for the admins.
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check CHECK (type IN (
    'booking', 'assignment', 'approval', 'message', 'system', 'parent_link',
    'application', 'unlock_request', 'course_application',
    'course_application_decided', 'enrolment', 'admissions_plan',
    'essay_review', 'payout', 'message_report', 'session_moved',
    'session_cancelled', 'session_disputed'
  ));
