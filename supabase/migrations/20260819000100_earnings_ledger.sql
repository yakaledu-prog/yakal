-- ============================================================
-- One ledger for money owed to people.
--
-- There were four mechanisms for one question. invoices.payout_cents and
-- invoices.payout_status said what a purchase owed a tutor; sessions.payout_cents
-- and sessions.payout_status said the same thing a lesson at a time;
-- tutor_payouts recorded payments that had already happened; counselor_payouts
-- recorded amounts owed that nothing ever paid. Asking "what do we owe, and may
-- it move yet" meant reading all four and hoping they agreed.
--
-- This is one row per amount owed to one person, carrying both the obligation
-- and its settlement. It replaces the tutor half; counselling moves here when
-- subscriptions land, and counselor_payouts is left alone until then rather
-- than half-migrated.
--
-- The rule the whole design rests on: money is never transferred to a payee
-- before the work is delivered. Stripe does not reverse a transfer when the
-- charge that funded it is refunded, and funds that have reached a connected
-- account's bank cannot be recovered at all. So an earning is written when a
-- session completes, not when a parent pays, and it waits out a hold before it
-- can move. Undelivered money stays in the platform balance, where refunding it
-- costs one API call and reverses nothing.
-- ============================================================

-- ------------------------------------------------------------
-- The ledger
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('tutoring_session', 'counselling_month')),

  -- What earned it. Exactly one, enforced below.
  session_id uuid REFERENCES public.sessions(id) ON DELETE SET NULL,
  plan_id uuid REFERENCES public.admissions_plans(id) ON DELETE SET NULL,
  -- Which month, for counselling. Null for a session.
  period_start date,

  -- Resolved when the row is written, never derived on read. A course can be
  -- repriced, and working out an old lesson's worth from today's rate would
  -- restate what somebody was already owed for work already done.
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  currency text NOT NULL DEFAULT 'usd',

  -- The charge that funded it. Set as source_transaction on the Stripe
  -- transfer, so the transfer draws on that specific charge rather than the
  -- platform's general balance: without it a transfer fails whenever the
  -- balance has not settled, and there is nothing to reverse cleanly against.
  source_charge_id text,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,

  -- pending   owed, not yet moved
  -- settled   paid, by Stripe or by hand, and `reference` says how
  -- cancelled never became payable: refunded in time, disputed, or the lesson
  --           did not happen
  -- reversed  moved and then pulled back
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'settled', 'cancelled', 'reversed')),

  -- When the hold expires. Nothing may move before this. Null on a row an
  -- admin settles by hand, because a person deciding to pay has already made
  -- the judgement the hold exists to allow time for.
  releasable_at timestamptz,

  -- How it was settled. Every rail a US platform uses produces an identifier
  -- the recipient can look up in their own bank, which is what turns "we paid
  -- you" into something checkable. stripe_connect fills these in itself with
  -- the transfer id; the rest are an admin writing down what they did
  -- elsewhere, and the form does not let them claim a payment without one.
  --
  --   ach     15 digit trace number      check   cheque number
  --   zelle   confirmation code          wire    Fed reference, IMAD
  --   paypal, venmo   transaction id
  method text CHECK (method IS NULL OR method IN
    ('stripe_connect', 'ach', 'zelle', 'paypal', 'venmo', 'check', 'wire', 'other')),
  reference text,
  settled_at timestamptz,
  receipt_url text,

  -- Why it was cancelled, reversed, or held. Blank on the ordinary path.
  note text,
  -- Null when the scheduled job did it, which is the usual case.
  recorded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- A financial record that can vanish is not a record. A mistake is voided
  -- with a reason and the corrected row replaces it.
  voided_at timestamptz,
  voided_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  void_reason text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- A session earning or a counselling month, never both and never neither.
  CONSTRAINT earnings_one_source CHECK (
    (session_id IS NOT NULL AND plan_id IS NULL AND period_start IS NULL)
    OR
    (plan_id IS NOT NULL AND session_id IS NULL AND period_start IS NOT NULL)
  ),
  -- Claiming settlement without saying how is the state that makes a ledger
  -- unauditable, so it is refused rather than reported later.
  CONSTRAINT earnings_settled_has_receipt CHECK (
    status <> 'settled'
    OR (method IS NOT NULL AND settled_at IS NOT NULL
        AND reference IS NOT NULL AND length(btrim(reference)) > 0)
  )
);

