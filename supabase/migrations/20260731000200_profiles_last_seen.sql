-- ============================================================
-- Track when someone was last using the app.
--
-- Presence over realtime answers "is this person online right now" but knows
-- nothing once they disconnect, so a conversation header had no way to say
-- anything about someone who is offline. The client writes this column on a
-- slow heartbeat while the app is open, and reads it back for "last seen".
--
-- No new policy: "Users can update their own profile" already covers the
-- write, and profiles are readable.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

COMMENT ON COLUMN public.profiles.last_seen_at IS
  'Last time this user had the app open. Written by a client heartbeat, so it is approximate to within a minute.';
