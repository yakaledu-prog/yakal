-- ============================================================
-- YAKAL — Counseling / College Admissions schema
-- Run ONCE in the Supabase SQL Editor (idempotent, safe to re-run).
-- Adds the college-admissions data model on top of the existing
-- (legacy) college_guide_applications record.
-- ============================================================

-- ── 0. Extend the existing per-student journey record ───────
-- college_guide_applications already exists (student_id, counselor_id,
-- program_interest, personal_statement, documents, status, counselor_notes).
-- Add the overall application stage and graduation year.
ALTER TABLE public.college_guide_applications
  ADD COLUMN IF NOT EXISTS stage      text NOT NULL DEFAULT 'research',
  ADD COLUMN IF NOT EXISTS grad_year  integer;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cga_stage_check') THEN
    ALTER TABLE public.college_guide_applications
      ADD CONSTRAINT cga_stage_check
      CHECK (stage IN ('research', 'apply', 'submitted', 'decisions', 'enrolled'));
  END IF;
END $$;

-- ── 1. College list (schools a student is considering) ──────
CREATE TABLE IF NOT EXISTS public.college_list_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  school_name text NOT NULL,
  tier        text NOT NULL DEFAULT 'target'
              CHECK (tier IN ('dream', 'target', 'safety')),
  deadline    date,
  status      text NOT NULL DEFAULT 'considering'
              CHECK (status IN ('considering', 'applying', 'submitted', 'accepted', 'rejected', 'waitlisted')),
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS college_list_items_student_idx ON public.college_list_items(student_id);

-- ── 2. Per-school application requirement checklist ─────────
CREATE TABLE IF NOT EXISTS public.application_requirements (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  college_list_item_id  uuid NOT NULL REFERENCES public.college_list_items(id) ON DELETE CASCADE,
  label                 text NOT NULL,
  is_complete           boolean NOT NULL DEFAULT false,
  due_date              date,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS application_requirements_item_idx ON public.application_requirements(college_list_item_id);

-- ── 3. Essays ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.essays (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id           uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title                text NOT NULL,
  kind                 text NOT NULL DEFAULT 'supplement'
                       CHECK (kind IN ('personal_statement', 'supplement')),
  college_list_item_id uuid REFERENCES public.college_list_items(id) ON DELETE SET NULL,
  status               text NOT NULL DEFAULT 'todo'
                       CHECK (status IN ('todo', 'drafting', 'in_review', 'done')),
  content              text,
  drive_url            text,
  due_date             date,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS essays_student_idx ON public.essays(student_id);

-- ── 4. Academics (one row per student) ──────────────────────
CREATE TABLE IF NOT EXISTS public.student_academics (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id   uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  gpa          numeric(4, 2),
  gpa_scale    numeric(4, 2) DEFAULT 4.0,
  sat_score    integer,
  act_score    integer,
  toefl_score  integer,
  ap_courses   text[],
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ── 5. Recommendation requests ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.recommendations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id        uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recommender_name  text NOT NULL,
  recommender_email text,
  relationship      text,
  status            text NOT NULL DEFAULT 'requested'
                    CHECK (status IN ('requested', 'received', 'submitted')),
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS recommendations_student_idx ON public.recommendations(student_id);

-- ── 6. General application tasks (not tied to a school) ─────
CREATE TABLE IF NOT EXISTS public.application_tasks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title       text NOT NULL,
  status      text NOT NULL DEFAULT 'todo'
              CHECK (status IN ('todo', 'in_progress', 'done')),
  due_date    date,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS application_tasks_student_idx ON public.application_tasks(student_id);

-- ── updated_at triggers (reuse existing public.set_updated_at) ──
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'college_list_items', 'application_requirements', 'essays',
    'student_academics', 'recommendations', 'application_tasks'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_updated_at ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER %I_updated_at BEFORE UPDATE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t, t);
  END LOOP;
END $$;

SELECT 'Counseling schema ready.' AS status;
