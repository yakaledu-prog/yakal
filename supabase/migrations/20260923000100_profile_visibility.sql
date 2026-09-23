-- A profile is visible to the people it has something to do with.
--
-- The policy until now was "Signed-in users can view profiles", USING (true).
-- Any account could read all 25 rows: every name, every email, every role,
-- students and parents included. The five private columns were closed in
-- 20260920000400, which was the quick half; this is the other half, the one
-- the checklist has carried as "any signed-in user can still read every
-- profile".
--
-- Who can see whom, and why:
--   yourself, always;
--   admins, everyone, because approving and supporting people needs it;
--   staff (an active tutor, counsellor or admin), everyone, because tutors and
--     counsellors are already public through v_public_tutors, a family picks a
--     tutor from the catalogue before any relationship exists, and an admin is
--     who everybody messages for support;
--   otherwise, only through a real relationship: a shared conversation, a
--     counselling plan, a booked lesson, a course bought from that tutor, an
--     active parent link, and the staff working with your linked child.
--
-- The relationship list is the one messageable_contacts already uses, so the
-- people you can read are the people you can write to, and the two cannot
-- drift into disagreeing.
--
-- SECURITY DEFINER, so reading profiles inside it does not re-enter this
-- policy. It never calls itself.

CREATE OR REPLACE FUNCTION public.can_see_profile(p_target uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_target = auth.uid()
    OR public.is_admin()
    -- Staff: tutors and counsellors are listed publicly already, and an admin
    -- is who everybody writes to for support, so messageable_contacts offers
    -- every admin to everybody. Hiding the row behind that name would leave a
    -- contact you can message and cannot see.
    OR EXISTS (
      SELECT 1 FROM public.profiles s
      WHERE s.id = p_target
        AND s.status = 'active'
        AND s.role IN ('tutor', 'counselor', 'admin')
    )
    -- Someone already in a conversation with me.
    OR EXISTS (
      SELECT 1
      FROM public.conversation_participants mine
      JOIN public.conversation_participants theirs
        ON theirs.conversation_id = mine.conversation_id
      WHERE mine.user_id = auth.uid()
        AND theirs.user_id = p_target
    )
    -- My counsellor, or my advisee.
    OR EXISTS (
      SELECT 1 FROM public.admissions_plans ap
      WHERE ap.status IN ('active', 'past_due')
        AND (
          (ap.student_id = auth.uid() AND ap.counselor_id = p_target)
          OR (ap.counselor_id = auth.uid() AND ap.student_id = p_target)
        )
    )
    -- My tutor or my student, through a booked lesson either way.
    OR EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE (s.student_id = auth.uid() AND s.tutor_id = p_target)
         OR (s.tutor_id = auth.uid() AND s.student_id = p_target)
    )
    -- The tutor named on the invoice that bought an enrolment, and that
    -- tutor's students. The roster is not used here, for the reason
    -- messageable_contacts gives: it would introduce colleagues a family has
    -- never met.
    OR EXISTS (
      SELECT 1
      FROM public.enrolments e
      JOIN public.invoices i ON i.id = e.invoice_id
      WHERE e.status = 'active'
        AND i.tutor_id IS NOT NULL
        AND (
          (e.student_id = auth.uid() AND i.tutor_id = p_target)
          OR (i.tutor_id = auth.uid() AND e.student_id = p_target)
        )
    )
    -- Linked family, both ways.
    OR EXISTS (
      SELECT 1 FROM public.parent_student_links l
      WHERE l.status = 'active'
        AND (
          (l.parent_id = auth.uid() AND l.student_id = p_target)
          OR (l.student_id = auth.uid() AND l.parent_id = p_target)
        )
    )
    -- The people working with my linked child.
    OR EXISTS (
      SELECT 1
      FROM public.parent_student_links l
      JOIN public.admissions_plans ap
        ON ap.student_id = l.student_id AND ap.status IN ('active', 'past_due')
      WHERE l.parent_id = auth.uid() AND l.status = 'active'
        AND ap.counselor_id = p_target
    )
    OR EXISTS (
      SELECT 1
      FROM public.parent_student_links l
      JOIN public.sessions s ON s.student_id = l.student_id
      WHERE l.parent_id = auth.uid() AND l.status = 'active'
        AND s.tutor_id = p_target
    )
    -- A parent and the child's other parent, so two parents on one account
    -- can see each other.
    OR EXISTS (
      SELECT 1
      FROM public.parent_student_links mine
      JOIN public.parent_student_links theirs ON theirs.student_id = mine.student_id
      WHERE mine.parent_id = auth.uid() AND mine.status = 'active'
        AND theirs.parent_id = p_target AND theirs.status = 'active'
    );
$$;

REVOKE ALL ON FUNCTION public.can_see_profile(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.can_see_profile(uuid) TO authenticated;

DROP POLICY IF EXISTS "Signed-in users can view profiles" ON public.profiles;
DROP POLICY IF EXISTS profiles_read_related ON public.profiles;
CREATE POLICY profiles_read_related ON public.profiles
  FOR SELECT TO authenticated
  USING (public.can_see_profile(id));
