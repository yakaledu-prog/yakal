-- The team shown on the marketing page, readable by somebody who has not
-- signed up yet. That is the whole point of putting tutors there.
--
-- A view rather than a policy on profiles, and deliberately not
-- security_invoker: profiles carries email, phone and stripe_account_id
-- alongside the name, and opening that table to anon so a landing page can
-- draw four cards would expose every column on every row. The view names the
-- five fields a card actually draws and nothing else.
CREATE OR REPLACE VIEW public.v_public_tutors AS
SELECT
  p.id,
  p.full_name,
  p.avatar_url,
  p.bio,
  p.subjects
FROM public.profiles p
WHERE p.role = 'tutor'
  AND p.status = 'active'
  AND p.accepting_students
  AND coalesce(array_length(p.subjects, 1), 0) > 0
  -- A written bio is what separates a tutor from an account. Every card on the
  -- page carries a Read Full Bio button, and one that opens onto a blank space
  -- reads as broken. It also keeps test and half-finished accounts off the
  -- public site without an admin having to watch for them: a signup is not
  -- published until somebody has written about themselves.
  AND length(btrim(coalesce(p.bio, ''))) >= 80
-- Longest-standing first, so the order does not shuffle between visits.
ORDER BY p.created_at;

-- Read only, and the REVOKE is the load-bearing half.
--
-- This view is simple enough that Postgres makes it automatically updatable,
-- and Supabase grants anon and authenticated every privilege on anything new
-- in this schema by default. Left alone that turns a read-only marketing view
-- into a write path straight through to profiles that ignores row level
-- security entirely, because the view runs as its owner. An anonymous PATCH
-- against this view renamed a tutor before the REVOKE went in.
REVOKE ALL ON public.v_public_tutors FROM anon, authenticated;
GRANT SELECT ON public.v_public_tutors TO anon, authenticated;
