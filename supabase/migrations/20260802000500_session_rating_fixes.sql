-- ============================================================
-- Rating a session you have just had.
--
-- Two problems, one visible and one waiting.
--
-- The visible one: the insert policy read (date + start_time) as if it were
-- UTC, while every screen builds the same pair as a local wall clock. In a
-- timezone ahead of UTC that leaves a window hours wide where the page offers
-- "Rate" and the database refuses it, and what the student sees is the raw
-- row-level security error.
--
-- Sessions have no timezone stored, so the database genuinely cannot know when
-- one happened to the minute. That makes this check the wrong place to be
-- precise: its job is to stop somebody rating a lesson that has not happened
-- at all, not to police the exact minute. It gets a tolerance wide enough to
-- cover any real timezone, and the page keeps doing the precise part, because
-- the browser is the only side that knows what time it is for the student.
--
-- The waiting one: a rating had a number and nowhere to say why. A tutor
-- reading a three is owed the sentence that goes with it.
-- ============================================================

ALTER TABLE public.session_ratings
  ADD COLUMN IF NOT EXISTS comment text;

COMMENT ON COLUMN public.session_ratings.comment IS
  'Optional note from the student. A number on its own tells a tutor something went wrong but not what.';

DROP POLICY IF EXISTS "students rate their own finished sessions" ON public.session_ratings;

CREATE POLICY "students rate their own finished sessions" ON public.session_ratings
  FOR INSERT WITH CHECK (
    rated_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = session_ratings.session_id
        AND s.student_id = auth.uid()
        AND s.tutor_id = session_ratings.ratee_id
        -- The day, not the minute. A lesson booked for today can be rated
        -- whatever the student's offset, because the date is the same on both
        -- clocks for all but the last hours of the day; a lesson booked for
        -- tomorrow cannot be rated at all. The page still decides the minute,
        -- because the browser is the only side that knows the student's time.
        AND s.date <= (now() AT TIME ZONE 'UTC')::date
    )
  );