-- Paying somebody twice is the expensive mistake here, so it is the one
-- guarded hardest. Stripe redelivers webhooks and the release job is expected
-- to run again after a failure, so both paths have to be safe to repeat. A
-- voided row must not block the corrected one that replaces it.
CREATE UNIQUE INDEX IF NOT EXISTS earnings_one_per_session
  ON public.earnings (session_id)
  WHERE session_id IS NOT NULL AND voided_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS earnings_one_per_plan_month
  ON public.earnings (plan_id, period_start)
  WHERE plan_id IS NOT NULL AND voided_at IS NULL;

CREATE INDEX IF NOT EXISTS earnings_payee_idx
  ON public.earnings (payee_id, status, created_at DESC);

-- The release job's only query: what is owed, and past its hold.
CREATE INDEX IF NOT EXISTS earnings_releasable_idx
  ON public.earnings (releasable_at)
  WHERE status = 'pending' AND voided_at IS NULL;

-- A dispute or refund has to find everything that charge funded.
CREATE INDEX IF NOT EXISTS earnings_source_charge_idx
  ON public.earnings (source_charge_id)
  WHERE source_charge_id IS NOT NULL;

COMMENT ON TABLE public.earnings IS
  'One row per amount owed to a tutor or counsellor, carrying both the obligation and how it was settled.';
COMMENT ON COLUMN public.earnings.releasable_at IS
  'End of the hold. Nothing moves before this, so a dispute or refund lands while the money is still ours.';
COMMENT ON COLUMN public.earnings.source_charge_id IS
  'The Stripe charge that funded this, used as source_transaction on the transfer.';

-- ------------------------------------------------------------
-- What somebody was paid in a calendar year
--
-- A US platform files a 1099-NEC for a contractor paid over the annual
-- threshold, so this has to be answerable without anybody adding it up. Only
-- settled, unvoided rows: an obligation is not a payment, and a voided one did
-- not happen.
-- ------------------------------------------------------------
DROP VIEW IF EXISTS public.tutor_payout_totals;

CREATE OR REPLACE VIEW public.earnings_year_totals
WITH (security_invoker = true) AS
  SELECT
    payee_id,
    extract(year FROM settled_at)::int AS tax_year,
    sum(amount_cents)::bigint AS total_cents,
    count(*)::int AS payout_count
  FROM public.earnings
  WHERE status = 'settled' AND voided_at IS NULL AND settled_at IS NOT NULL
  GROUP BY payee_id, extract(year FROM settled_at);

-- security_invoker so the view answers under the caller's own RLS rather than
-- the definer's. Without it this view would hand any signed-in user every
-- tutor's annual earnings, which is the one number colleagues most want to
-- compare and least should be able to.

-- ------------------------------------------------------------
-- Access
--
-- New tables arrive with anon and authenticated granted everything by the
-- project's default privileges, so the grant is revoked before any policy is
-- written. See supabase/migrations/20260805000100_testimonials.sql.
-- ------------------------------------------------------------
REVOKE ALL ON public.earnings FROM anon, authenticated;
GRANT SELECT ON public.earnings TO authenticated;

REVOKE ALL ON public.earnings_year_totals FROM anon, authenticated;
GRANT SELECT ON public.earnings_year_totals TO authenticated;

ALTER TABLE public.earnings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS earnings_own_select ON public.earnings;
DROP POLICY IF EXISTS earnings_admin_all ON public.earnings;

-- A payee reads their own and nobody else's.
CREATE POLICY earnings_own_select ON public.earnings
  FOR SELECT USING (payee_id = auth.uid());

-- Writes belong to the server, through the service role, which bypasses RLS.
-- This is for admins reading and correcting in the dashboard. There is
-- deliberately no policy letting a payee write: a tutor who can insert an
-- earning can pay themselves.
CREATE POLICY earnings_admin_all ON public.earnings
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ------------------------------------------------------------
-- Sessions: an amount, and a lifecycle
--
-- payout_cents was always the amount, not a state, and keeping the name next
-- to payout_status made them look like a pair. The amount stays, because it
-- was split from the invoice at purchase and must not be recomputed later from
-- a course that has since been repriced. The state moves to earnings.
-- ------------------------------------------------------------
ALTER TABLE public.sessions
  RENAME COLUMN payout_cents TO tutor_earning_cents;

