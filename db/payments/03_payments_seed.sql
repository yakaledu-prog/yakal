-- ============================================================
-- YAKAL — Sample billing data for the demo parent
-- Run AFTER 01–02. Guarded so it only seeds once.
--   Parent  : Tigist Worku (parent@yakal.com)
--   Student : Amen Worku   (student@yakal.com)
-- ============================================================

DO $$
DECLARE
  v_parent  uuid;
  v_student uuid;
BEGIN
  SELECT id INTO v_parent  FROM public.profiles WHERE email = 'parent@yakal.com';
  SELECT id INTO v_student FROM public.profiles WHERE email = 'student@yakal.com';

  IF v_parent IS NULL THEN
    RAISE NOTICE 'Demo parent not found — nothing seeded.';
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.invoices WHERE parent_id = v_parent) THEN
    INSERT INTO public.invoices (parent_id, student_id, description, amount_cents, kind, status, due_date)
    VALUES
      (v_parent, v_student, 'Fall Semester — AP Physics (10 sessions)', 45000, 'tutoring',    'open', DATE '2026-11-15'),
      (v_parent, v_student, 'Algebra II Mentorship (4 sessions)',       20000, 'tutoring',    'open', DATE '2026-11-20');

    INSERT INTO public.invoices (parent_id, student_id, description, amount_cents, kind, status, paid_at)
    VALUES
      (v_parent, v_student, 'Registration Fee', 5000, 'registration', 'paid', now() - interval '20 days');
  END IF;

  -- Parent-facing prices on a couple of courses (margin over tutor rate).
  UPDATE public.courses SET price_cents = 6000
    WHERE price_cents IS NULL AND subject IN ('Mathematics', 'Physics');
END $$;

SELECT 'Payments seed complete.' AS status;
