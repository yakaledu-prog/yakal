-- ============================================================
-- When somebody last looked at a screen.
--
-- The sidebar can already count things, but it cannot say "new since you last
-- looked", because nothing recorded when that was. A bold row done purely in
-- the browser either never clears, or clears the moment the page renders
-- whether or not anybody read it.
--
-- One row per person per screen. Deliberately not per item: marking every
-- invoice read individually is a table that grows with the business to answer
-- a question nobody asks, and "anything since Tuesday" is the actual question.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_seen (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- A short key the client picks: 'billing', 'earnings'. Free text rather than
  -- an enum so adding a screen is not a migration.
  surface text NOT NULL,
  seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, surface)
);

COMMENT ON TABLE public.user_seen IS
  'When each person last opened a given screen. What makes "new since you looked" possible.';

-- New tables arrive with anon and authenticated granted everything by the
-- project's default privileges, so the grant is revoked before any policy is
-- written. See supabase/migrations/20260805000100_testimonials.sql.
REVOKE ALL ON public.user_seen FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.user_seen TO authenticated;

ALTER TABLE public.user_seen ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_seen_own ON public.user_seen;

-- Their own row and nothing else. There is nothing sensitive in a timestamp,
-- but when somebody last opened their billing page is still theirs.
CREATE POLICY user_seen_own ON public.user_seen
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
