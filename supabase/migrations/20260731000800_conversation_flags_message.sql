-- A report names the message it is about.
--
-- The first cut flagged a whole conversation, which left an admin opening a
-- thread of two hundred messages with no idea which one caused the complaint.
-- The message is what makes a report actionable.
--
-- Still nullable: a concern about a pattern ("they keep cancelling") is not
-- about any single message, and forcing a choice would make people pick one at
-- random.

ALTER TABLE public.conversation_flags
  ADD COLUMN IF NOT EXISTS message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL;

-- One open report per person per message, and one per person per conversation
-- for a general concern. Two indexes rather than one because Postgres treats
-- NULLs as distinct, so a single index would let the general case repeat.
DROP INDEX IF EXISTS public.conversation_flags_one_open_per_reporter;

CREATE UNIQUE INDEX IF NOT EXISTS conversation_flags_one_open_per_message
  ON public.conversation_flags (reported_by, message_id)
  WHERE status = 'open' AND message_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS conversation_flags_one_open_general
  ON public.conversation_flags (reported_by, conversation_id)
  WHERE status = 'open' AND message_id IS NULL;
