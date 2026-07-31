-- ============================================================
-- Recreate the auth.users -> public.profiles trigger.
--
-- The baseline migration came from `supabase db dump`, which only covers the
-- public schema. public.handle_new_user() made it across but the trigger that
-- fires it lives on auth.users, so it did not. Without this a new signup
-- creates an auth user with no profile row, and the app treats the account as
-- half-broken: no role, no name, and every profile lookup returns nothing.
-- ============================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
