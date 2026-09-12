-- ============================================================
-- A student's activities and honors, as data.
--
-- These had nowhere structured to live. The nearest thing was two upload slots
-- in documentSlots.ts, "Activities resume" and "Awards and certificates",
-- which are a scan of a document: a counsellor can open one, and nothing can
-- read a field out of it.
--
-- jsonb rather than two tables for the same reason as the tutor resume in
-- 20260801001200_tutor_resume.sql: nothing queries inside it. It is written
-- whole by its owner and read whole by the people allowed to see it.
--
-- On student_academics rather than profiles, which is where the tutor resume
-- sits. profiles SELECT is still `TO authenticated USING (true)`
-- (20260805000400_profiles_not_public.sql), so a row there is readable by
-- every signed-in tutor, parent and student in the system. This table is
-- already scoped to the three people who should see it: the student
-- (student_academics_student_all), their assigned counsellor
-- (20260831000100_counselor_assignment_scoped_rls.sql) and a linked parent
-- (student_academics_parent_select). No new policy is needed, and putting the
-- data anywhere else would have meant writing one.
-- ============================================================

ALTER TABLE public.student_academics
  ADD COLUMN IF NOT EXISTS activities jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS honors     jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.student_academics.activities IS
  'Array of { from, to, activity, role, organisation, hours, summary }. Common App allows 10.';
COMMENT ON COLUMN public.student_academics.honors IS
  'Array of { year, title, level }. Common App allows 5.';

-- The baseline still carries GRANT ALL ON student_academics TO anon. RLS
-- refuses anon today because every policy tests auth.uid(), which is null, so
-- this changes no behaviour. It removes the grant a carelessly permissive
-- policy would otherwise ride in on.
REVOKE ALL ON public.student_academics FROM anon;
