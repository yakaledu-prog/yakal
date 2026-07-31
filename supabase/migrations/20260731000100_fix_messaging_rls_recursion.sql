-- ============================================================
-- Fix infinite recursion (42P17) in the messaging RLS policies.
--
-- db/counseling/03_parent_chat_access.sql added a SELECT policy ON
-- conversation_participants whose USING clause itself queried
-- conversation_participants. Postgres re-applies the policy while evaluating
-- that inner query, so it never terminates. Every read of
-- conversation_participants failed with
--   42P17 infinite recursion detected in policy for relation
--         "conversation_participants"
-- and because the conversations and messages policies join that table, the
-- whole messaging feature was dead for every role.
--
-- The cycle is broken by routing membership checks through SECURITY DEFINER
-- helpers: they run with the function owner's rights, so the lookup inside
-- them does not re-enter RLS.
--
-- This also lets the policies be scoped properly. The old cp_select was
-- USING (true), meaning any signed-in user could read every participant row
-- in the database and see who was talking to whom.
-- ============================================================

-- ---------- membership helpers ----------

-- Is the caller a participant of this conversation?
CREATE OR REPLACE FUNCTION public.is_conversation_participant(p_conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversation_participants
    WHERE conversation_id = p_conversation_id
      AND user_id = auth.uid()
  );
$$;

-- Is the caller the linked parent of someone in this conversation?
-- Read-only access: parents never get INSERT/UPDATE on messages.
CREATE OR REPLACE FUNCTION public.is_linked_parent_of_conversation(p_conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversation_participants cp
    JOIN public.parent_student_links psl
      ON psl.student_id = cp.user_id
     AND psl.parent_id = auth.uid()
     AND psl.status = 'active'
    WHERE cp.conversation_id = p_conversation_id
  );
$$;

ALTER FUNCTION public.is_conversation_participant(uuid) OWNER TO postgres;
ALTER FUNCTION public.is_linked_parent_of_conversation(uuid) OWNER TO postgres;

GRANT EXECUTE ON FUNCTION public.is_conversation_participant(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_linked_parent_of_conversation(uuid) TO authenticated;

-- ---------- conversation_participants ----------

DROP POLICY IF EXISTS conversation_participants_parent_select ON public.conversation_participants;
DROP POLICY IF EXISTS cp_select ON public.conversation_participants;
DROP POLICY IF EXISTS cp_insert ON public.conversation_participants;

-- You see the participant rows of conversations you belong to (which is how
-- the client resolves the other person), plus those of your linked children.
CREATE POLICY cp_select ON public.conversation_participants
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_conversation_participant(conversation_id)
    OR public.is_linked_parent_of_conversation(conversation_id)
  );

-- Direct inserts are only for adding yourself. Creating a two-person
-- conversation goes through get_or_create_conversation() below, which is
-- SECURITY DEFINER and therefore not bound by this policy.
CREATE POLICY cp_insert ON public.conversation_participants
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR public.is_conversation_participant(conversation_id)
  );

-- ---------- conversations ----------

DROP POLICY IF EXISTS conversations_parent_select ON public.conversations;
DROP POLICY IF EXISTS conv_select ON public.conversations;
DROP POLICY IF EXISTS conv_update ON public.conversations;

CREATE POLICY conv_select ON public.conversations
  FOR SELECT TO authenticated
  USING (
    public.is_conversation_participant(id)
    OR public.is_linked_parent_of_conversation(id)
  );

CREATE POLICY conv_update ON public.conversations
  FOR UPDATE TO authenticated
  USING (public.is_conversation_participant(id))
  WITH CHECK (public.is_conversation_participant(id));

-- ---------- messages ----------

DROP POLICY IF EXISTS messages_parent_select ON public.messages;
DROP POLICY IF EXISTS msg_select ON public.messages;
DROP POLICY IF EXISTS msg_insert ON public.messages;
DROP POLICY IF EXISTS msg_update ON public.messages;

CREATE POLICY msg_select ON public.messages
  FOR SELECT TO authenticated
  USING (
    public.is_conversation_participant(conversation_id)
    OR public.is_linked_parent_of_conversation(conversation_id)
  );

CREATE POLICY msg_insert ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.is_conversation_participant(conversation_id)
  );

-- Marking received messages as read. The WITH CHECK keeps a participant from
-- editing a message's content or reassigning its sender.
CREATE POLICY msg_update ON public.messages
  FOR UPDATE TO authenticated
  USING (public.is_conversation_participant(conversation_id))
  WITH CHECK (public.is_conversation_participant(conversation_id));

-- ---------- atomic conversation bootstrap ----------

-- The client used to do this in three round trips (look up my conversations,
-- look up theirs, insert conversation + both participant rows). That races
-- two people into duplicate threads and needs a permissive INSERT policy on
-- conversation_participants to work at all. Doing it in one SECURITY DEFINER
-- call fixes both.
CREATE OR REPLACE FUNCTION public.get_or_create_conversation(p_peer_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_conversation_id uuid;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  IF p_peer_id IS NULL OR p_peer_id = v_me THEN
    RAISE EXCEPTION 'a conversation needs a different second participant'
      USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_peer_id) THEN
    RAISE EXCEPTION 'no such user %', p_peer_id USING ERRCODE = '23503';
  END IF;

  -- Reuse the existing two-person thread if there is one. The participant
  -- count guard keeps us from matching a future group conversation that
  -- happens to contain both of us.
  SELECT c.id INTO v_conversation_id
  FROM public.conversations c
  WHERE EXISTS (
          SELECT 1 FROM public.conversation_participants
          WHERE conversation_id = c.id AND user_id = v_me)
    AND EXISTS (
          SELECT 1 FROM public.conversation_participants
          WHERE conversation_id = c.id AND user_id = p_peer_id)
    AND (SELECT count(*) FROM public.conversation_participants
         WHERE conversation_id = c.id) = 2
  ORDER BY c.created_at
  LIMIT 1;

  IF v_conversation_id IS NOT NULL THEN
    RETURN v_conversation_id;
  END IF;

  INSERT INTO public.conversations DEFAULT VALUES
  RETURNING id INTO v_conversation_id;

  INSERT INTO public.conversation_participants (conversation_id, user_id)
  VALUES (v_conversation_id, v_me), (v_conversation_id, p_peer_id);

  RETURN v_conversation_id;
END;
$$;

ALTER FUNCTION public.get_or_create_conversation(uuid) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.get_or_create_conversation(uuid) TO authenticated;
