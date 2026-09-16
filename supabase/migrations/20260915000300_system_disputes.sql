-- A report can be raised by the scheduled job, with nobody as its author.
--
-- When the evidence says a tutor never joined a lesson somebody attended, the job
-- holds the tutor's earning. A held earning is only visible to an admin through
-- an open report (v_open_disputes), so the job opens one. It has no person to
-- name: writing the student in raised_by would tell the admin the family
-- complained when they did not, and naming an admin would be just as untrue.
--
-- Null means the check raised it. Resolving one works as for any report: the
-- verdict path already leaves a null raiser out of the people it tells.

ALTER TABLE public.session_disputes
  ALTER COLUMN raised_by DROP NOT NULL;

COMMENT ON COLUMN public.session_disputes.raised_by IS
  'Who reported it. Null when the scheduled attendance check raised it.';
