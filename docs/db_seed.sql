-- ============================================================
-- YAKAL — DEMO DATA SEED SCRIPT (Version 1)
-- Run AFTER db_schema.sql.
--
-- Creates 5 demo accounts. All passwords: demo123
-- Emails:
--   admin@yakal.com      / demo123
--   tutor@yakal.com      / demo123
--   counselor@yakal.com  / demo123
--   parent@yakal.com     / demo123
--   student@yakal.com    / demo123
-- ============================================================

-- ─── Step 1: Insert users into auth.users ────────────────────────────────────
-- The handle_new_user() trigger will auto-create their profiles row.

DO $$
DECLARE
  v_admin_id     uuid := gen_random_uuid();
  v_tutor_id     uuid := gen_random_uuid();
  v_counselor_id uuid := gen_random_uuid();
  v_parent_id    uuid := gen_random_uuid();
  v_student_id   uuid := gen_random_uuid();
  v_course_id    uuid := gen_random_uuid();
  v_session_id   uuid := gen_random_uuid();
  v_assignment_id uuid := gen_random_uuid();
  v_conv_id      uuid := gen_random_uuid();
BEGIN

  -- ── Insert auth users ──────────────────────────────────────────────────────

  -- NOTE: the empty-string token columns (confirmation_token, recovery_token,
  -- email_change*, reauthentication_token, phone_change*) MUST be '' not NULL —
  -- GoTrue's login scanner errors on NULL strings ("converting NULL to string
  -- is unsupported"), which surfaces as "Database error querying schema".
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_user_meta_data, raw_app_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token,
    email_change_token_new, email_change, email_change_token_current,
    reauthentication_token, phone_change, phone_change_token
  ) VALUES
    (
      v_admin_id,
      '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'admin@yakal.com', crypt('demo123', gen_salt('bf')),
      now(),
      jsonb_build_object('full_name', 'Almaz Tadesse', 'role', 'admin'),
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
      now(), now(), '', '', '', '', '', '', '', ''
    ),
    (
      v_tutor_id,
      '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'tutor@yakal.com', crypt('demo123', gen_salt('bf')),
      now(),
      jsonb_build_object('full_name', 'Bethlehem Alemu', 'role', 'tutor'),
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
      now(), now(), '', '', '', '', '', '', '', ''
    ),
    (
      v_counselor_id,
      '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'counselor@yakal.com', crypt('demo123', gen_salt('bf')),
      now(),
      jsonb_build_object('full_name', 'Daniel Haile', 'role', 'counselor'),
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
      now(), now(), '', '', '', '', '', '', '', ''
    ),
    (
      v_parent_id,
      '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'parent@yakal.com', crypt('demo123', gen_salt('bf')),
      now(),
      jsonb_build_object('full_name', 'Tigist Worku', 'role', 'parent'),
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
      now(), now(), '', '', '', '', '', '', '', ''
    ),
    (
      v_student_id,
      '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'student@yakal.com', crypt('demo123', gen_salt('bf')),
      now(),
      jsonb_build_object('full_name', 'Amen Worku', 'role', 'student'),
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
      now(), now(), '', '', '', '', '', '', '', ''
    );

  -- ── Insert auth.identities so login works without email confirmation ────────

  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES
    (gen_random_uuid(), v_admin_id,     v_admin_id::text,     jsonb_build_object('sub', v_admin_id,     'email', 'admin@yakal.com'),     'email', now(), now(), now()),
    (gen_random_uuid(), v_tutor_id,     v_tutor_id::text,     jsonb_build_object('sub', v_tutor_id,     'email', 'tutor@yakal.com'),     'email', now(), now(), now()),
    (gen_random_uuid(), v_counselor_id, v_counselor_id::text, jsonb_build_object('sub', v_counselor_id, 'email', 'counselor@yakal.com'), 'email', now(), now(), now()),
    (gen_random_uuid(), v_parent_id,    v_parent_id::text,    jsonb_build_object('sub', v_parent_id,    'email', 'parent@yakal.com'),    'email', now(), now(), now()),
    (gen_random_uuid(), v_student_id,   v_student_id::text,   jsonb_build_object('sub', v_student_id,   'email', 'student@yakal.com'),   'email', now(), now(), now());

  -- ── Update profiles with full realistic details ────────────────────────────
  -- (The trigger created them with basic info; now we fill in the rest)

  -- Admin
  UPDATE public.profiles SET
    status = 'active',
    bio = 'Platform Super Administrator. Oversees all tutors, students, and platform operations.',
    is_onboarded = true,
    phone = '+251911000001',
    theme = 'light'
  WHERE id = v_admin_id;

  -- Tutor
  UPDATE public.profiles SET
    status = 'active',           -- Pre-approved for demo
    bio = 'Senior Mathematics and Physics tutor with 8 years of experience. Specializes in SAT Prep and University Entrance Exams.',
    subjects = ARRAY['Mathematics', 'Physics', 'SAT Prep'],
    hourly_rate = 500.00,        -- Ethiopian Birr per session
    zoom_link = 'https://meet.google.com/demo-tutor-link',
    phone = '+251911000002',
    is_onboarded = true,
    theme = 'light'
  WHERE id = v_tutor_id;

  -- Counselor
  UPDATE public.profiles SET
    status = 'active',           -- Pre-approved for demo
    bio = 'College admissions counselor with expertise in Ethiopian and international university applications. Helped 200+ students achieve their academic dreams.',
    is_onboarded = true,
    phone = '+251911000003',
    theme = 'light'
  WHERE id = v_counselor_id;

  -- Parent
  UPDATE public.profiles SET
    status = 'active',
    bio = NULL,
    is_onboarded = true,
    phone = '+251911000004',
    theme = 'light'
  WHERE id = v_parent_id;

  -- Student
  UPDATE public.profiles SET
    status = 'active',
    bio = 'Grade 12 student preparing for university entrance exams. Focusing on Mathematics and Physics.',
    grade_level = 'Grade 12',
    is_onboarded = true,
    phone = '+251911000005',
    theme = 'light'
  WHERE id = v_student_id;

  -- ── Tutor Availability ─────────────────────────────────────────────────────
  -- 13 hour-slots (8AM-8PM), 7 days (Sun-Sat)
  -- 0=unavailable, 1=online, 2=in-person, 3=both
  -- Set Mon-Fri 9AM-6PM as available online

  INSERT INTO public.tutor_availability (tutor_id, time_grid, disabled_days)
  VALUES (
    v_tutor_id,
    ARRAY[
      ARRAY[0,1,1,1,1,1,0],  -- 8AM-9AM
      ARRAY[0,1,1,1,1,1,0],  -- 9AM-10AM
      ARRAY[0,1,1,1,1,1,0],  -- 10AM-11AM
      ARRAY[0,1,1,1,1,1,0],  -- 11AM-12PM
      ARRAY[0,0,0,0,0,0,0],  -- 12PM-1PM (lunch break)
      ARRAY[0,1,1,1,1,1,0],  -- 1PM-2PM
      ARRAY[0,1,1,1,1,1,0],  -- 2PM-3PM
      ARRAY[0,1,1,1,1,1,0],  -- 3PM-4PM
      ARRAY[0,1,1,1,1,1,0],  -- 4PM-5PM
      ARRAY[0,1,1,1,1,1,0],  -- 5PM-6PM
      ARRAY[0,0,0,0,0,0,0],  -- 6PM-7PM
      ARRAY[0,0,0,0,0,0,0],  -- 7PM-8PM
      ARRAY[0,0,0,0,0,0,0]   -- 8PM-9PM
    ],
    ARRAY[0, 6]  -- Disabled: Sunday (0) and Saturday (6)
  );

  -- ── Demo Course ───────────────────────────────────────────────────────────

  INSERT INTO public.courses (id, title, subject, description, tutor_id, thumbnail_url, is_active, created_by)
  VALUES (
    v_course_id,
    'Advanced Mathematics — University Entrance Prep',
    'Mathematics',
    'A comprehensive course covering Calculus, Algebra, Trigonometry, and Statistics tailored for Ethiopian University Entrance Examination preparation. Sessions are conducted via Google Meet.',
    v_tutor_id,
    'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=800&q=80',
    true,
    v_admin_id
  );

  -- ── Demo Session (Upcoming) ───────────────────────────────────────────────

  INSERT INTO public.sessions (id, student_id, tutor_id, course_id, subject, date, start_time, duration_minutes, mode, zoom_link, status)
  VALUES (
    v_session_id,
    v_student_id,
    v_tutor_id,
    v_course_id,
    'Mathematics',
    CURRENT_DATE + INTERVAL '1 day',   -- Tomorrow
    '10:00:00',
    60,
    'online',
    'https://meet.google.com/demo-tutor-link',
    'upcoming'
  );

  -- ── Demo Session (Past / Completed) ──────────────────────────────────────

  INSERT INTO public.sessions (student_id, tutor_id, course_id, subject, date, start_time, duration_minutes, mode, zoom_link, status, notes)
  VALUES (
    v_student_id,
    v_tutor_id,
    v_course_id,
    'Mathematics',
    CURRENT_DATE - INTERVAL '3 days',
    '10:00:00',
    60,
    'online',
    'https://meet.google.com/demo-tutor-link',
    'completed',
    'Great session! Amen showed excellent understanding of derivatives. We covered the chain rule. Next session: integration by parts.'
  );

  -- ── Demo Assignment ───────────────────────────────────────────────────────

  INSERT INTO public.assignments (id, tutor_id, course_id, title, description, due_date)
  VALUES (
    v_assignment_id,
    v_tutor_id,
    v_course_id,
    'Derivatives Practice Sheet',
    'Complete problems 1-20 from the attached practice sheet. Focus on applying the chain rule and product rule. Show all working steps.',
    now() + INTERVAL '3 days'
  );

  -- ── Demo Conversation & Messages ──────────────────────────────────────────
  -- Canonical order: smaller UUID goes in participant_1

  IF v_student_id < v_tutor_id THEN
    INSERT INTO public.conversations (id, participant_1, participant_2, last_message_at)
    VALUES (v_conv_id, v_student_id, v_tutor_id, now() - INTERVAL '2 hours');
  ELSE
    INSERT INTO public.conversations (id, participant_1, participant_2, last_message_at)
    VALUES (v_conv_id, v_tutor_id, v_student_id, now() - INTERVAL '2 hours');
  END IF;

  INSERT INTO public.messages (conversation_id, sender_id, text, is_read, created_at)
  VALUES
    (v_conv_id, v_tutor_id,   'Hi Amen! Please make sure to review Chapter 3 before our session tomorrow.', true,  now() - INTERVAL '5 hours'),
    (v_conv_id, v_student_id, 'I will! I have already started reading it. Should I bring my notes?',        true,  now() - INTERVAL '4 hours'),
    (v_conv_id, v_tutor_id,   'Yes, definitely. Also try the practice problems at the end of the chapter.', true,  now() - INTERVAL '3 hours'),
    (v_conv_id, v_student_id, 'I am a bit stuck on problem 7. Can we go over it in the session?',           true,  now() - INTERVAL '2 hours'),
    (v_conv_id, v_tutor_id,   'Of course! That is actually a great question — it involves the chain rule. See you tomorrow at 10AM.', false, now() - INTERVAL '1 hour');

  -- ── Demo Notifications ────────────────────────────────────────────────────

  INSERT INTO public.notifications (user_id, type, title, message, link, is_read)
  VALUES
    -- Student notifications
    (v_student_id, 'booking',    'Session Confirmed',        'Your session with Bethlehem Alemu is confirmed for tomorrow at 10:00 AM.', '/student/sessions', false),
    (v_student_id, 'assignment', 'New Assignment Posted',    'Bethlehem Alemu posted a new assignment: Derivatives Practice Sheet. Due in 3 days.', '/student/assignments', false),
    (v_student_id, 'message',    'New Message',              'Bethlehem Alemu sent you a message.', '/student/messages', true),

    -- Tutor notifications
    (v_tutor_id, 'booking',   'New Session Booked',          'Amen Worku booked a session with you for tomorrow at 10:00 AM.', '/tutor/sessions', false),
    (v_tutor_id, 'approval',  'Account Approved',            'Congratulations! Your tutor account has been approved by the administrator.', '/tutor', true),

    -- Parent notifications (parent is already linked to Amen in the seed below)
    (v_parent_id, 'system', 'Upcoming Session for Amen',      'Amen Worku has a session with Bethlehem Alemu tomorrow at 10:00 AM.', '/parent', false);

  -- ── Parent-Student Link (Pre-approved for demo) ──────────────────────────

  INSERT INTO public.parent_student_links (parent_id, student_id, status)
  VALUES (v_parent_id, v_student_id, 'active');

  -- ── College Guide Application (Demo) ─────────────────────────────────────

  INSERT INTO public.college_guide_applications (student_id, counselor_id, program_interest, personal_statement, documents, status, counselor_notes)
  VALUES (
    v_student_id,
    v_counselor_id,
    'Computer Science — Addis Ababa University',
    'I have been passionate about mathematics and technology since childhood. I believe AAU''s Computer Science program will provide me the foundation to contribute to Ethiopia''s growing tech sector.',
    '[{"name": "Grade 12 Transcript", "drive_url": "https://drive.google.com/file/d/demo-transcript"}, {"name": "Personal ID", "drive_url": "https://drive.google.com/file/d/demo-id"}]'::jsonb,
    'in_review',
    'Application looks strong. Student should clarify intended specialization and provide a letter of recommendation.'
  );

  RAISE NOTICE 'Demo seed complete!';
  RAISE NOTICE 'Admin:     admin@yakal.com     / demo123';
  RAISE NOTICE 'Tutor:     tutor@yakal.com     / demo123';
  RAISE NOTICE 'Counselor: counselor@yakal.com / demo123';
  RAISE NOTICE 'Parent:    parent@yakal.com    / demo123';
  RAISE NOTICE 'Student:   student@yakal.com   / demo123';

END $$;
