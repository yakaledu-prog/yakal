-- ============================================================
-- YAKAL - Admin access policies (safety net)
-- Run any time. Idempotent (drop-if-exists on our named policies).
--
-- Most of these likely already exist from the original schema; this
-- file guarantees the admin console can read/write what it needs:
--   profiles          : update (approve/reject tutors & counselors)
--   courses           : full manage (set parent price, toggle active)
--   contact_messages  : read + update (mark handled)
--   invoices          : read all (also covered by db/payments/02)
-- Relies on the existing public.is_admin() helper.
-- ============================================================

-- profiles: admin can update status / rejection_reason
DROP POLICY IF EXISTS profiles_admin_update ON public.profiles;
CREATE POLICY profiles_admin_update ON public.profiles FOR UPDATE
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- courses: admin full access
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS courses_admin_all ON public.courses;
CREATE POLICY courses_admin_all ON public.courses FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- contact_messages: admin read + update
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS contact_messages_admin_select ON public.contact_messages;
CREATE POLICY contact_messages_admin_select ON public.contact_messages FOR SELECT
  USING (public.is_admin());
DROP POLICY IF EXISTS contact_messages_admin_update ON public.contact_messages;
CREATE POLICY contact_messages_admin_update ON public.contact_messages FOR UPDATE
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- invoices: admin read all (idempotent with db/payments/02)
DROP POLICY IF EXISTS invoices_admin_all ON public.invoices;
CREATE POLICY invoices_admin_all ON public.invoices FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

SELECT 'Admin policies applied.' AS status;
