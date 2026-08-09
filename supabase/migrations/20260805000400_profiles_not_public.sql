-- profiles stops being readable by the whole internet.
--
-- The policy was "Users can view all profiles", SELECT, TO public, USING
-- (true). `public` in a policy includes `anon`, and the anon key ships inside
-- the browser bundle, so anybody who opened devtools on the marketing site
-- could read every row: full_name, email, phone, stripe_account_id, for every
-- student, parent, tutor and admin in the system. No account needed.
--
-- The fix here is deliberately the smallest one that closes that, rather than
-- the correct end state. SELECT is restricted to `authenticated`, so every
-- signed-in screen behaves exactly as it did and nothing needs rewriting,
-- while the unauthenticated hole is gone.
--
-- What it does NOT do is stop one signed-in user reading another's row. That
-- is a real issue and it is the next one to fix, but it needs the readers
-- scoped person by person (your tutors, your students, your children's
-- tutors, whoever you share a conversation with) and touching ten services at
-- once is how you end up reverting the security fix on a Friday. It stays on
-- the checklist as its own item.
--
-- The marketing site is unaffected. Team.tsx reads v_public_tutors, which is
-- not security_invoker and therefore runs as its owner, so RLS on the base
-- table does not apply to it. That view names five columns and was created for
-- exactly this reason.

DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Dropped by its own name too, not just the old one. Without this the
-- migration cannot be re-run against a database that already has it, which
-- is any database restored from a dump taken after this shipped, and it fails
-- halfway leaving everything after it unapplied.
DROP POLICY IF EXISTS "Signed-in users can view profiles" ON public.profiles;

CREATE POLICY "Signed-in users can view profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (true);

-- The update policies were also TO public. auth.uid() is null for anon so
-- neither could ever have matched, but stating the role makes the intent
-- readable instead of leaving it to be inferred.
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admin can update any profile" ON public.profiles;
CREATE POLICY "Admin can update any profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.is_admin());

-- Supabase's default privileges grant anon ALL on tables in public. RLS is
-- what actually refuses the read, but leaving the grant means a policy added
-- carelessly later is the only thing standing in the way.
REVOKE ALL ON public.profiles FROM anon;
