-- ============================================================
-- Let a notification be archived without deleting it.
--
-- The notification screens already offer an archive action, but there was
-- nowhere to record it, so the state lived in component state and vanished on
-- reload. Existing policies cover this: users see and update their own rows.
-- ============================================================

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS notifications_user_inbox_idx
  ON public.notifications (user_id, archived, created_at DESC);
