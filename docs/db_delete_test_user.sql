-- ============================================================
-- YAKAL, Delete a test user (for re-testing signup / onboarding)
-- ============================================================
-- Deleting from auth.users cascades to public.profiles (FK ON DELETE
-- CASCADE) and to auth.identities, so the email becomes free to reuse.
--
-- Usage: replace the email, run in Supabase SQL Editor.
-- ============================================================

DELETE FROM auth.users WHERE email = 'REPLACE_ME@example.com';

-- ── Handy variations ────────────────────────────────────────
-- Reset a user's onboarding without deleting them (re-test onboarding):
--   UPDATE public.profiles SET is_onboarded = false WHERE email = 'someone@example.com';
--
-- Flip a tutor/counselor to approved (simulate admin approval before Phase 4):
--   UPDATE public.profiles SET status = 'active' WHERE email = 'tutor@yakal.com';
--
-- Delete every NON-demo user (keeps the 5 seeded demo accounts):
--   DELETE FROM auth.users
--   WHERE email NOT IN (
--     'admin@yakal.com','tutor@yakal.com','counselor@yakal.com',
--     'parent@yakal.com','student@yakal.com'
--   );

SELECT 'done' AS status;
