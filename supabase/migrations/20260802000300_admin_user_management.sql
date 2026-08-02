-- ============================================================
-- Two things the admin Users page could not do.
--
-- Deleting a user is a soft delete: the profile stays so that sessions,
-- invoices and messages still have somebody to point at, and the status says
-- they are gone. Except 'deleted' was never a status the column allowed, so
-- every delete failed on the check constraint and the page reported the
-- constraint name at the person clicking.
--
-- And an admin opening a parent saw "None found" under Children, because
-- parent_student_links had policies for parents and for students and none for
-- admins. Nobody had noticed: the parent's own pages read the same rows
-- through the parent policy and looked fine.
-- ============================================================

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_status_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_status_check
  CHECK (status = ANY (ARRAY['active', 'pending', 'suspended', 'rejected', 'deleted']));

COMMENT ON COLUMN public.profiles.status IS
  'active, pending, suspended, rejected, or deleted. Deleted is a soft delete: the row stays so that sessions, invoices and messages still resolve to a person.';

-- ------------------------------------------------------------
-- Admins can read who is linked to whom
--
-- Read only, and deliberately so. Who a child belongs to is decided between
-- the parent who asks and the student who accepts; an admin needs to see the
-- answer to support them, not to change it.
-- ------------------------------------------------------------

DROP POLICY IF EXISTS parent_student_links_admin_select ON public.parent_student_links;

CREATE POLICY parent_student_links_admin_select ON public.parent_student_links
  FOR SELECT USING (public.is_admin());

-- ------------------------------------------------------------
-- Admins can read a student's college list
--
-- The list had policies for the student, their counselor and their parent, so
-- the admin's view of a student showed nothing under admissions and looked
-- like missing data rather than a missing policy.
--
-- Read only: the list belongs to the student and the counselor advising them.
-- ------------------------------------------------------------

DROP POLICY IF EXISTS college_list_items_admin_select ON public.college_list_items;

CREATE POLICY college_list_items_admin_select ON public.college_list_items
  FOR SELECT USING (public.is_admin());
