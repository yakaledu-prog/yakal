-- ============================================================
-- A counsellor earns the month at the end of it, not the start.
--
-- The share was written when the subscription renewed and released 72 hours
-- later, so a plan renewing on the 1st paid on the 4th for a month of work
-- nobody had done yet. If the counsellor then stopped answering, the family's
-- refund came out of Yakal rather than out of the money still held for it.
--
-- The earnings ledger's own rule is that nothing moves before the work is
-- delivered. Tutoring has always honoured it, because a lesson has an end time.
-- A subscription month has one too; it was simply not being used.
--
-- Two changes, and the row keeps being written at renewal so a counsellor can
-- still see what the month is worth while they are working it:
--
--   the hold runs to the end of the period rather than 72 hours from payment
--   the release refuses to pay a period in which nothing was delivered
-- ============================================================

-- ------------------------------------------------------------
-- When the paid-for period ends
--
-- period_start alone cannot say, because a plan billed on the 20th has months
-- that are not calendar months, and the release job needs a moment to compare
-- against rather than a date to guess from.
-- ------------------------------------------------------------
ALTER TABLE public.earnings
  ADD COLUMN IF NOT EXISTS period_end timestamptz;

COMMENT ON COLUMN public.earnings.period_end IS
  'The end of the period this pays for. Counselling only: the hold runs to here, not to 72 hours after payment.';

-- Existing counselling rows predate the column. A month is the right guess for
-- every one of them, because that is the only interval a tier has ever billed
-- at, and it is only used to hold money back rather than to pay it out.
UPDATE public.earnings
   SET period_end = (period_start + interval '1 month')
 WHERE kind = 'counselling_month'
   AND period_start IS NOT NULL
   AND period_end IS NULL;

-- Anything still owed gets the longer hold applied retroactively. Rows already
-- settled are left alone: that money has gone, and rewriting the hold on it
-- would say something false about when it was allowed to.
UPDATE public.earnings
   SET releasable_at = GREATEST(releasable_at, period_end + interval '72 hours'),
       updated_at = now()
 WHERE kind = 'counselling_month'
   AND status = 'pending'
   AND period_end IS NOT NULL;

-- ------------------------------------------------------------
-- Did the counsellor do anything this period?
--
-- Deliberately a low bar. This is not a measure of whether a family got their
-- money's worth, which is a judgement for a person; it is the difference
-- between a counsellor who worked and one who was never there. Anything more
-- exact would start withholding pay over a quota nobody agreed to.
--
-- Two kinds of evidence, because counselling is delivered two ways:
--
--   an advising session that actually completed
--   an essay returned or approved
--
-- 'reopened' is not counted. It sends an essay back for another draft without
-- the counsellor having read a new one, so it is the one action a counsellor
-- could take repeatedly while doing nothing.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.counselling_period_delivered(
  p_plan uuid,
  p_from timestamptz,
  p_to timestamptz
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.sessions s
      JOIN public.admissions_plans p ON p.id = p_plan
     WHERE s.kind = 'advising'
       AND s.tutor_id = p.counselor_id
       AND s.student_id = p.student_id
       AND s.status = 'completed'
       AND public.session_starts_at(s.date, s.start_time) >= p_from
       AND public.session_starts_at(s.date, s.start_time) < p_to
  )
  OR EXISTS (
    SELECT 1
      FROM public.essay_reviews r
      JOIN public.essays e ON e.id = r.essay_id
      JOIN public.admissions_plans p ON p.id = p_plan
     WHERE r.counselor_id = p.counselor_id
       AND e.student_id = p.student_id
       AND r.action IN ('returned', 'approved')
       AND r.created_at >= p_from
       AND r.created_at < p_to
  );
$$;

COMMENT ON FUNCTION public.counselling_period_delivered(uuid, timestamptz, timestamptz) IS
  'Whether the plan''s counsellor delivered anything in the window. The gate on paying out a subscription month.';

-- The release job calls this through the service role. No signed-in person has
-- any reason to, and it reads across two families' worth of tables.
REVOKE ALL ON FUNCTION public.counselling_period_delivered(uuid, timestamptz, timestamptz)
  FROM public, anon, authenticated;

-- ------------------------------------------------------------
-- Completion has to say which kind of session it finished
--
-- An advising hour is a sessions row like any other, so it flows through the
-- same completion step as a lesson. It has to: counselling_period_delivered
-- reads status = 'completed', so an advising session that never completes makes
-- its counsellor look like they did nothing.
--
-- What it must not do is earn. A counsellor is paid through the subscription,
-- and a second earning against the same hour would pay them twice. Today that
-- is avoided only by accident, because book_advising_session never sets
-- tutor_earning_cents and recordSessionEarning returns early on a zero. That is
-- one column default away from being wrong, so the job now decides on kind
-- rather than on an amount that happens to be missing.
--
-- Dropped rather than replaced: the return type gains a column, and Postgres
-- will not change that in place.
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.sessions_due_for_completion(text, int);

CREATE FUNCTION public.sessions_due_for_completion(
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
  kind text,
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
         s.duration_minutes, s.mode, s.kind, s.tutor_earning_cents, s.invoice_id,
         s.attendance, s.attendance_checked_at
    FROM public.sessions s
   WHERE s.status = 'upcoming'
     AND public.session_starts_at(s.date, s.start_time, p_timezone)
         + make_interval(mins => s.duration_minutes) < now()
   ORDER BY s.date, s.start_time
   LIMIT p_limit;
$$;

REVOKE ALL ON FUNCTION public.sessions_due_for_completion(text, int) FROM public, anon, authenticated;
