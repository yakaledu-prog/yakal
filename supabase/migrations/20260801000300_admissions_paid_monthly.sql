-- ============================================================
-- Counselling is a fixed-length engagement, paid monthly.
--
-- It is not a one-off: a family asked for the whole price up front mostly says
-- no. It is not an open-ended subscription either, and that one is worth
-- spelling out, because it is the failure that would have cost real money.
--
-- The work is front-loaded. The college list and the first essay rounds happen
-- in the opening weeks; the later months are interviews, waiting and
-- decisions. On a cancel-any-time plan a family can take the expensive part in
-- month one and stop paying in month two, and nothing in a product should be
-- asked to prevent that. A fixed number of instalments means the commitment is
-- the whole engagement, however it is collected.
--
-- So a tier now carries a total and a number of months. The monthly figure is
-- derived from those two rather than stored, because three numbers that must
-- agree is two too many.
-- ============================================================

ALTER TABLE public.admissions_tiers
  -- How many monthly instalments the price is collected in. 1 means a single
  -- payment, so a one-off tier is still expressible without a second concept.
  ADD COLUMN IF NOT EXISTS instalment_months smallint NOT NULL DEFAULT 1
    CHECK (instalment_months BETWEEN 1 AND 24);

COMMENT ON COLUMN public.admissions_tiers.price_cents IS
  'The whole engagement. What a family owes in total, however it is collected.';
COMMENT ON COLUMN public.admissions_tiers.instalment_months IS
  'Monthly instalments the total is split over. 1 is a single payment.';

ALTER TABLE public.admissions_plans
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  -- Instalments actually collected, so an admin can see where a family is
  -- without asking Stripe.
  ADD COLUMN IF NOT EXISTS payments_made smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payments_due smallint NOT NULL DEFAULT 1;

-- past_due is a state a person handles, not the product. A card expiring in
-- November must not lock a student out of their college list a fortnight
-- before a deadline, so nothing keys off this except an admin's queue.
ALTER TABLE public.admissions_plans DROP CONSTRAINT IF EXISTS admissions_plans_status_check;
ALTER TABLE public.admissions_plans ADD CONSTRAINT admissions_plans_status_check
  CHECK (status IN ('active', 'past_due', 'ended'));

-- One live plan per student, whether or not its payments are up to date.
DROP INDEX IF EXISTS admissions_plans_one_active;
CREATE UNIQUE INDEX IF NOT EXISTS admissions_plans_one_live
  ON public.admissions_plans (student_id)
  WHERE status IN ('active', 'past_due');

CREATE INDEX IF NOT EXISTS admissions_plans_subscription_idx
  ON public.admissions_plans (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

-- Ten months covers a cycle from the summer before senior year through to
-- regular decision results. Placeholders, like the prices.
UPDATE public.admissions_tiers SET instalment_months = 10 WHERE key IN ('essential', 'premier', 'elite');
