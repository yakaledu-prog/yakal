-- More than one tutor may teach a course.
--
-- courses.tutor_id held exactly one, which is wrong twice over. A course is a
-- subject an admin priced, not a person, so "Algebra II" is one course whether
-- three tutors teach it or one. And the single column quietly closed the
-- course to everybody else: getOpenCourses filtered on `tutor_id IS NULL`, so
-- the moment the first application was accepted the course vanished from every
-- other tutor's catalog and nobody could apply again.
--
-- The column is dropped rather than kept alongside this table. Two places
-- holding the same fact is how they come to disagree, and a course with three
-- tutors has no honest value to put in a column that holds one.
--
-- Which tutor a family actually booked lives on the invoice, not here.
-- invoices.tutor_id already exists and already wins over the course's when
-- both are set; with several tutors it stops being a fallback and becomes the
-- answer.

CREATE TABLE IF NOT EXISTS public.course_tutors (
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  tutor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- When the admin accepted them. The gallery orders on this and breaks ties
  -- on tutor_id, because a seed writes a whole roster inside one transaction
  -- and now() is the same for every row in it. Ordering on the timestamp alone
  -- would leave those to the planner, and the roster would reshuffle between
  -- visits.
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (course_id, tutor_id)
);

-- The gallery reads by course; a tutor's own list reads by tutor. The primary
-- key covers the first, this covers the second.
CREATE INDEX IF NOT EXISTS course_tutors_tutor_idx
  ON public.course_tutors (tutor_id, created_at);

-- Carry over whoever was already assigned, before the column goes.
INSERT INTO public.course_tutors (course_id, tutor_id)
SELECT id, tutor_id FROM public.courses WHERE tutor_id IS NOT NULL
ON CONFLICT DO NOTHING;

ALTER TABLE public.course_tutors ENABLE ROW LEVEL SECURITY;

-- Supabase grants anon and authenticated ALL on new tables in public. RLS
-- would still stop a write, but the grant has no reason to exist and a
-- permissive policy added later would be the only thing left in the way.
REVOKE ALL ON public.course_tutors FROM anon, authenticated;
GRANT SELECT ON public.course_tutors TO anon, authenticated;

-- Who teaches a course is not a secret: it is the thing a family is choosing
-- between, and the catalog is readable signed out.
DROP POLICY IF EXISTS "Anyone can see who teaches a course" ON public.course_tutors;
CREATE POLICY "Anyone can see who teaches a course" ON public.course_tutors
  FOR SELECT USING (true);

-- Only an admin writes. A tutor joins a course by applying and being
-- accepted; letting them insert here would be a way around that.
DROP POLICY IF EXISTS "Admin can manage course tutors" ON public.course_tutors;
CREATE POLICY "Admin can manage course tutors" ON public.course_tutors
  USING (public.is_admin()) WITH CHECK (public.is_admin());

GRANT INSERT, UPDATE, DELETE ON public.course_tutors TO authenticated;

COMMENT ON TABLE public.course_tutors IS
  'Which tutors may teach a course. Replaces courses.tutor_id, which held one.';

-- enrolments_tutor_select read courses.tutor_id, so it has to be rewritten
-- before the column can go.
--
-- It is narrowed while here rather than simply pointed at the new table. The
-- old rule was "the tutor on this course sees its roll", which was the whole
-- roll because there was only ever one tutor. Pointed straight at
-- course_tutors it would have become "every tutor on this course sees every
-- student on it", so a tutor would see the families who chose a colleague
-- instead of them.
--
-- The tutor a family actually booked is on the invoice, and enrolments
-- carries invoice_id. Where the invoice names a tutor, that tutor sees the
-- enrolment and the others do not. Where it names nobody, which is every row
-- written before a course could have more than one tutor, any tutor on the
-- course sees it, exactly as before.
DROP POLICY IF EXISTS enrolments_tutor_select ON public.enrolments;
CREATE POLICY enrolments_tutor_select ON public.enrolments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.course_tutors ct
      WHERE ct.course_id = enrolments.course_id
        AND ct.tutor_id = auth.uid()
    )
    AND (
      NOT EXISTS (
        SELECT 1 FROM public.invoices i
        WHERE i.id = enrolments.invoice_id AND i.tutor_id IS NOT NULL
      )
      OR EXISTS (
        SELECT 1 FROM public.invoices i
        WHERE i.id = enrolments.invoice_id AND i.tutor_id = auth.uid()
      )
    )
  );

ALTER TABLE public.courses DROP COLUMN IF EXISTS tutor_id;
