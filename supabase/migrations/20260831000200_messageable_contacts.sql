-- ============================================================
-- Who a person is actually allowed to start a conversation with.
--
-- getContacts() read the whole profiles table and filtered in the browser, so
-- the new-message picker offered every account on the platform: a student could
-- open a chat with an unrelated counsellor, and anyone could enumerate every
-- name and role. The real boundary for reading profiles is still the broad
-- profiles SELECT policy (its own tracked item), but contact discovery does not
-- need the whole table, and should not offer people you have no relationship
-- with.
--
-- This function returns only the accounts the caller has a platform tie to:
--
--   * anyone they already share a conversation with (so existing threads never
--     vanish from the list, whatever the rules below say)
--   * admins, who are always reachable for support and moderation
--   * their assigned counsellor, or their advisees
--   * their tutors, or their students (through sessions and active enrolments)
--   * their linked family, and the people working with their linked child
--
-- SECURITY DEFINER so it can see across those tables regardless of the caller's
-- own row visibility; it never returns more than the relationships above, and
-- never the caller themselves. Admins get everyone, because that is their job.
-- ============================================================

CREATE OR REPLACE FUNCTION public.messageable_contacts()
RETURNS TABLE (
  id uuid,
  full_name text,
  role text,
  avatar_url text,
  last_seen_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.role, p.avatar_url, p.last_seen_at
  FROM public.profiles p
  WHERE p.id <> auth.uid()
    AND (
      -- Admins reach everyone.
      public.is_admin()

      -- Everyone reaches admins.
      OR p.role = 'admin'

      -- Someone already in a conversation with me.
      OR EXISTS (
        SELECT 1
        FROM public.conversation_participants mine
        JOIN public.conversation_participants theirs
          ON theirs.conversation_id = mine.conversation_id
        WHERE mine.user_id = auth.uid()
          AND theirs.user_id = p.id
      )

      -- My assigned counsellor (I am the student), or my advisee (I am the counsellor).
      OR EXISTS (
        SELECT 1 FROM public.admissions_plans ap
        WHERE ap.status IN ('active', 'past_due')
          AND (
            (ap.student_id = auth.uid() AND ap.counselor_id = p.id)
            OR (ap.counselor_id = auth.uid() AND ap.student_id = p.id)
          )
      )

      -- My tutor or my student, through a booked session either way.
      OR EXISTS (
        SELECT 1 FROM public.sessions s
        WHERE (s.student_id = auth.uid() AND s.tutor_id = p.id)
           OR (s.tutor_id = auth.uid() AND s.student_id = p.id)
      )

      -- My tutor or my student, through an active course enrolment.
      OR EXISTS (
        SELECT 1
        FROM public.enrolments e
        JOIN public.courses c ON c.id = e.course_id
        WHERE e.status = 'active'
          AND (
            (e.student_id = auth.uid() AND c.tutor_id = p.id)
            OR (c.tutor_id = auth.uid() AND e.student_id = p.id)
          )
      )

      -- Linked family: my child (I am the parent), or my parent (I am the student).
      OR EXISTS (
        SELECT 1 FROM public.parent_student_links l
        WHERE l.status = 'active'
          AND (
            (l.parent_id = auth.uid() AND l.student_id = p.id)
            OR (l.student_id = auth.uid() AND l.parent_id = p.id)
          )
      )

      -- The people working with my linked child: I am the parent, p is the
      -- child's counsellor or tutor.
      OR EXISTS (
        SELECT 1
        FROM public.parent_student_links l
        JOIN public.admissions_plans ap
          ON ap.student_id = l.student_id AND ap.status IN ('active', 'past_due')
        WHERE l.parent_id = auth.uid() AND l.status = 'active'
          AND ap.counselor_id = p.id
      )
      OR EXISTS (
        SELECT 1
        FROM public.parent_student_links l
        JOIN public.sessions s ON s.student_id = l.student_id
        WHERE l.parent_id = auth.uid() AND l.status = 'active'
          AND s.tutor_id = p.id
      )

      -- The reverse: I am the counsellor or tutor working with a child, p is
      -- that child's linked parent.
      OR EXISTS (
        SELECT 1
        FROM public.admissions_plans ap
        JOIN public.parent_student_links l
          ON l.student_id = ap.student_id AND l.status = 'active'
        WHERE ap.counselor_id = auth.uid() AND ap.status IN ('active', 'past_due')
          AND l.parent_id = p.id
      )
      OR EXISTS (
        SELECT 1
        FROM public.sessions s
        JOIN public.parent_student_links l
          ON l.student_id = s.student_id AND l.status = 'active'
        WHERE s.tutor_id = auth.uid()
          AND l.parent_id = p.id
      )
    );
$$;

REVOKE ALL ON FUNCTION public.messageable_contacts() FROM anon;
GRANT EXECUTE ON FUNCTION public.messageable_contacts() TO authenticated;
