-- ============================================================
-- YAKAL - Row Level Security for the counseling / college model
-- Run AFTER 01_counseling_schema.sql. Idempotent (drop-if-exists).
--
-- Access model per table:
--   Student   : full CRUD on their own rows
--   Counselor : full access to all rows (public.is_counselor())
--   Parent    : SELECT only, for rows of a linked+active child
-- ============================================================

-- -- Tables keyed directly by student_id ---------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'college_guide_applications', 'college_list_items', 'essays',
    'student_academics', 'recommendations', 'application_tasks'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    -- Student: own rows, all operations
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_student_all', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL
         USING (auth.uid() = student_id) WITH CHECK (auth.uid() = student_id)',
      t || '_student_all', t);

    -- Counselor: all rows, all operations
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_counselor_all', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL
         USING (public.is_counselor()) WITH CHECK (public.is_counselor())',
      t || '_counselor_all', t);

    -- Parent: read-only for a linked, active child
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_parent_select', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT USING (
         EXISTS (SELECT 1 FROM public.parent_student_links psl
                 WHERE psl.parent_id = auth.uid() AND psl.status = ''active''
                   AND psl.student_id = %I.student_id))',
      t || '_parent_select', t, t);
  END LOOP;
END $$;

-- -- application_requirements: keyed via college_list_items --
ALTER TABLE public.application_requirements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS application_requirements_student_all ON public.application_requirements;
CREATE POLICY application_requirements_student_all ON public.application_requirements FOR ALL
  USING (EXISTS (SELECT 1 FROM public.college_list_items cli
                 WHERE cli.id = application_requirements.college_list_item_id
                   AND cli.student_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.college_list_items cli
                      WHERE cli.id = application_requirements.college_list_item_id
                        AND cli.student_id = auth.uid()));

DROP POLICY IF EXISTS application_requirements_counselor_all ON public.application_requirements;
CREATE POLICY application_requirements_counselor_all ON public.application_requirements FOR ALL
  USING (public.is_counselor()) WITH CHECK (public.is_counselor());

DROP POLICY IF EXISTS application_requirements_parent_select ON public.application_requirements;
CREATE POLICY application_requirements_parent_select ON public.application_requirements FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.college_list_items cli
    JOIN public.parent_student_links psl
      ON psl.student_id = cli.student_id
     AND psl.parent_id = auth.uid()
     AND psl.status = 'active'
    WHERE cli.id = application_requirements.college_list_item_id));

SELECT 'Counseling RLS applied.' AS status;
