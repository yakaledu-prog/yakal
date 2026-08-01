-- ============================================================
-- Count the things a counselor cannot invent.
--
-- Essay rounds are a weak meter. A round is one click, so the number a
-- counselor reports is the number of times a counselor clicked, and nothing
-- outside the portal has to agree with it.
--
-- The meters worth having are bounded by something the counselor did not
-- create:
--
--   supplemental essays reviewed   the student's essays, tied to colleges on
--                                  their own list. The ceiling is how many
--                                  real essays exist.
--   mock interviews                an appointment with a second person, who
--                                  notices if it did not happen.
--
-- Neither makes faking impossible. A counselor can mark an unread essay done.
-- What they cannot do is manufacture essays or students, and that ceiling is
-- the protection. The real audit is the counterparty, not the counter.
--
-- A mock interview is a session, so it needs marking as one rather than a
-- table of its own: it is booked, held, missed and rescheduled exactly like
-- every other appointment.
-- ============================================================

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'lesson';

ALTER TABLE public.sessions DROP CONSTRAINT IF EXISTS sessions_kind_check;
ALTER TABLE public.sessions ADD CONSTRAINT sessions_kind_check
  CHECK (kind IN ('lesson', 'advising', 'mock_interview'));

COMMENT ON COLUMN public.sessions.kind IS
  'lesson is tutoring. advising and mock_interview are counselling, and the '
  'tier sells a number of each.';

-- Only completed ones count. A booked interview is an intention; the tier
-- promises the interview itself.
CREATE INDEX IF NOT EXISTS sessions_kind_student_idx
  ON public.sessions (student_id, kind)
  WHERE kind <> 'lesson';

ALTER TABLE public.admissions_tiers
  -- Null is unlimited, the same as the essay quotas. Zero means the tier does
  -- not include interview prep at all, which is a different thing and has to
  -- be sayable.
  ADD COLUMN IF NOT EXISTS mock_interviews_limit smallint;

UPDATE public.admissions_tiers SET mock_interviews_limit = 0 WHERE key = 'essential';
UPDATE public.admissions_tiers SET mock_interviews_limit = 1 WHERE key = 'premier';
UPDATE public.admissions_tiers SET mock_interviews_limit = NULL WHERE key = 'elite';
