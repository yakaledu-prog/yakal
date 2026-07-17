-- ============================================================
-- YAKAL, MIGRATION: add Zoom/meeting columns to sessions
-- Run ONCE in Supabase SQL Editor (safe on the seeded DB).
-- Stores the Zoom meeting created at booking time so both the
-- tutor (host) and student (participant) can join in-app via
-- the Meeting SDK.
-- ============================================================

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS meeting_room_id text,
  ADD COLUMN IF NOT EXISTS zoom_meeting_id text,
  ADD COLUMN IF NOT EXISTS zoom_password   text;

SELECT 'Migration complete: sessions zoom columns added.' AS status;
