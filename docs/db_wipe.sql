-- ============================================================
-- YAKAL — DATABASE WIPE SCRIPT
-- Run this FIRST in Supabase SQL Editor.
-- WARNING: This deletes ALL data and ALL tables permanently.
-- ============================================================

-- Step 1: Drop all application tables (cascade removes foreign key deps)
DROP TABLE IF EXISTS public.college_guide_applications CASCADE;
DROP TABLE IF EXISTS public.parent_student_links CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.conversations CASCADE;
DROP TABLE IF EXISTS public.submissions CASCADE;
DROP TABLE IF EXISTS public.assignments CASCADE;
DROP TABLE IF EXISTS public.sessions CASCADE;
DROP TABLE IF EXISTS public.tutor_availability CASCADE;
DROP TABLE IF EXISTS public.courses CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Step 2: Drop triggers and functions
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.set_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;
DROP FUNCTION IF EXISTS public.is_counselor() CASCADE;

-- Step 3: Delete all demo and test users from auth.users
-- (This will also cascade-delete their auth.identities rows)
DELETE FROM auth.users
WHERE email IN (
  'admin@yakal.com',
  'tutor@yakal.com',
  'student@yakal.com',
  'parent@yakal.com',
  'counselor@yakal.com'
);

-- (Optional) Uncomment below to wipe ALL auth users, not just demo ones:
-- DELETE FROM auth.identities;
-- DELETE FROM auth.users;

SELECT 'Wipe complete. Run db_schema.sql next.' AS status;
