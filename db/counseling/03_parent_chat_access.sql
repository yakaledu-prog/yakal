-- ============================================================
-- YAKAL - Parent read-only access to a linked child's chats
-- Run any time. Idempotent (drop-if-exists on our named policies).
--
-- Adds SELECT-only policies (OR'd with the existing participant
-- policies) so a parent can READ - never send in - the tutor and
-- counselor conversations of their linked, active children.
-- Column names confirmed against the live schema:
--   conversations(id), conversation_participants(conversation_id, user_id),
--   messages(conversation_id, ...)
-- ============================================================

ALTER TABLE public.conversations              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages                   ENABLE ROW LEVEL SECURITY;

-- Conversations where a linked child is a participant
DROP POLICY IF EXISTS conversations_parent_select ON public.conversations;
CREATE POLICY conversations_parent_select ON public.conversations FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.conversation_participants cp
    JOIN public.parent_student_links psl
      ON psl.student_id = cp.user_id
     AND psl.parent_id = auth.uid()
     AND psl.status = 'active'
    WHERE cp.conversation_id = conversations.id));

-- Participant rows of those conversations (so the parent sees who the child talks to)
DROP POLICY IF EXISTS conversation_participants_parent_select ON public.conversation_participants;
CREATE POLICY conversation_participants_parent_select ON public.conversation_participants FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.conversation_participants cp2
    JOIN public.parent_student_links psl
      ON psl.student_id = cp2.user_id
     AND psl.parent_id = auth.uid()
     AND psl.status = 'active'
    WHERE cp2.conversation_id = conversation_participants.conversation_id));

-- Messages in those conversations (read only - no parent INSERT/UPDATE policy)
DROP POLICY IF EXISTS messages_parent_select ON public.messages;
CREATE POLICY messages_parent_select ON public.messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.conversation_participants cp
    JOIN public.parent_student_links psl
      ON psl.student_id = cp.user_id
     AND psl.parent_id = auth.uid()
     AND psl.status = 'active'
    WHERE cp.conversation_id = messages.conversation_id));

SELECT 'Parent read-only chat access applied.' AS status;
