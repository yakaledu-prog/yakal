-- The FERPA release, which is one decision and gates everything after it.
--
-- Common App asks a student once whether they waive their right to read their
-- recommendation letters, and the release applies to every college and every
-- recommender. Until it is completed the student cannot invite anybody at all,
-- so a student who has not done it has a recommendations page that quietly
-- cannot move, and neither they nor their counselor is told why.
--
-- recommendations.ferpa_waived already exists and is the wrong shape for this.
-- It is per row, and the release has to be recorded BEFORE any recommender
-- exists, so with an empty list there is no row to put it on. That column stays
-- where it is, unused by any screen; this is the student-level fact.
--
-- student_academics is one row per student and already carries the other
-- student-level application facts, with RLS for the student and their assigned
-- counselor from 20260831000100. Nothing new to grant.
alter table public.student_academics
  add column if not exists ferpa_released_on date;

comment on column public.student_academics.ferpa_released_on is
  'Date the student completed the FERPA Release Authorization in Common App. '
  'Self-reported: Common App exposes no API, so Yakal cannot verify it.';