COMMENT ON COLUMN public.sessions.tutor_earning_cents IS
  'What the tutor earns if this lesson is delivered, split from the invoice at purchase. An earnings row copies it on completion.';

ALTER TABLE public.sessions
  DROP CONSTRAINT IF EXISTS sessions_payout_status_check;

DROP INDEX IF EXISTS public.sessions_payout_status_idx;

ALTER TABLE public.sessions
  DROP COLUMN IF EXISTS payout_status,
  DROP COLUMN IF EXISTS payout_requested_at;

-- When the lesson was judged to have happened, and the evidence for it.
--
-- attendance is Zoom's participant record, stored as evidence rather than as
-- the gate. Zoom can say two people were in a room for 47 minutes; it cannot
-- say a lesson was taught, it reports no email for guests joining through the
-- Meeting SDK, and sessions.mode already allows in-person. The one signal it
-- gives with confidence is that nobody joined at all, and that alone is what
-- holds a session back for review.
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS attendance jsonb,
  ADD COLUMN IF NOT EXISTS attendance_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 'disputed' is a parent saying the lesson did not happen as billed. It stops
-- the release job without deciding who is right, which is a person's job.
ALTER TABLE public.sessions
  DROP CONSTRAINT IF EXISTS sessions_status_check;
ALTER TABLE public.sessions
  ADD CONSTRAINT sessions_status_check
  CHECK (status IN ('upcoming', 'completed', 'cancelled', 'no-show', 'disputed'));

-- The completion job's only query: lessons whose slot has passed and which
-- nobody has judged yet.
CREATE INDEX IF NOT EXISTS sessions_awaiting_completion_idx
  ON public.sessions (date, start_time)
  WHERE status = 'upcoming';

-- ------------------------------------------------------------
-- Which lessons have finished
--
-- Sessions store a naive date and a naive time, so "has this ended" is a
-- timezone question, and Postgres is the only participant that can answer it
-- exactly. Doing it in Node would mean parsing '2026-08-19T14:00' against
-- whatever zone the server happens to run in, which on Render is UTC and on a
-- developer's laptop is not, so the same row would be judged differently in the
-- two places.
--
-- SECURITY DEFINER because the caller is the scheduled job, and execute is
-- granted to nobody else: this returns every family's lessons.
-- ------------------------------------------------------------
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
     AND ((s.date + s.start_time) AT TIME ZONE p_timezone)
         + make_interval(mins => s.duration_minutes) < now()
   ORDER BY s.date, s.start_time
   LIMIT p_limit;
$$;

REVOKE ALL ON FUNCTION public.sessions_due_for_completion(text, int) FROM public, anon, authenticated;

-- ------------------------------------------------------------
-- Invoices: a purchase, not a payout queue
-- ------------------------------------------------------------
ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS invoices_payout_status_check;

ALTER TABLE public.invoices
  DROP COLUMN IF EXISTS payout_status;

ALTER TABLE public.invoices
  RENAME COLUMN payout_cents TO tutor_earning_cents;

COMMENT ON COLUMN public.invoices.tutor_earning_cents IS
  'The tutor''s share of this purchase, derived from the course at checkout and split across the sessions it bought.';

-- The charge, not just the payment intent.
--
-- A transfer's source_transaction has to name a charge, and a payment intent
-- is not one: it is the attempt, and the charge is the money. Resolving it at
-- release time would mean a Stripe call per earning, months after the fact, on
-- the one code path that must not fail for want of network.
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS stripe_charge_id text;

-- ------------------------------------------------------------
-- The tables this replaces
--
-- Dropped rather than left in place. Two ledgers disagreeing is worse than one
-- ledger being wrong, because only the second is noticed. There are no real
-- users yet, so nothing of value is lost.
-- ------------------------------------------------------------
DROP TABLE IF EXISTS public.tutor_payouts;

-- A tutor asking to be paid for their own lesson was a tutor authorising their
-- own payment: the function checked the session had passed and belonged to
-- them, which the tutor controls both of. Completion is now the scheduled
-- job's decision and the hold is what makes it safe, so there is nothing left
-- to request.
DROP FUNCTION IF EXISTS public.request_session_payment(uuid);
