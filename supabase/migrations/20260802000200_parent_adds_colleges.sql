-- ============================================================
-- A parent putting a college on their child's list.
--
-- Parents could read the list and nothing else, which was the wrong shape for
-- how the decision is actually made: the family talks about it, and the person
-- who has been reading the prospectuses is often not the one with the account.
-- Sending them to tell their child to add it is a worse answer than letting
-- them add it.
--
-- Insert only. A parent cannot change a tier a counselor set, cannot edit the
-- essay notes, and cannot delete anything: adding to the conversation is not
-- the same as owning it, and the list stays the student's.
-- ============================================================

DROP POLICY IF EXISTS college_list_items_parent_insert ON public.college_list_items;

CREATE POLICY college_list_items_parent_insert ON public.college_list_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.parent_student_links psl
      WHERE psl.student_id = college_list_items.student_id
        AND psl.parent_id = auth.uid()
        AND psl.status = 'active'
    )
    -- entered_by has to be the truth, or "who put this here" becomes a
    -- question nobody can answer. A student opening their list to find a
    -- college they have never heard of should be able to see where it came
    -- from without asking anyone.
    AND entered_by = auth.uid()
  );

COMMENT ON COLUMN public.college_list_items.entered_by IS
  'Who added this row: the student, their counselor, or a linked parent. Shown on the list so an unexpected entry explains itself.';
