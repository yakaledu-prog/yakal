-- What the parent paid for each instalment, beside what the counsellor earns.
--
-- counselor_payouts already holds one row per payment received on a plan, which
-- makes it the only per-month record of an engagement that exists: plans carry
-- payments_made as a counter, and the amounts themselves live in Stripe.
--
-- Without this, a month can say what the counsellor is owed but not what came
-- in to owe it from, so the two halves of the same payment cannot be read side
-- by side. Derived arithmetic will not do it either: a tier can be repriced, and
-- recomputing an old month from today's price would quietly restate history.
--
-- The table keeps its name. Its job is still the counsellor's money; this is
-- the payment that money came out of.
ALTER TABLE public.counselor_payouts
  ADD COLUMN IF NOT EXISTS paid_cents integer CHECK (paid_cents IS NULL OR paid_cents >= 0);

COMMENT ON COLUMN public.counselor_payouts.paid_cents IS
  'What the parent paid for this instalment, recorded when it arrived. Null on rows written before this column existed.';
