-- ============================================================
-- Counselling becomes a subscription, not an instalment plan.
--
-- It was modelled as a fixed engagement collected over N months: a total price,
-- a month count, and a cancel_at set on the way back from Stripe so the
-- subscription stopped by itself. Everything a family might reasonably want to
-- do with it had to be hand built, and none of it was. There is no way to
-- cancel, no way to change tier, and months two onward produce no invoice row,
-- so a parent's billing page goes quiet after the first payment.
--
-- As an open-ended monthly subscription, Stripe Billing answers all of it
-- natively. Upgrading is a price swap with proration. Downgrading is a
-- subscription schedule that switches at period end. Cancelling is
-- cancel_at_period_end, which means access to the end of the month already paid
-- for and nothing to refund or claw back from a counsellor.
--
-- price_cents changes meaning: it is now what a family pays each month, not
-- what the whole engagement costs. Existing rows are converted rather than
-- reinterpreted, so a tier that read 2500 over 10 months now reads 250.
--
-- Quotas are deliberately NOT changed. ps_rounds_limit and its siblings were
-- written for a whole engagement (3 rounds, 5 supplemental essays), and calling
-- them monthly allowances would multiply what every tier promises by ten.
-- sessions_per_month was already monthly and already named so. Two kinds of
-- limit, because they genuinely are two kinds of thing.
-- ============================================================

-- ------------------------------------------------------------
-- What a tier costs, per month
-- ------------------------------------------------------------

-- Converted before the column it depends on is dropped. Rounded up, so a tier
-- never quietly collects less over a year than it used to over its term.
UPDATE public.admissions_tiers
   SET price_cents = ceil(price_cents::numeric / greatest(instalment_months, 1))::integer
 WHERE instalment_months > 1;

ALTER TABLE public.admissions_tiers
  DROP COLUMN IF EXISTS instalment_months;

COMMENT ON COLUMN public.admissions_tiers.price_cents IS
  'What a family pays each month while subscribed. Not a total: the engagement has no fixed length.';

-- The Stripe Price this tier bills against.
--
-- A real Price created once, rather than the throwaway inline price_data the
-- checkout used to build per session. Changing tier is then a swap of one id
-- for another on the subscription, which is what lets Stripe work out the
-- proration on an upgrade and schedule a downgrade for the period end.
--
-- Stripe will not let a Price's amount be edited, so repricing a tier creates a
-- new one. Families already subscribed stay on the old Price until they change
-- tier, which is the correct behaviour and worth saying out loud in the admin
-- form rather than discovering.
ALTER TABLE public.admissions_tiers
  ADD COLUMN IF NOT EXISTS stripe_price_id text;

COMMENT ON COLUMN public.admissions_tiers.stripe_price_id IS
  'The Stripe Price this tier bills against. Null until first created; repricing makes a new one.';

-- ------------------------------------------------------------
-- What a family is subscribed to
-- ------------------------------------------------------------

ALTER TABLE public.admissions_plans
  -- When the month they have paid for runs out. Everything a parent is shown
  -- about cancelling and downgrading is phrased against this date.
  ADD COLUMN IF NOT EXISTS current_period_end timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false,
  -- A downgrade that has not happened yet. Stripe holds the schedule; this is
  -- what the parent's billing page reads to say "changes to Essential on the
  -- 1st" without asking Stripe on every render.
  ADD COLUMN IF NOT EXISTS pending_tier_id uuid REFERENCES public.admissions_tiers(id),
  ADD COLUMN IF NOT EXISTS stripe_schedule_id text;

-- payments_made and payments_due counted toward a fixed term that no longer
-- exists. What a family has paid is the sum of their invoices, which is a fact
-- rather than a counter that can drift out of step with one.
ALTER TABLE public.admissions_plans
  DROP COLUMN IF EXISTS payments_made,
  DROP COLUMN IF EXISTS payments_due;

-- 'ended' meant the term ran out. Nothing runs out now: a subscription is
-- either live, behind on payment, or cancelled.
--
-- The old constraint comes off first. Rewriting the rows while it still allows
-- only the old spelling fails on the first row it touches.
ALTER TABLE public.admissions_plans
  DROP CONSTRAINT IF EXISTS admissions_plans_status_check;

UPDATE public.admissions_plans SET status = 'canceled' WHERE status = 'ended';

ALTER TABLE public.admissions_plans
  ADD CONSTRAINT admissions_plans_status_check
  CHECK (status IN ('active', 'past_due', 'canceled'));

