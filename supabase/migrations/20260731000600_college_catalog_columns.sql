-- College list items reference the IPEDS catalog.
--
-- The app has expected these columns for a while: addSchoolFromCatalog writes
-- them and, when the insert fails, retries with only the original columns so
-- adding a school still works. That fallback meant the gap never surfaced as a
-- bug, it just quietly dropped the deadline round, the application link and the
-- supplement count on every college anyone added.
--
-- unitid is what stops the same college existing twice under two spellings with
-- two different sticker prices. The catalog is keyed by it.

ALTER TABLE public.college_list_items
  ADD COLUMN IF NOT EXISTS unitid integer,
  ADD COLUMN IF NOT EXISTS deadline_round text,
  ADD COLUMN IF NOT EXISTS application_url text,
  ADD COLUMN IF NOT EXISTS supp_essay_count integer,
  ADD COLUMN IF NOT EXISTS why_school text,
  -- Who typed the human-entered fields, and which counselor checked them.
  -- A wrong deadline costs a student a cycle, so "who approved this" has to be
  -- answerable rather than a boolean.
  ADD COLUMN IF NOT EXISTS entered_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verified_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_note text;

ALTER TABLE public.college_list_items
  DROP CONSTRAINT IF EXISTS college_list_items_deadline_round_check;

ALTER TABLE public.college_list_items
  ADD CONSTRAINT college_list_items_deadline_round_check
  CHECK (deadline_round IS NULL OR deadline_round = ANY (ARRAY['ed1', 'ed2', 'ea', 'rea', 'rd', 'rolling']));

-- The list is always read per student, and the catalog join is by unitid.
CREATE INDEX IF NOT EXISTS college_list_items_student_idx
  ON public.college_list_items (student_id);
CREATE INDEX IF NOT EXISTS college_list_items_unitid_idx
  ON public.college_list_items (unitid)
  WHERE unitid IS NOT NULL;
