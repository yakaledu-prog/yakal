-- ============================================================
-- What each college asks for, and the essay questions it asks.
--
-- data/colleges/README.md section 4 says this data does not exist in any API,
-- that scraping admissions pages for it produces "plausible wrong" answers, and
-- that the honest plan is 25 to 40 hours of hand curation. It was right about
-- the method it tested and wrong about the conclusion, for two reasons found
-- since:
--
--   Deadlines, fees and recommendation counts DO have an authoritative machine
--   source: the Common App Requirements Grid, which Common App publishes as a
--   PDF and updates through the cycle. It is not a scrape of a marketing page,
--   it is each college's own answer on Common App's own form. 1,114 schools,
--   951 of which join to our catalog by unitid.
--
--   Prompts are unlike deadlines. A prompt is long, quoted, and states its own
--   word limit in the sentence, so a bad extraction is obvious on sight. The
--   failure the README feared, a wrong value that looks right, is a property of
--   dates, not of paragraphs.
--
-- So both live in tables rather than in the static catalog bundle, because both
-- have to be correctable by an admin without a deploy, and because a counselor
-- who finds a wrong prompt must be able to get it fixed the same day.
--
-- Everything here is public reference data. It is readable by anyone signed in
-- and writable only by an admin.
-- ============================================================

-- ------------------------------------------------------------
-- What a college asks of a first-year applicant
--
-- Keyed by (unitid, cycle) rather than by our own id, because unitid is the
-- IPEDS identifier the catalog already uses and a cycle is the unit these
-- facts change in. Last year's deadline is not wrong, it is last year's, so
-- rows accumulate rather than being overwritten.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.college_requirements (
  unitid integer NOT NULL,
  -- '2026-27'. The admissions cycle, not a calendar year: an application filed
  -- in November 2026 and one filed in January 2027 are the same cycle.
  cycle text NOT NULL,

  -- Deadlines, one per round. NULL means the college does not offer that round,
  -- which is a different fact from "we do not know", and the loader only ever
  -- writes a date it actually read.
  deadline_ed date,
  deadline_ed2 date,
  deadline_ea date,
  deadline_ea2 date,
  deadline_rea date,
  deadline_rd date,
  is_rolling boolean NOT NULL DEFAULT false,

  application_fee_cents integer,
  application_fee_intl_cents integer,
  -- 'Accepted', 'U.S. only', 'Not Accepted', or NULL where the grid is blank.
  fee_waiver text,

  personal_essay_required boolean,
  courses_grades_required boolean,
  writing_supplement_required boolean,
  -- 'SR' is SlideRoom, 'COL' the college's own system, NULL no portfolio.
  portfolio text,

  -- A/F/I/N/S in the grid's own key: Always, Flexible, Ignored, Never,
  -- Sometimes. Kept as the letter rather than expanded, so the loader stays a
  -- transcription and the interpretation lives in one place in the client.
  test_policy text,
  tests_used text,
  english_proficiency text,

  recs_teacher smallint,
  recs_other smallint,
  recs_midyear_required boolean,
  recs_counselor_required boolean,

  -- The admissions office's front door, and the page its essay questions are
  -- on. Both are discovered once and kept, because the alternative is asking
  -- every student who adds this college to go and find them: the add-a-college
  -- form used to prefill the application link with the university homepage,
  -- which is a head start on the wrong page.
  admissions_url text,
  essay_page_url text,

  -- Where this came from and when it was last known good. A counselor looking
  -- at a deadline is entitled to both.
  source text NOT NULL DEFAULT 'common_app_grid',
  source_url text,
  verified_on date,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (unitid, cycle)
);

CREATE INDEX IF NOT EXISTS college_requirements_cycle_idx
  ON public.college_requirements (cycle);

