-- ============================================================
-- A counsellor could read and edit any student's admissions records.
--
-- 20260803000200_counselor_assignment.sql narrowed the counsellor's reach on
-- admissions_plans and college_guide_applications to their assigned students,
-- via is_my_advisee(). It did not touch the child tables, so the baseline
-- policies from 20260731000000 were still in force there:
--
--   application_tasks_counselor_all
--   college_list_items_counselor_all
--   essays_counselor_all
--   recommendations_counselor_all
--   student_academics_counselor_all
--   application_requirements_counselor_all
--
-- Each is FOR ALL with USING (is_counselor()) and WITH CHECK (is_counselor()),
-- so any active counsellor could SELECT, INSERT, UPDATE and DELETE every
-- student's college list, essays, tasks, requirements, recommendations and
-- academics, whether or not that student was theirs. RLS is the whole security
-- model here, so this was reachable straight from the anon key plus a
-- counsellor's token, not only through the counsellor UI.
--
-- This finishes the job the assignment migration started: the same
-- is_my_advisee() boundary, applied to the child tables. Nothing here touches
-- the student and linked-parent policies, which already scope to the owner and
-- stay exactly as they were.
--
-- application_requirements has no student_id of its own; it hangs off a
-- college_list_items row, so its student is resolved through that.
--
-- student_documents deliberately has no counsellor policy at all, so there is
-- nothing to scope there and it is left alone.
-- ============================================================

-- ---------- tables that carry student_id directly ----------

DROP POLICY IF EXISTS "application_tasks_counselor_all" ON public.application_tasks;
CREATE POLICY "application_tasks_counselor_all" ON public.application_tasks
  FOR ALL TO authenticated
  USING (public.is_counselor() AND public.is_my_advisee(student_id))
  WITH CHECK (public.is_counselor() AND public.is_my_advisee(student_id));

DROP POLICY IF EXISTS "college_list_items_counselor_all" ON public.college_list_items;
CREATE POLICY "college_list_items_counselor_all" ON public.college_list_items
  FOR ALL TO authenticated
  USING (public.is_counselor() AND public.is_my_advisee(student_id))
  WITH CHECK (public.is_counselor() AND public.is_my_advisee(student_id));

DROP POLICY IF EXISTS "essays_counselor_all" ON public.essays;
CREATE POLICY "essays_counselor_all" ON public.essays
  FOR ALL TO authenticated
  USING (public.is_counselor() AND public.is_my_advisee(student_id))
  WITH CHECK (public.is_counselor() AND public.is_my_advisee(student_id));

DROP POLICY IF EXISTS "recommendations_counselor_all" ON public.recommendations;
CREATE POLICY "recommendations_counselor_all" ON public.recommendations
  FOR ALL TO authenticated
  USING (public.is_counselor() AND public.is_my_advisee(student_id))
  WITH CHECK (public.is_counselor() AND public.is_my_advisee(student_id));

DROP POLICY IF EXISTS "student_academics_counselor_all" ON public.student_academics;
CREATE POLICY "student_academics_counselor_all" ON public.student_academics
  FOR ALL TO authenticated
  USING (public.is_counselor() AND public.is_my_advisee(student_id))
  WITH CHECK (public.is_counselor() AND public.is_my_advisee(student_id));

-- ---------- a table that reaches its student through college_list_items ----------

DROP POLICY IF EXISTS "application_requirements_counselor_all" ON public.application_requirements;
CREATE POLICY "application_requirements_counselor_all" ON public.application_requirements
  FOR ALL TO authenticated
  USING (
    public.is_counselor()
    AND EXISTS (
      SELECT 1 FROM public.college_list_items cli
      WHERE cli.id = application_requirements.college_list_item_id
        AND public.is_my_advisee(cli.student_id)
    )
  )
  WITH CHECK (
    public.is_counselor()
    AND EXISTS (
      SELECT 1 FROM public.college_list_items cli
      WHERE cli.id = application_requirements.college_list_item_id
        AND public.is_my_advisee(cli.student_id)
    )
  );
