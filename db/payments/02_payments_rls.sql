-- ============================================================
-- YAKAL — RLS for payments / billing
-- Run AFTER 01_payments_schema.sql. Idempotent (drop-if-exists).
--
-- Invoices & customer records are written server-side only
-- (Checkout fn / webhook via the service-role key, which bypasses
-- RLS). Clients only ever READ their own rows. Tutors get NO
-- policy at all → they cannot read billing data.
-- ============================================================

ALTER TABLE public.billing_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices          ENABLE ROW LEVEL SECURITY;

-- Parent reads their own invoices
DROP POLICY IF EXISTS invoices_parent_select ON public.invoices;
CREATE POLICY invoices_parent_select ON public.invoices FOR SELECT
  USING (auth.uid() = parent_id);

-- Admin reads all invoices (for the future admin console)
DROP POLICY IF EXISTS invoices_admin_all ON public.invoices;
CREATE POLICY invoices_admin_all ON public.invoices FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Parent reads their own Stripe customer mapping
DROP POLICY IF EXISTS billing_customers_self_select ON public.billing_customers;
CREATE POLICY billing_customers_self_select ON public.billing_customers FOR SELECT
  USING (auth.uid() = profile_id);

-- (No INSERT/UPDATE policies for clients: those paths run with the
--  service-role key from the serverless functions and bypass RLS.)

SELECT 'Payments RLS applied.' AS status;
