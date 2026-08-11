-- Saving a university without adding it to the list.
--
-- The Saved tab used to mean "already on your college list", which made it a
-- second view of the list rather than a shortlist. Adding to the list is a
-- decision with a tier attached and a dialog to fill in; saving is "come back
-- to this one", and a student browsing nineteen hundred schools needs the
-- second long before the first.
--
-- Keyed by unitid, the federal identifier in the catalogue, because the
-- catalogue is a static JSON file rather than a table: there is no colleges
-- row to reference, and a name is not a key.

CREATE TABLE IF NOT EXISTS public.college_bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  unitid integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, unitid)
);

CREATE INDEX IF NOT EXISTS college_bookmarks_student
  ON public.college_bookmarks (student_id);

ALTER TABLE public.college_bookmarks ENABLE ROW LEVEL SECURITY;

-- Supabase grants anon and authenticated ALL on new tables in public through
-- ALTER DEFAULT PRIVILEGES. RLS would still refuse the write, but there is no
-- reason for the grant to exist and a careless policy later would then be the
-- only thing in the way.
REVOKE ALL ON public.college_bookmarks FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.college_bookmarks TO authenticated;

-- A student's own, and a parent or counselor reading the child's shortlist.
-- Writing is the student's alone: a bookmark is "I want to look at this
-- again", which is not a thing anybody else can mean on their behalf.
DROP POLICY IF EXISTS "Read own or your student's bookmarks" ON public.college_bookmarks;
CREATE POLICY "Read own or your student's bookmarks" ON public.college_bookmarks
  FOR SELECT TO authenticated
  USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.parent_student_links l
      WHERE l.student_id = college_bookmarks.student_id
        AND l.parent_id = auth.uid()
        AND l.status = 'active'
    )
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "Save your own" ON public.college_bookmarks;
CREATE POLICY "Save your own" ON public.college_bookmarks
  FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "Unsave your own" ON public.college_bookmarks;
CREATE POLICY "Unsave your own" ON public.college_bookmarks
  FOR DELETE TO authenticated
  USING (student_id = auth.uid());
