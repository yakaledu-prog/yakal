-- ============================================================
-- YAKAL - Payments / Billing schema (Stripe)
-- Run ONCE in the Supabase SQL Editor. Idempotent, safe to re-run.
-- Choose "Run and enable RLS" when prompted; policies come in 02.
-- ============================================================

-- -- Maps a parent (profile) to their Stripe Customer --------
CREATE TABLE IF NOT EXISTS public.billing_customers (
  profile_id         uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  stripe_customer_id text NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- -- Invoices the parent owes / has paid ---------------------
CREATE TABLE IF NOT EXISTS public.invoices (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id                   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  student_id                  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  description                 text NOT NULL,
  amount_cents                integer NOT NULL CHECK (amount_cents >= 0),
  currency                    text NOT NULL DEFAULT 'usd',
  kind                        text NOT NULL DEFAULT 'tutoring'
                              CHECK (kind IN ('tutoring', 'admissions', 'registration', 'other')),
  status                      text NOT NULL DEFAULT 'open'
                              CHECK (status IN ('open', 'paid', 'void')),
  due_date                    date,
  paid_at                     timestamptz,
  stripe_checkout_session_id  text,
  stripe_payment_intent_id    text,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS invoices_parent_idx ON public.invoices(parent_id);
CREATE INDEX IF NOT EXISTS invoices_status_idx ON public.invoices(status);

-- -- Parent-facing course price (the margin) -----------------
-- Separate from profiles.hourly_rate (what the tutor is paid).
-- Tutors must never see this column.
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS price_cents integer;

-- -- updated_at triggers (reuse existing public.set_updated_at) --
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['billing_customers', 'invoices'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_updated_at ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER %I_updated_at BEFORE UPDATE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t, t);
  END LOOP;
END $$;

SELECT 'Payments schema ready.' AS status;
