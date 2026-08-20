-- ============================================================
-- Two things a parent's billing page could not say truthfully.
--
-- First: an invoice was open or paid, and nothing else. An abandoned checkout
-- and a card that was declined looked identical, so the page offered a Pay
-- button on both and a parent had no way to tell which of the two had happened
-- to them. Only one of those is worth acting on.
--
-- Second: cancelling recorded that somebody left and never why. That is the one
-- question worth asking at that moment, and the answer is the only feedback a
-- small business gets from the people it is losing.
-- ============================================================

-- ------------------------------------------------------------
-- An invoice that failed, as distinct from one nobody finished
-- ------------------------------------------------------------
--
--   open    checkout is still live, or nobody has taken it there yet
--   failed  a card was declined. This is the one a parent can fix
--   paid    settled
--   void    abandoned, expired, or cancelled. Nothing to do
--
-- Kept as a status rather than a separate flag so a row is always in exactly
-- one of them, which is what lets the page decide what to show from one value.
ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS invoices_status_check;

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_status_check
  CHECK (status IN ('open', 'failed', 'paid', 'void'));

COMMENT ON COLUMN public.invoices.status IS
  'open: not paid yet. failed: a card was declined and the parent can retry. paid: settled. void: abandoned or cancelled.';

-- ------------------------------------------------------------
-- Why a family left
-- ------------------------------------------------------------
--
-- Free text and optional. A required reason turns cancelling into an
-- interrogation, and the answer somebody types to get past a mandatory field is
-- worth less than nothing.
ALTER TABLE public.admissions_plans
  ADD COLUMN IF NOT EXISTS cancel_reason text,
  -- When they asked, which is not when it takes effect. A family that cancels
  -- on the 3rd and runs to the 30th is a different story from one that leaves
  -- the day their period ends, and only this column can tell them apart.
  ADD COLUMN IF NOT EXISTS cancel_requested_at timestamptz;

COMMENT ON COLUMN public.admissions_plans.cancel_reason IS
  'Why the family cancelled, in their words. Optional: a required reason is an interrogation, and the answer given to escape a mandatory field is worth nothing.';
