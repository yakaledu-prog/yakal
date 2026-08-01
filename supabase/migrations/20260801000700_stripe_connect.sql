-- ============================================================
-- Paying tutors through Stripe Connect.
--
-- Separate charges and transfers, not destination charges: the parent's
-- payment stays exactly as it is, platform as merchant of record, and paying
-- a tutor becomes a transfer out of the platform balance whenever an admin
-- says so. Nothing about the existing checkout changes.
--
-- Connect does not replace the payout record. A tutor who has not finished
-- onboarding cannot receive a transfer, and onboarding is a real-world
-- rollout problem rather than a code one, so a manual payment stays possible
-- for as long as it takes. A transfer is simply another method with another
-- reference: tr_... instead of an ACH trace number.
-- ============================================================

ALTER TABLE public.profiles
  -- The tutor's connected account. Null until they start onboarding.
  ADD COLUMN IF NOT EXISTS stripe_account_id text,
  -- Stripe's answer to "can this account be paid yet", copied here from the
  -- account.updated webhook so the UI does not have to ask Stripe on render.
  ADD COLUMN IF NOT EXISTS stripe_payouts_enabled boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_stripe_account_idx
  ON public.profiles (stripe_account_id)
  WHERE stripe_account_id IS NOT NULL;

ALTER TABLE public.tutor_payouts DROP CONSTRAINT IF EXISTS tutor_payouts_method_check;
ALTER TABLE public.tutor_payouts ADD CONSTRAINT tutor_payouts_method_check
  CHECK (method IN ('stripe_connect', 'ach', 'zelle', 'paypal', 'venmo', 'check', 'wire', 'other'));
