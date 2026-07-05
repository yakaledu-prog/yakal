-- ============================================================
-- YAKAL, MIGRATION: add email to profiles
-- Run ONCE in Supabase SQL Editor (safe to run on the seeded DB).
--
-- Rationale: clients cannot read auth.users, but the app must look
-- up profiles BY email (parent links student by email; admin user
-- list). So we mirror auth.users.email into public.profiles and
-- keep it populated via the handle_new_user() trigger.
-- ============================================================

-- 1. Add the column (nullable; unique index allows multiple NULLs)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_key ON public.profiles(email);

-- 2. Backfill existing rows (the 5 demo accounts)
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE u.id = p.id AND p.email IS DISTINCT FROM u.email;

-- 3. Recreate the trigger function so NEW signups get email too
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_role text;
  v_status text;
BEGIN
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'student');
  IF v_role IN ('tutor', 'counselor') THEN
    v_status := 'pending';
  ELSE
    v_status := 'active';
  END IF;

  INSERT INTO public.profiles (id, email, full_name, role, status, avatar_url, is_onboarded)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    v_role,
    v_status,
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NULL),
    false
  );
  RETURN NEW;
END;
$$;

SELECT 'Migration complete: profiles.email added and backfilled.' AS status;
