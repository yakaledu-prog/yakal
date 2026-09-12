-- ============================================================
-- Where a prompt's text came from: a person, or a script.
--
-- The seven colleges done by hand were read off the college's own page by
-- somebody who then wrote the JSON. That does not scale to 1,944, and the
-- alternative is a script that fetches the same page and picks out the
-- sentences that look like questions with word limits on them. It is right
-- most of the time and wrong some of the time, and the difference between
-- those two ways of knowing has to survive into the product, because a
-- student answering the wrong question wastes a week.
--
-- So: 'manual' means a person read it, 'machine' means a script did. A machine
-- row still carries source_url, so checking one is a click, and verified_on
-- stays null until somebody has. The picker says so on the row rather than
-- presenting both kinds as equally settled.
--
-- data/colleges/README.md's rule was "do not bulk-generate this from memory",
-- and that rule is kept: nothing here is generated. Every machine row is a
-- quotation from a page that was actually fetched.
-- ============================================================

ALTER TABLE public.essay_prompts
  ADD COLUMN IF NOT EXISTS extraction text NOT NULL DEFAULT 'manual'
    CHECK (extraction IN ('manual', 'machine'));

COMMENT ON COLUMN public.essay_prompts.extraction IS
  'manual: a person read the college''s page. machine: a script extracted it and nobody has checked it yet.';

-- Marking one checked is the common edit, and it is two columns moving
-- together. A trigger rather than trusting every caller to remember.
CREATE OR REPLACE FUNCTION public.essay_prompt_verified_implies_manual()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Somebody setting a verified date is somebody saying they read it.
  IF NEW.verified_on IS NOT NULL AND NEW.verified_on IS DISTINCT FROM OLD.verified_on THEN
    NEW.extraction := 'manual';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS essay_prompt_verified_implies_manual ON public.essay_prompts;
CREATE TRIGGER essay_prompt_verified_implies_manual
  BEFORE UPDATE ON public.essay_prompts
  FOR EACH ROW EXECUTE FUNCTION public.essay_prompt_verified_implies_manual();
