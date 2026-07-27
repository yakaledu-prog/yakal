-- Application tracker: derived requirements, essays, recommenders.
--
-- The tracker previously stored a college's completed requirements as a JSON
-- array crammed into college_list_items.notes, with the defaults picked by
-- matching on school name. This gives each fact a real home.
--
-- Safe to run more than once.

-- ---------------------------------------------------------------------------
-- 1. Student-level financial aid forms
--
-- FAFSA and the CSS Profile are filed once and count for every college, so they
-- belong on the umbrella application record rather than being re-ticked per
-- college. The matrix derives all eight per-college cells from these.
-- ---------------------------------------------------------------------------
alter table college_guide_applications
  add column if not exists fafsa_submitted boolean not null default false,
  add column if not exists fafsa_submitted_at date,
  add column if not exists css_submitted boolean not null default false,
  add column if not exists css_submitted_at date;

-- ---------------------------------------------------------------------------
-- 2. Recommenders
--
-- Tracks people and progress, not files. For US colleges the letter goes
-- straight from the recommender to Common App: the student never holds it, and
-- normally waives the right to read it, because a non-waived letter carries
-- less weight. The old "paste the Drive link to the signed letter" field
-- modelled the wrong workflow.
-- ---------------------------------------------------------------------------
alter table recommendations
  add column if not exists asked_on date,
  add column if not exists invited_on date,
  add column if not exists submitted_on date,
  add column if not exists ferpa_waived boolean not null default false,
  add column if not exists thank_you_sent boolean not null default false,
  -- Kept for the exceptions only: some scholarships and non-US systems do want
  -- an actual file. It must never be the default path.
  add column if not exists letter_url text;

comment on column recommendations.letter_url is
  'Exception path only. US college letters are submitted by the recommender '
  'directly to Common App and are never handled by the student.';

create index if not exists rec_outstanding_idx
  on recommendations (student_id)
  where status <> 'submitted';

-- ---------------------------------------------------------------------------
-- 3. Documents stored in Yakal's Shared Drive
--
-- Only metadata lives here. The bytes stay in Drive, written by a service
-- account, so the counselor can open a transcript without the student having
-- to share it from a school-managed Google account that often forbids it.
-- ---------------------------------------------------------------------------
create table if not exists student_documents (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null,
  kind          text not null check (kind in
                  ('transcript', 'test_score', 'essay', 'recommendation', 'other')),
  drive_file_id text not null,
  name          text not null,
  mime_type     text,
  web_view_link text,
  size_bytes    bigint,
  uploaded_by   uuid,
  created_at    timestamptz not null default now(),
  unique (student_id, drive_file_id)
);

create index if not exists student_documents_kind_idx
  on student_documents (student_id, kind);

-- ---------------------------------------------------------------------------
-- 4. Essay rounds
--
-- The tiers sell a number of feedback rounds ("up to 6 personal statement
-- rounds"), so a round has to be a countable thing rather than a status label.
-- ---------------------------------------------------------------------------
alter table essays
  add column if not exists rounds_used smallint not null default 0,
  add column if not exists last_feedback_at timestamptz,
  add column if not exists word_limit smallint,
  add column if not exists prompt text;

-- ---------------------------------------------------------------------------
-- 5. Retire the notes-as-JSON hack
--
-- college_list_items.notes held a JSON array of completed requirement labels.
-- application_requirements already exists for exactly this, one row per
-- override, so the tracker now writes there instead. Nothing is dropped here:
-- inspect and clear the old values by hand once you are satisfied.
-- ---------------------------------------------------------------------------
-- select id, school_name, notes from college_list_items where notes like '[%';
