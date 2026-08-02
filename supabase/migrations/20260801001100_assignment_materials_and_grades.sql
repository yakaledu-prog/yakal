-- ============================================================
-- What an assignment is worth, what comes with it, and what it scored.
--
-- The table held a title, a description and one template URL, which is less
-- than any real piece of work carries: a worksheet plus lecture notes is two
-- attachments, and a grade of 95 means nothing without the 100 beside it.
--
-- Shaped to match what Google Classroom returns, so a course linked to a class
-- and a course managed here render through the same component rather than two
-- that drift apart.
-- ============================================================

ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS max_points integer,
  ADD COLUMN IF NOT EXISTS materials jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.assignments.materials IS
  'Array of { title, link }, matching the shape Classroom materials are flattened into.';

ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS grade numeric(6,2);

COMMENT ON COLUMN public.submissions.grade IS
  'Out of the assignment''s max_points. Null means turned in and not yet marked.';

-- Students read the work set on courses they are enrolled on. Without this the
-- assignments page is empty for the very people it is for.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'assignments' AND policyname = 'Students see work set on their courses'
  ) THEN
    CREATE POLICY "Students see work set on their courses"
      ON public.assignments FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.enrolments e
          WHERE e.course_id = assignments.course_id
            AND e.student_id = auth.uid()
        )
        -- A parent watching their child's course sees the same list.
        OR EXISTS (
          SELECT 1 FROM public.enrolments e
          JOIN public.parent_student_links l
            ON l.student_id = e.student_id AND l.parent_id = auth.uid() AND l.status = 'active'
          WHERE e.course_id = assignments.course_id
        )
      );
  END IF;
END $$;
