-- ============================================================
-- YAKAL - Sample counseling / college data for the demo users
-- Run AFTER 01-03. Safe to re-run: the bulk insert is guarded so
-- it only seeds once per student.
--   Student   : Amen Worku   (student@yakal.com)
--   Counselor : Daniel Haile (counselor@yakal.com)
--   Parent    : Tigist Worku (parent@yakal.com)
-- ============================================================

DO $$
DECLARE
  v_student   uuid;
  v_counselor uuid;
  v_parent    uuid;
  v_harvard   uuid;
BEGIN
  SELECT id INTO v_student   FROM public.profiles WHERE email = 'student@yakal.com';
  SELECT id INTO v_counselor FROM public.profiles WHERE email = 'counselor@yakal.com';
  SELECT id INTO v_parent    FROM public.profiles WHERE email = 'parent@yakal.com';

  IF v_student IS NULL THEN
    RAISE NOTICE 'Demo student not found - nothing seeded.';
    RETURN;
  END IF;

  -- Make sure the counselor can actually log in (pre-approved)
  UPDATE public.profiles SET status = 'active' WHERE id = v_counselor;

  -- Link parent -> student (active) if not already linked
  IF v_parent IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.parent_student_links
    WHERE parent_id = v_parent AND student_id = v_student
  ) THEN
    INSERT INTO public.parent_student_links (parent_id, student_id, status)
    VALUES (v_parent, v_student, 'active');
  END IF;

  -- Top-level journey record (one per student)
  IF NOT EXISTS (SELECT 1 FROM public.college_guide_applications WHERE student_id = v_student) THEN
    INSERT INTO public.college_guide_applications
      (student_id, counselor_id, program_interest, personal_statement, status, counselor_notes, stage, grad_year)
    VALUES
      (v_student, v_counselor, 'Computer Science',
       'Growing up in Addis Ababa, I discovered a love for problem-solving through mathematics…',
       'in_progress',
       'Strong STEM profile. Focus next on the Common App personal statement and two reach schools.',
       'apply', 2026);
  ELSE
    UPDATE public.college_guide_applications
      SET counselor_id = COALESCE(counselor_id, v_counselor)
      WHERE student_id = v_student;
  END IF;

  -- Academics (one per student)
  IF NOT EXISTS (SELECT 1 FROM public.student_academics WHERE student_id = v_student) THEN
    INSERT INTO public.student_academics
      (student_id, gpa, gpa_scale, sat_score, toefl_score, ap_courses)
    VALUES
      (v_student, 3.85, 4.0, 1480, 108, ARRAY['AP Calculus BC', 'AP Physics C', 'AP Computer Science A']);
  END IF;

  -- Seed the list / essays / etc only once (guard on college_list_items)
  IF NOT EXISTS (SELECT 1 FROM public.college_list_items WHERE student_id = v_student) THEN
    INSERT INTO public.college_list_items (student_id, school_name, tier, deadline, status, notes)
    VALUES (v_student, 'Massachusetts Institute of Technology', 'dream', DATE '2026-01-01', 'applying', 'Reach - strong research fit');

    INSERT INTO public.college_list_items (student_id, school_name, tier, deadline, status, notes)
    VALUES (v_student, 'Harvard University', 'dream', DATE '2026-01-01', 'considering', NULL)
    RETURNING id INTO v_harvard;

    INSERT INTO public.college_list_items (student_id, school_name, tier, deadline, status, notes)
    VALUES
      (v_student, 'Arizona State University', 'target', DATE '2026-02-01', 'applying', 'Good CS program, likely admit'),
      (v_student, 'Addis Ababa University',   'safety', DATE '2026-03-15', 'considering', 'Local safety option');

    -- Per-school requirements for Harvard
    INSERT INTO public.application_requirements (college_list_item_id, label, is_complete, due_date)
    VALUES
      (v_harvard, 'Common Application',       true,  DATE '2025-12-15'),
      (v_harvard, 'Supplemental essays',      false, DATE '2025-12-20'),
      (v_harvard, 'Two teacher recommendations', false, DATE '2025-12-20'),
      (v_harvard, 'SAT scores sent',          true,  NULL);

    -- Essays
    INSERT INTO public.essays (student_id, title, kind, status, due_date)
    VALUES
      (v_student, 'Common App Personal Statement', 'personal_statement', 'drafting',  DATE '2025-12-01'),
      (v_student, 'Why MIT?',                      'supplement',         'todo',      DATE '2025-12-15');

    -- Recommendation
    INSERT INTO public.recommendations (student_id, recommender_name, recommender_email, relationship, status)
    VALUES
      (v_student, 'Bethlehem Alemu', 'tutor@yakal.com', 'Mathematics Tutor', 'requested');

    -- General tasks
    INSERT INTO public.application_tasks (student_id, title, status, due_date)
    VALUES
      (v_student, 'Finalize college list with counselor', 'in_progress', DATE '2025-11-30'),
      (v_student, 'Request official transcript',          'todo',        DATE '2025-12-05');
  END IF;
END $$;

SELECT 'Counseling seed complete.' AS status;
