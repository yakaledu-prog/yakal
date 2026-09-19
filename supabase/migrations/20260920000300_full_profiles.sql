-- Phase 6, first half: a way to read the private profile columns that does
-- not depend on being able to select them.
--
-- phone, stripe_account_id, stripe_payouts_enabled, resume_url and
-- rejection_reason are readable today by every signed-in user, for every
-- profile. The second half of this phase revokes SELECT on those five columns
-- from authenticated. Before that can ship, everything that legitimately reads
-- them has to stop reading them from the table, or it breaks the moment the
-- revoke lands: this function is where they read from instead, and this half
-- ships first so the code that uses it is live before the columns close.
--
-- Your own row, or every row if you are an admin. A function rather than a
-- view: a plain view over profiles runs as its owner and is auto-updatable,
-- so a user could write through it, their role included.
--
-- It returns the table's own row type, so PostgREST filters, orders and picks
-- columns on it exactly as on the table:
--   supabase.rpc('full_profiles').select('id, phone').eq('role', 'tutor')

CREATE OR REPLACE FUNCTION public.full_profiles()
RETURNS SETOF public.profiles
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.profiles
  WHERE id = auth.uid() OR public.is_admin();
$$;

REVOKE ALL ON FUNCTION public.full_profiles() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.full_profiles() TO authenticated;
