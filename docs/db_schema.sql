-- ============================================================
-- YAKAL, FULL DATABASE SCHEMA (Version 1)
-- Run AFTER db_wipe.sql.
-- Run BEFORE db_seed.sql.
-- ============================================================

-- Enable pgcrypto for password hashing in seed script
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- SHARED: updated_at trigger function
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================
-- TABLE: profiles
-- Extends auth.users. Created automatically via trigger below.
-- ============================================================
CREATE TABLE public.profiles (
  id             uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email          text UNIQUE,            -- Mirrored from auth.users (clients can't read auth schema)
  full_name      text NOT NULL DEFAULT '',
  role           text NOT NULL DEFAULT 'student'
                 CHECK (role IN ('student', 'tutor', 'counselor', 'parent', 'admin')),
  status         text NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active', 'pending', 'suspended', 'rejected')),
  -- Note: tutors/counselors start as 'pending'; students/parents start as 'active'
  avatar_url     text,
  bio            text,
  phone          text,
  zoom_link      text,                   -- Tutors set their personal Zoom/Meet URL here
  subjects       text[],                 -- e.g. ARRAY['Mathematics', 'Physics']
  hourly_rate    numeric(10,2),          -- Tutor's rate per session
  rate_currency  text NOT NULL DEFAULT 'ETB' CHECK (rate_currency IN ('ETB', 'USD')),
  grade_level    text,                   -- Student: e.g. 'Grade 10', 'University Year 1'
  theme          text NOT NULL DEFAULT 'light' CHECK (theme IN ('light', 'dark')),
  accepting_students boolean NOT NULL DEFAULT true,  -- Tutor: discoverable/bookable by new students
  is_onboarded   boolean NOT NULL DEFAULT false,
  rejection_reason text,                 -- If admin rejects a tutor/counselor application
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- ROLE-CHECK HELPERS (SECURITY DEFINER)
-- These bypass RLS so policies can check a user's role WITHOUT
-- causing "infinite recursion detected in policy" on profiles.
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_counselor()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'counselor'
  );
$$;

-- Auto-create profile on auth.users INSERT
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_role text;
  v_status text;
BEGIN
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'student');
  -- Tutors and counselors require admin approval
  IF v_role IN ('tutor', 'counselor') THEN
    v_status := 'pending';
  ELSE
    v_status := 'active';
  END IF;

  INSERT INTO public.profiles (id, email, full_name, role, status, avatar_url, is_onboarded)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    v_role,
    v_status,
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NULL),
    false
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Admin can update any profile (for approval flow), uses SECURITY DEFINER helper
CREATE POLICY "Admin can update any profile"
  ON public.profiles FOR UPDATE
  USING (public.is_admin());


-- ============================================================
-- TABLE: parent_student_links
-- Parent requests to monitor a student account.
-- Created EARLY because several later policies reference it.
-- ============================================================
CREATE TABLE public.parent_student_links (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  student_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status      text NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'active', 'rejected')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (parent_id, student_id)
);

CREATE TRIGGER parent_student_links_updated_at
  BEFORE UPDATE ON public.parent_student_links
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.parent_student_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents see their own link requests"
  ON public.parent_student_links FOR SELECT USING (auth.uid() = parent_id);

CREATE POLICY "Students see incoming link requests"
  ON public.parent_student_links FOR SELECT USING (auth.uid() = student_id);

CREATE POLICY "Parents can create link requests"
  ON public.parent_student_links FOR INSERT WITH CHECK (auth.uid() = parent_id);

CREATE POLICY "Students can approve/reject link requests"
  ON public.parent_student_links FOR UPDATE USING (auth.uid() = student_id);


