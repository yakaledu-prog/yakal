-- ============================================================
-- A soft-deleted or suspended account must not be able to sign in.
--
-- Deleting a user on the admin Users page is a soft delete: it sets
-- profiles.status = 'deleted' and keeps the row so sessions, invoices and
-- messages still resolve to a person (see 20260802000300). But it never
-- touched the auth account, so the credentials still worked: a deleted user
-- whose browser had saved their password could sign straight back in. And
-- because RLS keys off auth.uid() and relationships rather than status, that
-- token still read and wrote their own data, not just showed a stale screen.
--
-- The fix bans the auth account whenever the profile is not usable and lifts
-- the ban when it becomes active again. GoTrue refuses a banned user with
-- "User is banned", so the existing client-side soft-delete keeps working and
-- simply cannot be signed into. Existing sessions are dropped in the same
-- breath, so a token minted before the delete stops refreshing.
--
-- 'deleted' and 'suspended' are the two admin-imposed "cannot use the
-- platform" states. 'pending' and 'rejected' are left alone: those users are
-- meant to sign in and land on the pending-approval screen.
-- ============================================================

-- SECURITY DEFINER so the trigger can write auth.* regardless of who ran the
-- profiles update (the admin, through RLS). Owned by the migration role, which
-- has rights on the auth schema. search_path is emptied, so every name is
-- schema-qualified and cannot be shadowed by a caller's search_path.
CREATE OR REPLACE FUNCTION public.sync_auth_ban_from_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status IN ('deleted', 'suspended') THEN
    -- Far future rather than 'infinity': a concrete timestamp is what GoTrue
    -- compares against now(), and it is the value proven to block sign-in.
    UPDATE auth.users
      SET banned_until = now() + interval '100 years'
      WHERE id = NEW.id;
    -- Stop a token minted before the delete from refreshing. Access tokens
    -- already issued stay valid until they expire; the client-side guard in
    -- AuthContext covers that window by signing the session out on sight.
    DELETE FROM auth.sessions WHERE user_id = NEW.id;
  ELSIF NEW.status = 'active' THEN
    UPDATE auth.users
      SET banned_until = NULL
      WHERE id = NEW.id AND banned_until IS NOT NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_auth_ban ON public.profiles;
CREATE TRIGGER trg_sync_auth_ban
  AFTER INSERT OR UPDATE OF status ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_auth_ban_from_status();

-- Bring existing rows into line: any account already soft-deleted or suspended
-- before this migration gets banned now.
UPDATE auth.users u
  SET banned_until = now() + interval '100 years'
  FROM public.profiles p
  WHERE p.id = u.id
    AND p.status IN ('deleted', 'suspended')
    AND (u.banned_until IS NULL OR u.banned_until <= now());
