-- Phase 6, second half: the private profile columns stop being readable by
-- other users. Ships only after 20260920000300 (full_profiles) and the code
-- that reads through it are live, or signing in breaks for everybody.
--
-- Revoke the table-wide SELECT, then grant it back one column at a time for
-- every column except these five. Computed from the catalogue rather than
-- listed, so this cannot fall out of step with the table as it is today. A
-- column added later is not selectable until a migration grants it, which is
-- the safe default for a table like this one.
--
--   phone                    somebody's number, a minor's included
--   stripe_account_id        a payee's Stripe account
--   stripe_payouts_enabled   whether they can be paid
--   resume_url               a CV, with an address and employment history
--   rejection_reason         why an applicant was turned down
--
-- The owner reads their own, and admins read everybody's, through
-- full_profiles(). The server uses the service role and is unaffected.

REVOKE SELECT ON public.profiles FROM anon, authenticated;

DO $$
DECLARE
  cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO cols
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'profiles'
     AND column_name NOT IN ('phone', 'stripe_account_id', 'stripe_payouts_enabled', 'resume_url', 'rejection_reason');
  EXECUTE format('GRANT SELECT (%s) ON public.profiles TO authenticated', cols);
END;
$$;
