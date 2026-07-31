-- More than one reason per report.
--
-- The reasons are not exclusive in practice: a message that moves the
-- arrangement off the platform is often the same message that is
-- inappropriate. Forcing one made people pick the closest fit and put the rest
-- in the note, where nothing can group or count it.
--
-- `reason` stays, holding the first choice. The admin queue, the unique
-- indexes and everything already written keep working, and a single-reason
-- report is just an array of one.

ALTER TABLE public.conversation_flags
  ADD COLUMN IF NOT EXISTS reasons text[];

UPDATE public.conversation_flags
  SET reasons = ARRAY[reason]
  WHERE reasons IS NULL;

ALTER TABLE public.conversation_flags
  ALTER COLUMN reasons SET DEFAULT '{}';

ALTER TABLE public.conversation_flags
  DROP CONSTRAINT IF EXISTS conversation_flags_reasons_check;

ALTER TABLE public.conversation_flags
  ADD CONSTRAINT conversation_flags_reasons_check
  CHECK (
    reasons IS NULL
    OR reasons <@ ARRAY['inappropriate', 'off_platform', 'no_show', 'quality', 'other']
  );
