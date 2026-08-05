-- What a notification was about, rather than what we said about it.
--
-- A notification carried a title and one line, and the detail pane showed that
-- same line again, so opening one told you nothing the list had not. Everything
-- worth reading lived in the email and nowhere in the app.
--
-- The fix is not to store the paragraph. An email is sent once and gone, so a
-- wording mistake there is one message; a notification sits in a list for
-- months, and stored prose can never be corrected. This holds the facts the
-- event was about, a name and a count and a title, and the app renders the
-- words from the template every time it draws them. Fixing a sentence fixes
-- every notification already sent.
--
-- title and message stay. They are one line each, they cost almost nothing,
-- and they are what renders if a template is ever renamed or removed.
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS template text,
  ADD COLUMN IF NOT EXISTS vars jsonb;

COMMENT ON COLUMN public.notifications.template IS
  'Key into src/lib/notifications/templates. Null on rows written before templates existed.';
COMMENT ON COLUMN public.notifications.vars IS
  'The facts the template needs, not the rendered text. Null falls back to title and message.';
