-- Reporting a conversation.
--
-- A parent watching their child's tutor conversations needs a way to raise a
-- concern, and an admin needs something they can act on. A bare "flagged"
-- boolean would tell an admin nothing, so a report carries a reason and an
-- optional note and keeps its own review state.
--
-- Flagging is per conversation rather than per message. The alternative was a
-- flag icon on every bubble, which puts dozens of controls on screen for
-- something done once in a hundred sessions.

CREATE TABLE IF NOT EXISTS public.conversation_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  reported_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason text NOT NULL,
  note text,
  status text NOT NULL DEFAULT 'open',
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT conversation_flags_reason_check
    CHECK (reason = ANY (ARRAY['inappropriate', 'off_platform', 'no_show', 'quality', 'other'])),
  CONSTRAINT conversation_flags_status_check
    CHECK (status = ANY (ARRAY['open', 'reviewed', 'dismissed']))
);

-- One open report per person per conversation. Reporting twice is a mistake,
-- not a stronger signal, and duplicates only make the admin queue noisier.
CREATE UNIQUE INDEX IF NOT EXISTS conversation_flags_one_open_per_reporter
  ON public.conversation_flags (conversation_id, reported_by)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS conversation_flags_status_idx
  ON public.conversation_flags (status, created_at DESC);

ALTER TABLE public.conversation_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS conversation_flags_insert ON public.conversation_flags;
DROP POLICY IF EXISTS conversation_flags_select_own ON public.conversation_flags;
DROP POLICY IF EXISTS conversation_flags_admin_all ON public.conversation_flags;

-- Anyone who can read the conversation can report it: the two people in it,
-- and a parent linked to a child who is in it. Both helpers are SECURITY
-- DEFINER, which is what keeps this from recursing back through the
-- conversation policies.
CREATE POLICY conversation_flags_insert ON public.conversation_flags
  FOR INSERT WITH CHECK (
    reported_by = auth.uid()
    AND (
      public.is_conversation_participant(conversation_id)
      OR public.is_linked_parent_of_conversation(conversation_id)
    )
  );

-- A reporter sees their own report and nobody else's. Whether someone else
-- reported the same conversation is not their business.
CREATE POLICY conversation_flags_select_own ON public.conversation_flags
  FOR SELECT USING (reported_by = auth.uid());

CREATE POLICY conversation_flags_admin_all ON public.conversation_flags
  USING (public.is_admin()) WITH CHECK (public.is_admin());
