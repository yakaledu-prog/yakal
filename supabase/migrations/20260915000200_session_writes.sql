-- The browser can no longer write a session, except a tutor's own notes.
--
-- Two holes, both money:
--
--   "Students can book sessions" let a student insert any row with their own
--   student_id. Nothing in the app inserts sessions from the browser (fulfilment
--   and book_advising_session do it on the server), so its only use was to
--   create a past lesson naming any tutor and any tutor_earning_cents, which the
--   hourly job then completed and paid out of the platform balance.
--
--   "Tutors can update their sessions (notes, status)" had USING and no WITH
--   CHECK and no column limit, so a tutor could raise tutor_earning_cents on a
--   lesson a family really paid for, or write attendance so a lesson nobody
--   attended was never marked a no-show.
--
-- Column privileges are the control; the database enforces them and there is no
-- function to get wrong. The trigger is a second layer for anything a future
-- grant opens by mistake.
--
-- Everything that legitimately changes a session still can: the service role
-- (fulfilment, the job, cancellations, disputes, the Zoom webhook) and the
-- SECURITY DEFINER functions (reschedule_session, book_advising_session,
-- cancel_advising_session), which run as their owner.

DROP POLICY IF EXISTS "Students can book sessions" ON public.sessions;
DROP POLICY IF EXISTS "Tutors can update their sessions (notes, status)" ON public.sessions;

CREATE POLICY "Tutors can update their session notes" ON public.sessions
  FOR UPDATE TO authenticated
  USING (auth.uid() = tutor_id)
  WITH CHECK (auth.uid() = tutor_id);

-- The baseline granted ALL, TRUNCATE included, to anon and authenticated.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.sessions FROM anon, authenticated;
GRANT UPDATE (notes) ON public.sessions TO authenticated;

-- SECURITY INVOKER on purpose. Inside a SECURITY DEFINER function current_user
-- is always the owner, so this guard would never fire; as an invoker it sees
-- 'authenticated' for a browser request and the owner inside reschedule_session.
CREATE OR REPLACE FUNCTION public.guard_session_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF (to_jsonb(NEW) - 'notes' - 'updated_at') IS DISTINCT FROM (to_jsonb(OLD) - 'notes' - 'updated_at') THEN
    RAISE EXCEPTION 'Only notes can be changed on a session' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_session_columns() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guard_session_columns ON public.sessions;
CREATE TRIGGER guard_session_columns
  BEFORE UPDATE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.guard_session_columns();