-- ============================================================
-- TABLE: courses
-- Admin-created courses. Tutors are assigned to courses.
-- ============================================================
CREATE TABLE public.courses (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title          text NOT NULL,
  subject        text NOT NULL
                 CHECK (subject IN ('Mathematics', 'Physics', 'Chemistry', 'SAT Prep', 'College Advising', 'English', 'Biology', 'Other')),
  description    text,
  tutor_id       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  thumbnail_url  text,                   -- Google Drive or CDN URL
  is_active      boolean NOT NULL DEFAULT true,
  created_by     uuid REFERENCES public.profiles(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER courses_updated_at
  BEFORE UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active courses"
  ON public.courses FOR SELECT USING (is_active = true);

CREATE POLICY "Admin can manage courses"
  ON public.courses FOR ALL
  USING (public.is_admin());


-- ============================================================
-- TABLE: tutor_availability
-- Weekly availability grid per tutor (13 hour-slots x 7 days).
-- ============================================================
CREATE TABLE public.tutor_availability (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id       uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- time_grid: 2D integer array [hour_slot][day_of_week]
  -- 0 = unavailable, 1 = online only, 2 = in-person only, 3 = both
  time_grid      integer[][] NOT NULL DEFAULT '{}',
  disabled_days  integer[]  NOT NULL DEFAULT '{}',
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tutor_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view tutor availability"
  ON public.tutor_availability FOR SELECT USING (true);

CREATE POLICY "Tutors manage their own availability"
  ON public.tutor_availability FOR ALL
  USING (auth.uid() = tutor_id);


-- ============================================================
-- TABLE: sessions
-- A booked session between a student and a tutor.
-- ============================================================
CREATE TABLE public.sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tutor_id        uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id       uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  subject         text NOT NULL,
  date            date NOT NULL,
  start_time      time NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 60,
  mode            text NOT NULL DEFAULT 'online'
                  CHECK (mode IN ('online', 'in-person', 'both')),
  zoom_link       text,                  -- Copied from tutor's profile.zoom_link at booking time
  status          text NOT NULL DEFAULT 'upcoming'
                  CHECK (status IN ('upcoming', 'completed', 'cancelled', 'no-show')),
  notes           text,                  -- Tutor's post-session notes
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER sessions_updated_at
  BEFORE UPDATE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX sessions_student_id_idx ON public.sessions(student_id);
CREATE INDEX sessions_tutor_id_idx ON public.sessions(tutor_id);
CREATE INDEX sessions_date_idx ON public.sessions(date);

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students see their own sessions"
  ON public.sessions FOR SELECT
  USING (auth.uid() = student_id);

CREATE POLICY "Tutors see their own sessions"
  ON public.sessions FOR SELECT
  USING (auth.uid() = tutor_id);

CREATE POLICY "Admin sees all sessions"
  ON public.sessions FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Students can book sessions"
  ON public.sessions FOR INSERT
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Tutors can update their sessions (notes, status)"
  ON public.sessions FOR UPDATE
  USING (auth.uid() = tutor_id);

-- Parents can see their linked student's sessions
CREATE POLICY "Parents see linked student sessions"
  ON public.sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.parent_student_links psl
      WHERE psl.parent_id = auth.uid()
        AND psl.student_id = sessions.student_id
        AND psl.status = 'active'
    )
  );


-- ============================================================
-- TABLE: assignments
-- Created by tutors, associated with a course.
-- ============================================================
CREATE TABLE public.assignments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id      uuid REFERENCES public.courses(id) ON DELETE CASCADE,
  title          text NOT NULL,
  description    text,
  due_date       timestamptz,
  template_url   text,                   -- Google Drive link to assignment template
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER assignments_updated_at
  BEFORE UPDATE ON public.assignments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tutors manage their assignments"
  ON public.assignments FOR ALL USING (auth.uid() = tutor_id);

CREATE POLICY "Students view assignments for their courses"
  ON public.assignments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.course_id = assignments.course_id
        AND s.student_id = auth.uid()
    )
  );


-- ============================================================
-- TABLE: submissions
-- Student submissions for assignments.
-- ============================================================
CREATE TABLE public.submissions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id   uuid NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  student_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  drive_url       text,                  -- Google Drive link to submission
  status          text NOT NULL DEFAULT 'submitted'
                  CHECK (status IN ('submitted', 'reviewed', 'revision_needed')),
  tutor_feedback  text,
  submitted_at    timestamptz NOT NULL DEFAULT now(),
  reviewed_at     timestamptz,
  UNIQUE (assignment_id, student_id)     -- One submission per student per assignment
);

ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students manage their own submissions"
  ON public.submissions FOR ALL USING (auth.uid() = student_id);

CREATE POLICY "Tutors view and review submissions for their assignments"
  ON public.submissions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = submissions.assignment_id AND a.tutor_id = auth.uid()
    )
  );


-- ============================================================
-- TABLE: conversations
-- A unique thread between two users (student<->tutor, student<->counselor).
-- ============================================================
CREATE TABLE public.conversations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_1   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  participant_2   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_message_at timestamptz DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  -- Ensure only one conversation between any two users
  UNIQUE (participant_1, participant_2),
  CHECK (participant_1 < participant_2)  -- Enforce canonical ordering
);

