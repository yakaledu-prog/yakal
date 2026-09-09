-- ============================================================
-- messageable_contacts referenced a column that no longer exists.
--
-- 20260906000100_course_tutors dropped courses.tutor_id and replaced it with
-- the course_tutors roster. This function was written before that and still
-- joined courses to read c.tutor_id, so every call raised
--
--   ERROR:  column c.tutor_id does not exist
--
-- Postgres only resolves a SQL function's body when it runs, so nothing failed
-- at migration time. The effect was that the contact list came back empty for
-- everybody who is not an admin: a student with no conversations yet was shown
-- "start a new chat with one of the people listed there" beside an empty list,
-- with two 400s in the console and no way to message anybody.
--
-- Redefined whole rather than patched, because a SQL function has no ALTER for
-- one clause. The only change is the enrolment branch, and it now reads the
-- tutor from the invoice that bought the enrolment rather than from the course.
-- A course has several tutors now; the one a family actually booked is the one
-- on their invoice, and the others are strangers to them.
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
      --
      -- The tutor named on the invoice that bought the enrolment, not every
      -- tutor on the course. A course carries a roster now, so reading the
      -- roster here would put two colleagues a family has never met into their
      -- contact list, and put every student on the course into each of those
      -- tutors' lists.
      OR EXISTS (
        SELECT 1
        FROM public.enrolments e
        JOIN public.invoices i ON i.id = e.invoice_id
        WHERE e.status = 'active'
          AND i.tutor_id IS NOT NULL
          AND (
            (e.student_id = auth.uid() AND i.tutor_id = p.id)
            OR (i.tutor_id = auth.uid() AND e.student_id = p.id)
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
