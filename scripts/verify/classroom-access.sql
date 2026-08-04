-- Who may read a course's Classroom work.
--
-- Run: psql "$LOCAL_DB" -v ON_ERROR_STOP=1 -f scripts/verify/classroom-access.sql
--
-- api/_handlers/classroom.ts answers with a credential that can read every
-- class Yakal owns, so the only thing standing between one family and another
-- family's classroom is the entitlement check. This asserts the four
-- relationships that check is built on, against the same tables it reads.
--
-- Rolled back at the end, so it is safe against a database you care about.

\set ON_ERROR_STOP on
BEGIN;

-- ---- fixture: two courses, two families, one tutor each ----
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
VALUES
  ('e0000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','vc.tutor@yakal.test','x',now(),now(),now(),'{}','{}'),
  ('e0000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','vc.student@yakal.test','x',now(),now(),now(),'{}','{}'),
  ('e0000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','vc.parent@yakal.test','x',now(),now(),now(),'{}','{}'),
  ('e0000000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','vc.stranger@yakal.test','x',now(),now(),now(),'{}','{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, email, full_name, role, status, is_onboarded)
VALUES
  ('e0000000-0000-4000-8000-000000000001','vc.tutor@yakal.test','VC Tutor','tutor','active',true),
  ('e0000000-0000-4000-8000-000000000002','vc.student@yakal.test','VC Student','student','active',true),
  ('e0000000-0000-4000-8000-000000000003','vc.parent@yakal.test','VC Parent','parent','active',true),
  ('e0000000-0000-4000-8000-000000000004','vc.stranger@yakal.test','VC Stranger','parent','active',true)
ON CONFLICT (id) DO UPDATE SET status = 'active';

INSERT INTO public.parent_student_links (parent_id, student_id, status)
VALUES ('e0000000-0000-4000-8000-000000000003','e0000000-0000-4000-8000-000000000002','active')
ON CONFLICT DO NOTHING;

INSERT INTO public.courses (title, subject, tutor_id, is_active, google_classroom_url)
VALUES ('VC Course', 'Other', 'e0000000-0000-4000-8000-000000000001', true,
        'https://classroom.google.com/c/Nzg5NDU2MTIz')
RETURNING id AS course \gset

INSERT INTO public.enrolments (course_id, student_id, purchased_by)
VALUES (:'course', 'e0000000-0000-4000-8000-000000000002',
        'e0000000-0000-4000-8000-000000000003');

SELECT set_config('yakal.course', :'course', true);

-- The same four questions api/_handlers/classroom.ts asks, in the same order.
CREATE OR REPLACE FUNCTION pg_temp.may_read(p_user uuid, p_course uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT
    EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user AND role = 'admin')
    OR EXISTS (SELECT 1 FROM public.courses WHERE id = p_course AND tutor_id = p_user)
    OR EXISTS (SELECT 1 FROM public.enrolments
                WHERE course_id = p_course AND student_id = p_user)
    OR EXISTS (SELECT 1 FROM public.enrolments e
                 JOIN public.parent_student_links l
                   ON l.student_id = e.student_id
                  AND l.parent_id = p_user
                  AND l.status = 'active'
                WHERE e.course_id = p_course);
$$;

CREATE OR REPLACE FUNCTION pg_temp.expect(p_user uuid, p_allowed boolean, p_who text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_got boolean;
BEGIN
  SELECT pg_temp.may_read(p_user, current_setting('yakal.course')::uuid) INTO v_got;
  IF v_got <> p_allowed THEN
    RAISE EXCEPTION '% should be %, got %', p_who,
      CASE WHEN p_allowed THEN 'allowed' ELSE 'refused' END, v_got;
  END IF;
  RAISE NOTICE 'ok    % is %', p_who,
    CASE WHEN p_allowed THEN 'allowed' ELSE 'refused' END;
END $$;

SELECT pg_temp.expect(
  (SELECT id FROM public.profiles WHERE role = 'admin' LIMIT 1), true, 'an admin');
SELECT pg_temp.expect('e0000000-0000-4000-8000-000000000001', true, 'the tutor teaching it');
SELECT pg_temp.expect('e0000000-0000-4000-8000-000000000002', true, 'an enrolled student');
SELECT pg_temp.expect('e0000000-0000-4000-8000-000000000003', true, 'their linked parent');

-- The one that matters. A parent of somebody else's child, signed in and
-- perfectly legitimate, naming a course id they were not sold.
SELECT pg_temp.expect('e0000000-0000-4000-8000-000000000004', false, 'a stranger');

-- A parent whose link has lapsed loses it too.
UPDATE public.parent_student_links SET status = 'rejected'
WHERE parent_id = 'e0000000-0000-4000-8000-000000000003';
SELECT pg_temp.expect('e0000000-0000-4000-8000-000000000003', false, 'a parent whose link was rejected');

-- And a student who is no longer enrolled.
UPDATE public.parent_student_links SET status = 'active'
WHERE parent_id = 'e0000000-0000-4000-8000-000000000003';
DELETE FROM public.enrolments WHERE course_id = current_setting('yakal.course')::uuid;
SELECT pg_temp.expect('e0000000-0000-4000-8000-000000000002', false, 'a student no longer enrolled');
SELECT pg_temp.expect('e0000000-0000-4000-8000-000000000003', false, 'their parent, once the enrolment is gone');
SELECT pg_temp.expect('e0000000-0000-4000-8000-000000000001', true, 'the tutor, who still teaches it');

ROLLBACK;
