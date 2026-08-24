-- ============================================================
-- Telling somebody once, without borrowing a field that means something else.
--
-- When the release job refuses a counselling month because nothing was
-- delivered, an admin is told once rather than every hour. That "once" was
-- latched on `note` being empty, which is wrong: note is the human field. An
-- admin who had written anything on the row, or a cancellation that recorded
-- its reason there, silently suppressed the alert. The month then sat unpaid
-- and nobody was ever told why.
--
-- Found by building the test scenarios, where every row carries a tag in note.
-- ============================================================

ALTER TABLE public.earnings
  ADD COLUMN IF NOT EXISTS delivery_flagged_at timestamptz;

COMMENT ON COLUMN public.earnings.delivery_flagged_at IS
  'When somebody was told this month had no delivered work. A latch, so an hourly job says it once.';
