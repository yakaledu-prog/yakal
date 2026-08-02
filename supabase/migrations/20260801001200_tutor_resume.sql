-- ============================================================
-- A tutor's background, as data.
--
-- The Resume tab on the booking page was hardcoded JSX: every tutor in the
-- catalogue held an M.Ed. from Stanford and spoke conversational Spanish,
-- because that is what somebody typed into the markup. A family choosing a
-- tutor was reading the same invented CV whoever they clicked.
--
-- Stored as jsonb rather than four tables because nothing queries inside it:
-- it is written whole by its owner and read whole by everyone else.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS education jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS work_experience jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS certifications jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS languages jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.profiles.education IS
  'Array of { from, to, qualification, institution }.';
COMMENT ON COLUMN public.profiles.work_experience IS
  'Array of { from, to, role, organisation, summary }.';
COMMENT ON COLUMN public.profiles.certifications IS
  'Array of { year, title, issuer }.';
COMMENT ON COLUMN public.profiles.languages IS
  'Array of { name, level }.';
