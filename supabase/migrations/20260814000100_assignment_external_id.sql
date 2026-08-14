-- ============================================================
-- The bridge between a Google Classroom assignment and a native Yakal one.
--
-- Classroom owns the assignment definitions (the Classroom-first decision), read
-- live by api/_handlers/classroom.ts. But a student's turn-in and a tutor's
-- grade are native rows in public.submissions, and those key on an
-- assignments.id. Without a stable link, work written in Classroom had no local
-- row to attach a submission or a grade to, and the read-through reconciled
-- Classroom against native rows by matching a URL, which is brittle.
--
-- external_id is the Classroom courseWork id. topic_id/topic_name denormalise the
-- Classroom topic so a native query can group by unit without a live Google
-- read. All additive and nullable: a purely Yakal-authored assignment leaves
-- them null, which is why the unique index below is on the non-null pairs only
-- (Postgres treats the nulls as distinct, so many Yakal rows coexist).
-- ============================================================

ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS topic_id text,
  ADD COLUMN IF NOT EXISTS topic_name text;

COMMENT ON COLUMN public.assignments.external_id IS
  'The Google Classroom courseWork id this row mirrors, or null for a Yakal-authored assignment. Unique per course so the read-through can upsert on it.';
COMMENT ON COLUMN public.assignments.topic_id IS
  'The Classroom topic id this work is filed under, denormalised from the read-through. Null when the teacher filed it under no topic.';

-- One native row per Classroom assignment per course. Nulls are distinct in a
-- Postgres unique index, so the many Yakal-authored rows (external_id null) do
-- not collide, and ON CONFLICT (course_id, external_id) in the upsert matches
-- this index for the Classroom-mirrored rows that do carry one.
CREATE UNIQUE INDEX IF NOT EXISTS assignments_course_external_id
  ON public.assignments (course_id, external_id);