CREATE INDEX conversations_participant_1_idx ON public.conversations(participant_1);
CREATE INDEX conversations_participant_2_idx ON public.conversations(participant_2);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see their conversations"
  ON public.conversations FOR SELECT
  USING (auth.uid() = participant_1 OR auth.uid() = participant_2);

CREATE POLICY "Users can create conversations"
  ON public.conversations FOR INSERT
  WITH CHECK (auth.uid() = participant_1 OR auth.uid() = participant_2);

-- Parents can view conversations of their linked students
CREATE POLICY "Parents see linked student conversations"
  ON public.conversations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.parent_student_links psl
      WHERE psl.parent_id = auth.uid()
        AND psl.status = 'active'
        AND (psl.student_id = conversations.participant_1 OR psl.student_id = conversations.participant_2)
    )
  );


-- ============================================================
-- TABLE: messages
-- Individual text messages in a conversation.
-- ============================================================
CREATE TABLE public.messages (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id        uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  text             text NOT NULL,
  is_read          boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX messages_conversation_id_idx ON public.messages(conversation_id);
CREATE INDEX messages_sender_id_idx ON public.messages(sender_id);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can see messages in their conversations"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (c.participant_1 = auth.uid() OR c.participant_2 = auth.uid())
    )
  );

CREATE POLICY "Users can send messages in their conversations"
  ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (c.participant_1 = auth.uid() OR c.participant_2 = auth.uid())
    )
  );

CREATE POLICY "Users can mark their received messages as read"
  ON public.messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (c.participant_1 = auth.uid() OR c.participant_2 = auth.uid())
    )
  );

-- Parents can read messages in linked student conversations
CREATE POLICY "Parents can read linked student messages"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      JOIN public.parent_student_links psl ON (
        psl.parent_id = auth.uid() AND psl.status = 'active' AND
        (psl.student_id = c.participant_1 OR psl.student_id = c.participant_2)
      )
      WHERE c.id = messages.conversation_id
    )
  );


-- ============================================================
-- TABLE: notifications
-- In-app alerts for users.
-- ============================================================
CREATE TABLE public.notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type        text NOT NULL
              CHECK (type IN ('booking', 'assignment', 'approval', 'message', 'system', 'parent_link', 'application')),
  title       text NOT NULL,
  message     text NOT NULL,
  link        text,                      -- Optional in-app route to navigate to
  is_read     boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX notifications_user_id_idx ON public.notifications(user_id);
CREATE INDEX notifications_is_read_idx ON public.notifications(user_id, is_read);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see their own notifications"
  ON public.notifications FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can mark their notifications read"
  ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

-- Any authenticated user may create a notification for another user
-- (e.g. student books -> notifies tutor; parent link -> notifies student).
-- Admins may also create for anyone.
CREATE POLICY "Authenticated users can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);


-- ============================================================
-- TABLE: college_guide_applications
-- Students submit for counselor-assisted college application guidance.
-- ============================================================
CREATE TABLE public.college_guide_applications (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  counselor_id     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  program_interest text,                 -- e.g. "Computer Science at AAU"
  personal_statement text,
  documents        jsonb DEFAULT '[]',   -- Array of { name, drive_url }
  status           text NOT NULL DEFAULT 'submitted'
                   CHECK (status IN ('submitted', 'in_review', 'action_needed', 'completed')),
  counselor_notes  text,
  submitted_at     timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER college_guide_updated_at
  BEFORE UPDATE ON public.college_guide_applications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.college_guide_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students see their own applications"
  ON public.college_guide_applications FOR SELECT USING (auth.uid() = student_id);

CREATE POLICY "Students can submit applications"
  ON public.college_guide_applications FOR INSERT WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students can update their own applications"
  ON public.college_guide_applications FOR UPDATE USING (auth.uid() = student_id);

CREATE POLICY "Counselors can view and update all applications"
  ON public.college_guide_applications FOR ALL
  USING (public.is_counselor());

CREATE POLICY "Admin can view all applications"
  ON public.college_guide_applications FOR SELECT
  USING (public.is_admin());

-- Parents can view their linked student's applications
CREATE POLICY "Parents can view linked student applications"
  ON public.college_guide_applications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.parent_student_links psl
      WHERE psl.parent_id = auth.uid()
        AND psl.student_id = college_guide_applications.student_id
        AND psl.status = 'active'
    )
  );


-- ============================================================
-- ENABLE REALTIME for messaging & notifications
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;

SELECT 'Schema created successfully. Run db_seed.sql next.' AS status;
