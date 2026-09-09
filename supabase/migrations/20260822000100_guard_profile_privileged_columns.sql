-- ============================================================
-- A signed-in user could make themselves an admin.
--
-- "Users can update their own profile" is FOR UPDATE USING (auth.uid() = id)
-- with no WITH CHECK. Postgres reuses USING as the check when WITH CHECK is
-- absent, and id is the primary key, so the check passes for any row the caller
-- already owns no matter which other columns change. authenticated also holds
-- GRANT ALL on the table, so every column is writable. Nothing stopped:
--
--   PATCH /rest/v1/profiles?id=eq.<my-uid>  { "role": "admin" }
--
-- is_admin() reads profiles.role, so that one request unlocks every admin-only
-- policy in the system: all PII, all invoices and messages, user management,
-- refunds, payouts. The same gap let a suspended user set status back to
-- active, and a tutor set their own stripe_payouts_enabled / stripe_account_id
-- to be paid without ever onboarding.
--
-- RLS cannot easily compare a column against its previous value, so the guard
-- is a BEFORE UPDATE trigger. It pins the privileged columns: only an admin, or
-- the service role (the Stripe webhook and the Connect handlers, which write
-- these legitimately and bypass RLS but still fire triggers), may change them.
-- ============================================================

CREATE OR REPLACE FUNCTION public.guard_profile_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- The role from the request's verified JWT, set by PostgREST from the key's
  -- signature. A user holding the anon or authenticated key cannot forge this
  -- to 'service_role'. Read from the request setting rather than current_user,
  -- because this function is SECURITY DEFINER and current_user would be its
  -- owner, not the caller. The setting can be unset (a migration running as
  -- postgres), hence the empty-string guard before the ::jsonb cast.
  claims   text := current_setting('request.jwt.claims', true);
  jwt_role text := '';
BEGIN
  IF claims IS NOT NULL AND claims <> '' THEN
    jwt_role := coalesce(claims::jsonb ->> 'role', '');
  END IF;

  -- The webhook and the Connect handlers use the service-role key and are the
  -- only writers of the stripe_* columns. Let them through untouched.
  IF jwt_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- An admin changes roles, statuses and payout flags from the admin UI, on the
  -- ordinary authenticated key, so this has to run after the service-role check.
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'role can only be changed by an admin';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'status can only be changed by an admin';
  END IF;
  IF NEW.stripe_account_id IS DISTINCT FROM OLD.stripe_account_id THEN
    RAISE EXCEPTION 'stripe_account_id is set by Stripe onboarding, not by hand';
  END IF;
  IF NEW.stripe_payouts_enabled IS DISTINCT FROM OLD.stripe_payouts_enabled THEN
    RAISE EXCEPTION 'stripe_payouts_enabled is set by Stripe, not by hand';
  END IF;

  RETURN NEW;
END;
$$;

-- Runs before set_updated_at and before trg_sync_auth_ban; a blocked change
-- never reaches either. Named so it re-runs cleanly against a restored dump.
DROP TRIGGER IF EXISTS guard_profile_privileged_columns ON public.profiles;
CREATE TRIGGER guard_profile_privileged_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_privileged_columns();