-- ------------------------------------------------------------
-- An application essay question
--
-- Two kinds of row, and the difference is whether unitid is set:
--
--   unitid IS NULL  a shared application's own question. The Common App
--                   personal statement, a UC personal insight question. One
--                   row serves every student and every college.
--   unitid IS NOT NULL  a supplement, asked by one college.
--
-- app_key is orthogonal to that and records which application carries the
-- question, because a college often asks different things of Common App and
-- Coalition applicants and a student needs to see only their own.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.essay_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle text NOT NULL,

  -- 'common_app', 'uc', 'coalition', 'questbridge', or the college's own name
  -- where it has its own application. NULL means it applies however you apply.
  app_key text,
  unitid integer,

  -- Stable handle, unique within a cycle, so a re-import updates a prompt in
  -- place instead of orphaning every essay written against it.
  slug text NOT NULL,

  -- What the card shows. Prompts run to a paragraph and a list of paragraphs is
  -- unreadable, so every row carries a few words a student can scan.
  title text NOT NULL,
  -- The question, verbatim, in the college's own words. Never paraphrased: a
  -- student answers the question that was asked.
  prompt text NOT NULL,

  -- Colleges express a limit as words or as characters, and Yale does both on
  -- one page. Storing whichever was published keeps the UI honest rather than
  -- converting and being wrong by a third.
  word_limit smallint,
  char_limit smallint,

  -- 'required', 'optional', or 'choice' for one of a set.
  requirement text NOT NULL DEFAULT 'required'
    CHECK (requirement IN ('required', 'optional', 'choice')),
  -- Prompts a student picks between share a group, and choose_count says how
  -- many of the group they owe. Four of the eight UC questions, one of Yale's
  -- three 400-word prompts.
  choice_group text,
  choose_count smallint,
  -- 'Option A'. Amherst offers two routes and a student picks a route first.
  group_label text,

  source_url text,
  verified_on date,
  sort_order smallint NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- A shared application's question has no college; a supplement has one.
  CONSTRAINT essay_prompts_scope CHECK (unitid IS NOT NULL OR app_key IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS essay_prompts_slug_cycle
  ON public.essay_prompts (cycle, slug);

CREATE INDEX IF NOT EXISTS essay_prompts_school_idx
  ON public.essay_prompts (unitid, cycle) WHERE unitid IS NOT NULL;

CREATE INDEX IF NOT EXISTS essay_prompts_app_idx
  ON public.essay_prompts (app_key, cycle) WHERE unitid IS NULL;

-- An essay remembers the question it was started from, so a student who wrote
-- against a prompt can still see the prompt after the college reworded it, and
-- so the picker can tell which of a college's questions are already answered.
-- ON DELETE SET NULL: removing a prompt from the catalogue must never remove a
-- student's draft.
ALTER TABLE public.essays
  ADD COLUMN IF NOT EXISTS essay_prompt_id uuid
    REFERENCES public.essay_prompts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS essays_prompt_idx
  ON public.essays (essay_prompt_id) WHERE essay_prompt_id IS NOT NULL;

-- ------------------------------------------------------------
-- Row level security
--
-- Supabase grants anon and authenticated everything on a new table, so both
-- are revoked first and given back only what they need. See
-- 20260805000100_testimonials.sql for why.
-- ------------------------------------------------------------
REVOKE ALL ON public.college_requirements FROM anon, authenticated;
REVOKE ALL ON public.essay_prompts FROM anon, authenticated;

GRANT SELECT ON public.college_requirements TO authenticated;
GRANT SELECT ON public.essay_prompts TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.college_requirements TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.essay_prompts TO authenticated;

ALTER TABLE public.college_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.essay_prompts ENABLE ROW LEVEL SECURITY;

-- Deadlines and prompts are published by the colleges themselves. Anyone
-- signed in can read them; nobody who is not an admin can change them.
DROP POLICY IF EXISTS college_requirements_read ON public.college_requirements;
CREATE POLICY college_requirements_read ON public.college_requirements
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS college_requirements_admin ON public.college_requirements;
CREATE POLICY college_requirements_admin ON public.college_requirements
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS essay_prompts_read ON public.essay_prompts;
CREATE POLICY essay_prompts_read ON public.essay_prompts
  FOR SELECT TO authenticated USING (is_active OR public.is_admin());

DROP POLICY IF EXISTS essay_prompts_admin ON public.essay_prompts;
CREATE POLICY essay_prompts_admin ON public.essay_prompts
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP TRIGGER IF EXISTS set_updated_at ON public.college_requirements;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.college_requirements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.essay_prompts;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.essay_prompts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------
-- Early Action II
--
-- college_list_items.deadline_round was written before we had a real source of
-- deadlines and allows ed1, ed2, ea, rea, rd and rolling. The Common App grid
-- has an EA II column and over a hundred colleges fill it in, so adding a
-- school on its EA II date had to either be labelled Early Action, which is a
-- different round with a different date, or refuse the round it actually is.
-- ------------------------------------------------------------
ALTER TABLE public.college_list_items
  DROP CONSTRAINT IF EXISTS college_list_items_deadline_round_check;

ALTER TABLE public.college_list_items
  ADD CONSTRAINT college_list_items_deadline_round_check
  CHECK (deadline_round IS NULL OR deadline_round = ANY (
    ARRAY['ed1', 'ed2', 'ea', 'ea2', 'rea', 'rd', 'rolling']
  ));
