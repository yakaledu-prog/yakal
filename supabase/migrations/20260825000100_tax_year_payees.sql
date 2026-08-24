-- ============================================================
-- Who needs a 1099, and how much of it Stripe does not know about.
--
-- The obligation is Yakal's, not Stripe's. Stripe issues a 1099-K only when the
-- connected account pays the processing fees; ours are application_express, so
-- the platform pays them and the platform files. That means a 1099-NEC for
-- everybody over the IRS threshold, and somebody has to know who.
--
-- earnings_year_totals answers "what has this person been paid" for one person,
-- which is what a payee's own page needs. This is the other question: the whole
-- list, at once, in January, with the part Stripe cannot see broken out.
--
-- That split is the point. Stripe's tax product builds a form from what moved
-- through Stripe, and connect-transfer.ts deliberately supports ACH, Zelle and
-- cheque, because a tutor who never finishes onboarding still has to be paid.
-- Those dollars are just as reportable. Stripe's dashboard takes an edited
-- total for exactly this case, and outside_stripe_cents is the correction.
-- ============================================================

CREATE OR REPLACE VIEW public.v_tax_year_payees
WITH (security_invoker = true) AS
  SELECT
    e.payee_id,
    p.full_name,
    p.email,
    p.role,
    EXTRACT(year FROM e.settled_at)::integer AS tax_year,
    SUM(e.amount_cents)::bigint AS total_cents,
    -- What Stripe already has on its own records.
    COALESCE(SUM(e.amount_cents) FILTER (WHERE e.method = 'stripe_connect'), 0)::bigint
      AS via_stripe_cents,
    -- What it does not, and what a form therefore understates by.
    COALESCE(SUM(e.amount_cents) FILTER (WHERE e.method IS DISTINCT FROM 'stripe_connect'), 0)::bigint
      AS outside_stripe_cents,
    COUNT(*)::integer AS payment_count,
    MAX(e.settled_at) AS last_paid_at
    FROM public.earnings e
    JOIN public.profiles p ON p.id = e.payee_id
   WHERE e.status = 'settled'
     -- A correction is not a second payment. Counting both is how a total stops
     -- matching the money behind it, and this one goes to the IRS.
     AND e.voided_at IS NULL
     AND e.settled_at IS NOT NULL
   GROUP BY e.payee_id, p.full_name, p.email, p.role, EXTRACT(year FROM e.settled_at);

COMMENT ON VIEW public.v_tax_year_payees IS
  'Everybody paid in a calendar year, split by whether Stripe knows about it. The 1099 filing list.';

-- security_invoker, so this is the admin policy on earnings deciding, not the
-- view. A payee reading it sees only their own row, which is harmless and true.
GRANT SELECT ON public.v_tax_year_payees TO authenticated;
