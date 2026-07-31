-- Admins can read a reported message.
--
-- The reports queue shows the message somebody complained about, which an
-- admin otherwise cannot see: msg_select only admits participants, and an
-- admin is not in the conversation.
--
-- Scoped to messages that carry an open report rather than granting admins the
-- whole message table. Reading somebody's private conversation should require
-- that they, or a parent watching over them, asked for it to be looked at. A
-- report closed as reviewed or dismissed stops matching, so access lapses when
-- the case does.

DROP POLICY IF EXISTS msg_select_admin_reported ON public.messages;

CREATE POLICY msg_select_admin_reported ON public.messages
  FOR SELECT USING (
    public.is_admin()
    AND EXISTS (
      SELECT 1 FROM public.conversation_flags f
      WHERE f.message_id = messages.id AND f.status = 'open'
    )
  );