-- admissions_plans_one_live already covers ('active', 'past_due') from
-- 20260801000300, so the rename of 'ended' to 'canceled' needs nothing here:
-- neither spelling was ever in that predicate.

-- ------------------------------------------------------------
-- Counsellor pay joins the same ledger as everybody else
--
-- counselor_payouts recorded what a counsellor was owed and nothing ever paid
-- it: status never left 'pending' because no code moved it. earnings already
-- carries tutor money, with a hold, a settlement and an annual total, and there
-- was never a reason for a second table beyond the instalment model this
-- migration removes.
-- ------------------------------------------------------------

INSERT INTO public.earnings (
  payee_id, kind, plan_id, period_start, amount_cents, currency,
  status, releasable_at, note, created_at
)
SELECT
  cp.counselor_id,
  'counselling_month',
  cp.plan_id,
  -- One row per month, so the month it belongs to is the month it was written.
  date_trunc('month', cp.created_at)::date,
  cp.amount_cents,
  'usd',
  'pending',
  cp.created_at + interval '72 hours',
  cp.note,
  cp.created_at
FROM public.counselor_payouts cp
WHERE cp.status = 'pending'
  AND cp.counselor_id IS NOT NULL
  AND cp.plan_id IS NOT NULL
ON CONFLICT DO NOTHING;

DROP TABLE IF EXISTS public.counselor_payouts;

-- ------------------------------------------------------------
-- One invoice row per month, keyed on Stripe's own invoice
--
-- Under the instalment model only the first payment produced an invoice row,
-- because months two onward were a counter rather than a record. A family
-- paying for ten months saw one line on their billing page and no evidence the
-- other nine happened.
--
-- Every paid Stripe invoice now writes one, and the unique key is Stripe's id
-- so a redelivered webhook updates the row it already wrote instead of adding
-- a second.
--
-- A plain constraint rather than a partial index. Postgres treats nulls as
-- distinct in a unique index, so the thousands of course purchases that have no
-- Stripe invoice coexist without a predicate; and ON CONFLICT cannot infer a
-- partial index anyway, which is what the upsert this exists for needs.
-- ------------------------------------------------------------
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS stripe_invoice_id text;

ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS invoices_stripe_invoice_id_key;
ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_stripe_invoice_id_key UNIQUE (stripe_invoice_id);

-- ------------------------------------------------------------
-- An earning outlives the thing that earned it
--
-- earnings_one_source required exactly one of session_id and plan_id, and both
-- columns are ON DELETE SET NULL. Those two rules contradict each other:
-- deleting a plan nulls plan_id on its earnings, the check then refuses the
-- update, and the delete fails. In practice that made a plan with any payment
-- history undeletable, and a student with one uncascadable.
--
-- SET NULL is the right behaviour and the check was the wrong shape. An earning
-- is a financial record: somebody was owed money and possibly paid it, and that
-- stays true after the lesson row is gone. What must never happen is a row
-- claiming to be one kind of earning while pointing at the other kind of
-- source, and that is what this enforces instead.
--
-- "Exactly one at the moment it is written" is enforced by the two functions
-- that write them, each of which sets one and only one.
ALTER TABLE public.earnings
  DROP CONSTRAINT IF EXISTS earnings_one_source;

ALTER TABLE public.earnings
  ADD CONSTRAINT earnings_source_matches_kind CHECK (
    (kind = 'tutoring_session' AND plan_id IS NULL AND period_start IS NULL)
    OR
    (kind = 'counselling_month' AND session_id IS NULL AND period_start IS NOT NULL)
  );

-- ------------------------------------------------------------
-- A late payment does not lock a student out
--
-- v_student_entitlements counted only status = 'active', so the moment a card
-- failed and the plan went past_due, the student lost their college list. The
-- webhook that sets past_due says in as many words that it revokes nothing and
-- that a card expiring in November must not lock somebody out a fortnight
-- before a deadline. It was right about the intent and wrong about the effect:
-- nothing in that path revoked access, the view simply stopped granting it.
--
-- past_due means somebody has to ring the parent, not that the work stops.
-- Stripe retries on its own schedule, and a family whose card bounced still has
-- deadlines. Cancelled is the status that ends access, and it only arrives when
-- the period they paid for has actually run out.
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_student_entitlements AS
  SELECT DISTINCT e.student_id, 'tutoring'::text AS service
    FROM public.enrolments e
   WHERE e.status = 'active'
  UNION
  SELECT DISTINCT p.student_id, 'admissions'::text AS service
    FROM public.admissions_plans p
   WHERE p.status IN ('active', 'past_due');
