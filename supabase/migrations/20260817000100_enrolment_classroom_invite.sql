-- When we invited this student to the course's Google Classroom.
--
-- Google cannot answer this. courses.invitations.list returns a class's pending
-- invitations, but filtering it by userId with an email address matches
-- nothing, and the invitations it does return carry no userId at all, so there
-- is no way to ask "does this student have an invitation outstanding". The only
-- thing Classroom answers reliably is whether somebody has already joined.
--
-- So we remember what we sent. Joined still comes from Google, because that is
-- the fact that matters and only Google knows it; invited comes from here.
--
-- Null means we have never sent one, which is what shows a student the button
-- to send it. An invitation added by hand inside Classroom is invisible to
-- this, and self-heals: sending again returns ALREADY_EXISTS, which is treated
-- as success and stamps the column.
ALTER TABLE public.enrolments
  ADD COLUMN IF NOT EXISTS classroom_invited_at timestamptz;

COMMENT ON COLUMN public.enrolments.classroom_invited_at IS
  'When a Google Classroom invitation was last sent for this enrolment. Google cannot be asked this, so it is recorded here.';
