-- ============================================================
-- The price on a plan card was not the price Stripe charges.
--
-- A Stripe subscription item points at the Price object it was created with,
-- and keeps billing that for ever. That is correct and is what any platform
-- does: an existing customer is not repriced because a list price moved.
--
-- The plan card read admissions_tiers.price_cents instead, which is the list
-- price today. So after an admin moved Premier from $250 to $280 the family's
-- own billing page said "$280.00 a month" while Stripe went on taking $250.
-- Lowering a price is the worse direction, because then the app promises less
-- than the card is charged and the family finds out from their bank.
--
-- Synced from the subscription beside current_period_end, which already comes
-- from the same place for the same reason. Null means no subscription has been
-- seen yet, and the tier price is the honest fallback for a plan nobody has
-- been billed for.
-- ============================================================

ALTER TABLE public.admissions_plans
  ADD COLUMN IF NOT EXISTS billed_amount_cents integer;

COMMENT ON COLUMN public.admissions_plans.billed_amount_cents IS
  'What Stripe actually bills this subscription each period, synced from the '
  'subscription item. Null until a subscription has been seen; the tier price '
  'stands in until then. Never read the tier price for a live subscription.';
