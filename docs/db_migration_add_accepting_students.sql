-- ============================================================
-- YAKAL - MIGRATION: add accepting_students to profiles
-- Run ONCE in Supabase SQL Editor (safe on the seeded DB).
-- Tutor toggle: when false, the tutor is hidden from the student
-- catalog and cannot receive new bookings (existing ones remain).
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS accepting_students boolean NOT NULL DEFAULT true;

SELECT 'Migration complete: profiles.accepting_students added.' AS status;
