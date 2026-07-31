-- ============================================================
-- Allow 'unlock_request' as a notification type.
--
-- When a student asks a parent to turn a service on, the parent's inbox offers
-- a one-click grant. It needs to tell that notification apart from ordinary
-- system messages, and the type column is where that belongs. Without this the
-- insert fails the check constraint and the request is silently lost.
-- ============================================================

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check CHECK (
    type = ANY (ARRAY[
      'booking'::text,
      'assignment'::text,
      'approval'::text,
      'message'::text,
      'system'::text,
      'parent_link'::text,
      'application'::text,
      'unlock_request'::text
    ])
  );
