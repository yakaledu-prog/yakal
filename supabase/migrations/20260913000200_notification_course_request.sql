-- A student asking a parent to book a course is a notification type.
--
-- notifications.type is checked against a fixed list. The send path reports
-- failures rather than throwing, so a type outside the list is written,
-- refused, and nobody hears about it: no row, no email, nothing in the logs.
--
-- The list has to be copied from the most recent migration that defines it,
-- which is 20260827000100_session_disputes.sql, not from whichever one turns
-- up first. Drafting this from 20260810000100 silently dropped
-- session_cancelled and session_disputed, both added after it;
-- scripts/verify/notification-templates.ts reads the constraint out of the
-- running database and is what noticed.
--
-- Its own type rather than reusing unlock_request, which is the closest thing
-- and the model for the wording. The parent's notification screen parses an
-- unlock_request's link for ?student= and ?service= to offer a one-click grant
-- (ParentNotifications.tsx), and a course link carries a course id and no
-- service key, so sharing the type would feed that parser something it cannot
-- read.

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check CHECK (type IN (
    'booking', 'assignment', 'approval', 'message', 'system', 'parent_link',
    'application', 'unlock_request', 'course_application',
    'course_application_decided', 'enrolment', 'admissions_plan',
    'essay_review', 'payout', 'message_report', 'session_moved',
    'session_cancelled', 'session_disputed', 'course_request'
  ));
