-- ============================================================
-- Somebody is owed money and cannot be paid, and nobody was told.
--
-- releaseDueEarnings has four reasons for skipping an earning. Only one of
-- them, 'nothing delivered', reaches a person: it latches on
-- delivery_flagged_at and tells an admin once. The other two are silent.
--
--   no connected account        the payee never finished Stripe onboarding, so
--                               the money sits pending for ever. They are the
--                               only one who can fix it and they do not know.
--   platform balance not settled  Yakal's own balance is short. Payouts stall
--                               quietly and the first sign is a tutor asking.
--
-- The only evidence either had was a count in the JSON the cron job returns,
-- which nobody reads. The job runs hourly, so saying it every run would be two
-- dozen messages a day; this column is the same latch delivery_flagged_at
-- already uses, so it is said once and again only if the reason changes.
-- ============================================================

ALTER TABLE public.earnings
  ADD COLUMN IF NOT EXISTS payout_blocked_notified_at timestamptz;

COMMENT ON COLUMN public.earnings.payout_blocked_notified_at IS
  'When the payee was last told this earning cannot be transferred. Null means '
  'they have not been told. Cleared when the earning settles, so a payee who '
  'connects a bank and is later blocked again hears about it again.';
