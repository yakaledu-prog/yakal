-- Two things about linking a parent to a child.

-- ---------------------------------------------------------------------------
-- 1. Removing a link
-- ---------------------------------------------------------------------------
--
-- parent_student_links had policies for insert, select and update, and none
-- for delete. So Remove matched no rows, PostgREST reported no error because
-- deleting nothing is not an error, and the panel said "removed" over a child
-- who was still there. A silent success is the worst of the three outcomes.
--
-- Either side can sever it. A parent who added the wrong account needs to undo
-- that, and a student needs to be able to remove somebody who should not be
-- watching their work, without asking that person to do it.
DROP POLICY IF EXISTS parent_student_links_parent_delete ON public.parent_student_links;
CREATE POLICY parent_student_links_parent_delete
  ON public.parent_student_links
  FOR DELETE TO authenticated
  USING (auth.uid() = parent_id);

DROP POLICY IF EXISTS parent_student_links_student_delete ON public.parent_student_links;
CREATE POLICY parent_student_links_student_delete
  ON public.parent_student_links
  FOR DELETE TO authenticated
  USING (auth.uid() = student_id);

-- ---------------------------------------------------------------------------
-- 2. Inviting a child who has no account yet
-- ---------------------------------------------------------------------------
--
-- Adding a child by email answered "No account uses that email address yet"
-- and stopped, which is a dead end at the exact moment a parent is trying to
-- bring somebody in. The address is now remembered, and the link is created
-- for them when they sign up.
CREATE TABLE IF NOT EXISTS public.parent_child_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  email text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz
);

-- One live invite per parent per address. Asking twice is the same ask.
CREATE UNIQUE INDEX IF NOT EXISTS parent_child_invites_live
  ON public.parent_child_invites (parent_id, lower(email))
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS parent_child_invites_email
  ON public.parent_child_invites (lower(email)) WHERE status = 'pending';

ALTER TABLE public.parent_child_invites ENABLE ROW LEVEL SECURITY;

-- A parent sees and manages their own invitations, and nobody else's. The
-- address of a child somebody else invited is not theirs to read.
DROP POLICY IF EXISTS parent_child_invites_own ON public.parent_child_invites;
CREATE POLICY parent_child_invites_own
  ON public.parent_child_invites
  FOR ALL TO authenticated
  USING (auth.uid() = parent_id)
  WITH CHECK (auth.uid() = parent_id);

DROP POLICY IF EXISTS parent_child_invites_admin ON public.parent_child_invites;
CREATE POLICY parent_child_invites_admin
  ON public.parent_child_invites
  FOR SELECT TO authenticated
  USING (public.is_admin());

/**
 * Turn invitations into link requests when the child signs up.
 *
 * Runs on the profile, not on auth.users, because the role is what decides:
 * an invitation is for a student, and somebody who signs up as a tutor with
 * that address has not accepted anything.
 *
 * The link is created pending, exactly as if the parent had typed the address
 * of an existing account. Being invited is not consent; the student still
 * says yes on their own screen.
 */
CREATE OR REPLACE FUNCTION public.claim_child_invites()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite record;
BEGIN
  IF NEW.role <> 'student' OR NEW.email IS NULL THEN
    RETURN NEW;
  END IF;

  FOR v_invite IN
    SELECT id, parent_id FROM public.parent_child_invites
    WHERE lower(email) = lower(NEW.email) AND status = 'pending'
  LOOP
    INSERT INTO public.parent_student_links (parent_id, student_id, status)
    VALUES (v_invite.parent_id, NEW.id, 'pending')
    ON CONFLICT DO NOTHING;

    UPDATE public.parent_child_invites
    SET status = 'accepted', accepted_at = now()
    WHERE id = v_invite.id;

    INSERT INTO public.notifications (user_id, type, title, message, link)
    VALUES (
      NEW.id,
      'parent_link',
      'Parent link request',
      'A parent invited you to Yakal and has asked to link to your account.',
      '/student/notifications'
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS claim_child_invites_on_profile ON public.profiles;
CREATE TRIGGER claim_child_invites_on_profile
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.claim_child_invites();
