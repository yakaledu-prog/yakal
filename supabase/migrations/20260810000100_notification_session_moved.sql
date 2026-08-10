-- A moved session is a notification type.
--
-- The type column is checked against a fixed list, and an insert with a type
-- outside it fails. The send path reports failures rather than throwing, so
-- without this the reschedule notification would be written, refused, and
-- nobody would hear about it: exactly the silence this is meant to fix.

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check CHECK (
    type = ANY (ARRAY[
      'booking', 'assignment', 'approval', 'message', 'system',
      'parent_link', 'application', 'unlock_request',
      'course_application', 'course_application_decided',
      'enrolment', 'admissions_plan', 'essay_review', 'payout',
      'message_report', 'session_moved'
    ]::text[])
  );
