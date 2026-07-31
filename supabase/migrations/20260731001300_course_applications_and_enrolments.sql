-- The course flow: tutors apply, admins accept, parents book and pay,
-- students get the course.
--
-- Two things were missing for this to work end to end.
--
-- courses.tutor_id is a single nullable column, so a tutor was either assigned
-- or not and there was nowhere to record that somebody wanted the work.
-- course_applications is that record, and it keeps the decision rather than
-- deleting the row: "we turned this person down in March" is worth knowing in
-- June.
--
-- Course membership was derived from booked sessions, so a paid course with no
-- sessions yet did not exist as far as the student's side was concerned.
-- enrolments makes it a fact of its own, created when the payment lands.

-- ---------- tutors applying for a course ----------

CREATE TABLE IF NOT EXISTS public.course_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  tutor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- Why they are a fit. Optional: a tutor who has taught three of these
  -- already should not have to write an essay.
  message text,
  status text NOT NULL DEFAULT 'pending',
  decided_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT course_applications_status_check
    CHECK (status = ANY (ARRAY['pending', 'accepted', 'rejected', 'withdrawn']))
);

-- One live application per tutor per course. Applying twice is a mistake, not
-- a stronger signal. A withdrawn or rejected one does not block a later try.
CREATE UNIQUE INDEX IF NOT EXISTS course_applications_one_pending
  ON public.course_applications (course_id, tutor_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS course_applications_course_idx
  ON public.course_applications (course_id, status);
CREATE INDEX IF NOT EXISTS course_applications_tutor_idx
  ON public.course_applications (tutor_id, status);

ALTER TABLE public.course_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS course_applications_tutor_select ON public.course_applications;
DROP POLICY IF EXISTS course_applications_tutor_insert ON public.course_applications;
DROP POLICY IF EXISTS course_applications_tutor_withdraw ON public.course_applications;
DROP POLICY IF EXISTS course_applications_admin_all ON public.course_applications;

-- A tutor sees their own applications and nobody else's. Who else applied, and
-- how many, is not their business and would change how they price themselves.
CREATE POLICY course_applications_tutor_select ON public.course_applications
  FOR SELECT USING (tutor_id = auth.uid());

CREATE POLICY course_applications_tutor_insert ON public.course_applications
  FOR INSERT WITH CHECK (
    tutor_id = auth.uid()
    AND status = 'pending'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'tutor' AND p.status = 'active'
    )
  );

-- A tutor may withdraw, and nothing else. Accepting yourself is the obvious
-- hole, so the check pins the only status they can move to.
CREATE POLICY course_applications_tutor_withdraw ON public.course_applications
  FOR UPDATE USING (tutor_id = auth.uid() AND status = 'pending')
  WITH CHECK (tutor_id = auth.uid() AND status = 'withdrawn');

CREATE POLICY course_applications_admin_all ON public.course_applications
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ---------- students enrolled on a course ----------

CREATE TABLE IF NOT EXISTS public.enrolments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- Who paid. Usually the parent; null when a student enrolled themselves.
  purchased_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT enrolments_status_check
    CHECK (status = ANY (ARRAY['active', 'completed', 'cancelled']))
);

-- A student is on a course once. Paying twice is a billing question, not two
-- memberships.
CREATE UNIQUE INDEX IF NOT EXISTS enrolments_one_active
  ON public.enrolments (course_id, student_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS enrolments_student_idx ON public.enrolments (student_id, status);
CREATE INDEX IF NOT EXISTS enrolments_course_idx ON public.enrolments (course_id, status);

ALTER TABLE public.enrolments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS enrolments_student_select ON public.enrolments;
DROP POLICY IF EXISTS enrolments_parent_select ON public.enrolments;
DROP POLICY IF EXISTS enrolments_tutor_select ON public.enrolments;
DROP POLICY IF EXISTS enrolments_admin_all ON public.enrolments;

CREATE POLICY enrolments_student_select ON public.enrolments
  FOR SELECT USING (student_id = auth.uid());

CREATE POLICY enrolments_parent_select ON public.enrolments
  FOR SELECT USING (
    purchased_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.parent_student_links l
      WHERE l.student_id = enrolments.student_id
        AND l.parent_id = auth.uid()
        AND l.status = 'active'
    )
  );

-- The tutor teaching the course needs its roll.
CREATE POLICY enrolments_tutor_select ON public.enrolments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = enrolments.course_id AND c.tutor_id = auth.uid()
    )
  );

CREATE POLICY enrolments_admin_all ON public.enrolments
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ---------- what an invoice was actually for ----------

-- The webhook has to know which course was bought and which slots were picked,
-- and it cannot ask the browser: by then the payer has been redirected away,
-- and a client-supplied answer at that point is worth nothing. Recording the
-- intent on the invoice when it is created makes the invoice the record of
-- what was bought.
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS booking jsonb;

COMMENT ON COLUMN public.invoices.booking IS
  'The slots chosen at checkout: [{"date":"2026-08-04","startTime":"16:00","durationMinutes":60}]. Read by the payment webhook to create the sessions.';

-- ---------- notification types ----------

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type = ANY (ARRAY[
    'booking', 'assignment', 'approval', 'message', 'system',
    'parent_link', 'application', 'unlock_request',
    -- A tutor applied for a course, and the decision that follows.
    'course_application', 'course_application_decided',
    -- A course was paid for and is now available.
    'enrolment'
  ]));
