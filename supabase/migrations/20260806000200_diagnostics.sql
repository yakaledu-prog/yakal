-- Diagnostics an admin can write, instead of a TypeScript file only a
-- developer can change.
--
-- src/data/diagnostics.ts stays as the fallback, so a database with no rows
-- still offers the tests that shipped. The page prefers this table when it has
-- anything published.
--
-- Scoped to a subject, not to a course. The diagnostic runs immediately after
-- student onboarding, before anybody has bought anything, and its job is to
-- work out what to recommend. course_id is there and nullable for the other
-- kind of assessment, the one that measures whether a course taught what it
-- promised, without needing a second table the day somebody wants it.

CREATE TABLE IF NOT EXISTS public.diagnostics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The stable string the results are keyed by. diagnostic results reference
  -- a test by this, not by the uuid, so an edit never orphans a score.
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  category_id text NOT NULL,
  category_name text NOT NULL,
  time_limit_minutes integer,
  /**
   * The questions, as the app already models them:
   *   [{ id, text, options: string[], correctAnswer: number, explanation? }]
   *
   * jsonb rather than two more tables. A test is read whole, written whole,
   * and never queried by question, so rows would buy joins and lose the
   * ability to paste one in.
   */
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Null means a placement test, offered by subject at onboarding.
  course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  published boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- A test with no questions cannot be sat. Better to refuse it here than to
  -- let a student open one and find nothing.
  CONSTRAINT diagnostics_questions_is_array CHECK (jsonb_typeof(questions) = 'array'),
  CONSTRAINT diagnostics_published_has_questions
    CHECK (NOT published OR jsonb_array_length(questions) > 0)
);

CREATE INDEX IF NOT EXISTS diagnostics_browse_idx
  ON public.diagnostics (published, category_id, sort_order);

ALTER TABLE public.diagnostics ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.diagnostics FROM anon, authenticated;
GRANT SELECT ON public.diagnostics TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.diagnostics TO authenticated;

-- Anyone signed in may sit a published test. Not anon: a diagnostic carries
-- its own answer key in correctAnswer, so handing it to the open internet
-- hands over the answers with it.
DROP POLICY IF EXISTS "Published diagnostics are readable" ON public.diagnostics;
CREATE POLICY "Published diagnostics are readable" ON public.diagnostics
  FOR SELECT TO authenticated USING (published);

DROP POLICY IF EXISTS "Admins read every diagnostic" ON public.diagnostics;
CREATE POLICY "Admins read every diagnostic" ON public.diagnostics
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Admins write diagnostics" ON public.diagnostics;
CREATE POLICY "Admins write diagnostics" ON public.diagnostics
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.touch_diagnostics_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS diagnostics_touch_updated_at ON public.diagnostics;
CREATE TRIGGER diagnostics_touch_updated_at
  BEFORE UPDATE ON public.diagnostics
  FOR EACH ROW EXECUTE FUNCTION public.touch_diagnostics_updated_at();
