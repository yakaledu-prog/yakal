-- What a counsellor earns from a tier, and the record of each amount owed.
--
-- Counsellors are currently paid nothing, structurally. A tier purchase writes
-- an invoice with no tutor_id and no payout_cents, so the payout rail that
-- carries a tutor's session money has nothing on it for the admissions side.
--
-- Two pieces: the policy, and the ledger.

-- ---------------------------------------------------------------------------
-- 1. The policy: a share of the tier price
-- ---------------------------------------------------------------------------
--
-- A percentage rather than an amount, because the price is already on this
-- row. A fixed payout is a second number that has to be remembered every time
-- a tier is repriced, and the day somebody forgets, the platform quietly keeps
-- the difference. A percentage cannot drift out of step with the price.
--
-- Null means nobody has decided yet, which is different from zero. The admin
-- page can then say so rather than showing a confident 0% that nobody chose.
ALTER TABLE public.admissions_tiers
  ADD COLUMN IF NOT EXISTS counselor_share_percent numeric(5,2)
    CHECK (counselor_share_percent IS NULL
           OR (counselor_share_percent >= 0 AND counselor_share_percent <= 100));

COMMENT ON COLUMN public.admissions_tiers.counselor_share_percent IS
  'Percent of this tier''s price paid to the counsellor. Null means unset, which is not the same as zero.';

-- ---------------------------------------------------------------------------
-- 2. The ledger: one row per amount actually owed
-- ---------------------------------------------------------------------------
--
-- Its own table rather than invoices.payout_cents, which is where a tutor's
-- money lives, because the shapes genuinely differ. An instalment plan takes
-- one payment a month and does NOT create an invoice row per month: the
-- webhook only increments admissions_plans.payments_made. So there is no
-- monthly invoice to attach a monthly payout to, and hanging the whole
-- engagement's share on the single invoice would pay a counsellor a year up
-- front for money the platform has not collected yet.
--
-- One row per payment received. A one-off tier makes one; a ten month plan
-- makes ten, as each arrives.
--
-- amount_cents is resolved when the row is written, not derived on read.
-- Changing a tier's percentage later must not silently rewrite what somebody
-- was already owed for work they have already done.
CREATE TABLE IF NOT EXISTS public.counselor_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.admissions_plans(id) ON DELETE CASCADE,
  counselor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  -- Which payment this is for: 1 for a one-off, 1..n across instalments.
  instalment_number smallint NOT NULL DEFAULT 1,
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  -- The percentage used, kept so an old row explains itself without anybody
  -- having to know what the tier charged last year.
  share_percent numeric(5,2),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'held')),
  paid_at timestamptz,
  -- Why an admin held it. Blank on the ordinary path.
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- A payment is owed once. A repeated webhook delivery, which Stripe does make,
-- must not pay somebody twice for the same instalment.
CREATE UNIQUE INDEX IF NOT EXISTS counselor_payouts_one_per_instalment
  ON public.counselor_payouts (plan_id, instalment_number);

CREATE INDEX IF NOT EXISTS counselor_payouts_counselor_idx
  ON public.counselor_payouts (counselor_id, status);

-- ---------------------------------------------------------------------------
-- 3. Access
-- ---------------------------------------------------------------------------
--
-- New tables arrive with anon and authenticated granted everything by the
-- project's default privileges, so the grant is revoked before any policy is
-- written. See supabase/migrations/20260805000100_testimonials.sql.
REVOKE ALL ON public.counselor_payouts FROM anon, authenticated;
GRANT SELECT ON public.counselor_payouts TO authenticated;

ALTER TABLE public.counselor_payouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS counselor_payouts_own_select ON public.counselor_payouts;
DROP POLICY IF EXISTS counselor_payouts_admin_all ON public.counselor_payouts;

-- A counsellor reads their own money and nobody else's. Earnings are the one
-- thing colleagues most want to compare and least should be able to.
CREATE POLICY counselor_payouts_own_select ON public.counselor_payouts
  FOR SELECT USING (counselor_id = auth.uid());

-- Writes are the server's, through the service role, which bypasses RLS. This
-- policy is for admins reading and adjusting in the dashboard.
CREATE POLICY counselor_payouts_admin_all ON public.counselor_payouts
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
