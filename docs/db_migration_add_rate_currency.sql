-- ============================================================
-- YAKAL — MIGRATION: add rate_currency to profiles
-- Run ONCE in Supabase SQL Editor (safe on the seeded DB).
-- Lets tutors express their session rate in ETB or USD.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS rate_currency text NOT NULL DEFAULT 'ETB';

-- Constrain to supported currencies (guard against re-run).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_rate_currency_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_rate_currency_check
      CHECK (rate_currency IN ('ETB', 'USD'));
  END IF;
END $$;

SELECT 'Migration complete: profiles.rate_currency added.' AS status;
