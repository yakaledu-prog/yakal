-- ============================================================
-- YAKAL - Tutor payouts (Stripe Connect deferred)
-- Run any time (idempotent). Tracks what the platform owes a tutor
-- once a parent has paid. Admin marks payouts paid after settling
-- off-platform (bank transfer). Tutors never see these rows (they
-- contain the parent price); admin-only via invoices_admin_all.
-- ============================================================

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS tutor_id      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payout_cents  integer,
  ADD COLUMN IF NOT EXISTS payout_status text NOT NULL DEFAULT 'none';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_payout_status_check') THEN
    ALTER TABLE public.invoices
      ADD CONSTRAINT invoices_payout_status_check
      CHECK (payout_status IN ('none', 'pending', 'paid'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS invoices_payout_status_idx ON public.invoices(payout_status);

SELECT 'Tutor payout columns ready.' AS status;
