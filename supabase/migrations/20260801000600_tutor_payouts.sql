-- ============================================================
-- Paying a tutor leaves a receipt.
--
-- Until now an admin clicked a button and one column changed from pending to
-- paid. Nothing recorded how the money moved, when, or who said so, and the
-- tutor could not see any of it: they had to take the platform's word that
-- they had been paid. That is not a payout, it is an assertion.
--
-- Stripe Connect is the eventual answer, and it is available to a US entity.
-- It is not this, because a manual payout never fully goes away, because
-- Connect also changes how the original charge is split, and because a record
-- of what was paid is needed either way. This is the part that is needed
-- regardless.
--
-- Method and reference are both required. Every rail a US platform actually
-- uses produces an identifier the recipient can look up:
--
--   ach     15 digit trace number
--   zelle   confirmation code
--   paypal  transaction id
--   venmo   transaction id
--   check   cheque number
--   wire    Fed reference, IMAD
--
-- An admin who cannot produce one has not paid anybody, so the form does not
-- let them say they have.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.tutor_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  currency text NOT NULL DEFAULT 'usd',

  method text NOT NULL CHECK (method IN ('ach', 'zelle', 'paypal', 'venmo', 'check', 'wire', 'other')),
  -- The identifier the tutor can quote to their own bank. Free text because
  -- every rail formats its own differently.
  reference text NOT NULL CHECK (length(btrim(reference)) > 0),
  -- When the money actually left, which is not always the day somebody got
  -- round to recording it.
  paid_on date NOT NULL DEFAULT current_date,
  receipt_url text,
  note text,

  recorded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  -- A payout is a financial record. Getting one wrong is voided with a reason,
  -- never deleted, so the trail survives the mistake.
  voided_at timestamptz,
  voided_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  void_reason text,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tutor_payouts_tutor_idx
  ON public.tutor_payouts (tutor_id, paid_on DESC);

-- One live payout per invoice. Paying the same session twice is the mistake
-- this is here to make impossible, and a voided row must not block the
-- corrected one that replaces it.
CREATE UNIQUE INDEX IF NOT EXISTS tutor_payouts_one_per_invoice
  ON public.tutor_payouts (invoice_id)
  WHERE invoice_id IS NOT NULL AND voided_at IS NULL;

ALTER TABLE public.tutor_payouts ENABLE ROW LEVEL SECURITY;

-- A tutor sees their own, which is the entire point: the receipt is for them.
DROP POLICY IF EXISTS tutor_payouts_read ON public.tutor_payouts;
CREATE POLICY tutor_payouts_read ON public.tutor_payouts
  FOR SELECT TO authenticated
  USING (auth.uid() = tutor_id OR public.is_admin());

-- Only an admin records or voids one, and only as themselves.
DROP POLICY IF EXISTS tutor_payouts_admin_write ON public.tutor_payouts;
CREATE POLICY tutor_payouts_admin_write ON public.tutor_payouts
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() AND recorded_by = auth.uid());

DROP POLICY IF EXISTS tutor_payouts_admin_void ON public.tutor_payouts;
CREATE POLICY tutor_payouts_admin_void ON public.tutor_payouts
  FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- A tutor is told they have been paid, rather than finding out by checking.
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type = ANY (ARRAY[
    'booking', 'assignment', 'approval', 'message', 'system', 'parent_link',
    'application', 'unlock_request', 'course_application',
    'course_application_decided', 'enrolment',
    'admissions_plan', 'essay_review', 'payout'
  ]));

-- ------------------------------------------------------------
-- What a tutor has been paid in a calendar year.
--
-- A US platform files a 1099-NEC for any contractor paid over the annual
-- threshold, so this number has to be answerable without adding rows by hand.
-- Voided payouts are excluded, because they did not happen.
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW public.tutor_payout_totals AS
  SELECT
    tutor_id,
    extract(year FROM paid_on)::int AS tax_year,
    sum(amount_cents)::bigint AS total_cents,
    count(*)::int AS payout_count
  FROM public.tutor_payouts
  WHERE voided_at IS NULL
  GROUP BY tutor_id, extract(year FROM paid_on);
