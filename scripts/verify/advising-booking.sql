-- Booking advising hours.
--
-- Run: psql "$LOCAL_DB" -v ON_ERROR_STOP=1 -f scripts/verify/advising-booking.sql
--
-- Builds its own family, counsellor, tier and plan, and rolls the lot back.
-- An earlier version borrowed a seeded student and passed until somebody
-- booked an hour through the app, which spent the allowance it was counting
-- on. A suite that depends on shared state fails on the day the feature works.

\set ON_ERROR_STOP on
BEGIN;

-- ---- fixture ----
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
VALUES
  ('a0000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','verify.parent@yakal.test','x',now(),now(),now(),'{}','{}'),
  ('a0000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','verify.child@yakal.test','x',now(),now(),now(),'{}','{}'),
  ('a0000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','verify.adviser@yakal.test','x',now(),now(),now(),'{}','{}'),
  ('a0000000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','verify.outsider@yakal.test','x',now(),now(),now(),'{}','{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, email, full_name, role, status, is_onboarded)
VALUES
  ('a0000000-0000-4000-8000-000000000001','verify.parent@yakal.test','Verify Parent','parent','active',true),
  ('a0000000-0000-4000-8000-000000000002','verify.child@yakal.test','Verify Child','student','active',true),
  ('a0000000-0000-4000-8000-000000000003','verify.adviser@yakal.test','Verify Adviser','counselor','active',true),
  ('a0000000-0000-4000-8000-000000000004','verify.outsider@yakal.test','Verify Outsider','parent','active',true)
ON CONFLICT (id) DO UPDATE SET status = 'active';

INSERT INTO public.parent_student_links (parent_id, student_id, status)
VALUES ('a0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000002','active')
ON CONFLICT DO NOTHING;

-- Two hours a month, so the ceiling is reachable in one test.
INSERT INTO public.admissions_tiers (key, name, price_cents, sessions_per_month, is_active, sort_order)
VALUES ('verify_tier','Verify tier', 100000, 2, false, 99)
RETURNING id AS tier \gset

INSERT INTO public.admissions_plans (student_id, tier_id, counselor_id, status)
VALUES ('a0000000-0000-4000-8000-000000000002', :'tier',
        'a0000000-0000-4000-8000-000000000003', 'active');

-- psql variables do not reach inside a DO block, so ids travel as settings.
SELECT set_config('yakal.student', 'a0000000-0000-4000-8000-000000000002', true);

CREATE OR REPLACE FUNCTION pg_temp.expect_failure(p_sql text, p_what text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  RAISE EXCEPTION 'expected % to be refused, it was allowed', p_what;
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE 'expected %' THEN RAISE; END IF;
  RAISE NOTICE 'ok    % is refused (%)', p_what, SQLERRM;
END $$;

-- Next month, so a real booking made through the app this month cannot
-- collide with the fixture.
SELECT set_config('yakal.day', (date_trunc('month', current_date) + interval '1 month' + interval '9 days')::date::text, true);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

-- 1. A linked parent can book.
DO $$
DECLARE v_id uuid;
BEGIN
  SELECT public.book_advising_session(current_setting('yakal.student')::uuid,
    current_setting('yakal.day')::date, '10:00') INTO v_id;
  IF v_id IS NULL THEN RAISE EXCEPTION 'booking returned nothing'; END IF;
  RAISE NOTICE 'ok    a linked parent can book';
END $$;

-- 2. Nothing in the past.
SELECT pg_temp.expect_failure(
  format('SELECT public.book_advising_session(%L, %L, %L)',
         current_setting('yakal.student'), (current_date - 1), '10:00'),
  'a slot in the past');

-- 3. The counsellor cannot be in two places at once.
SELECT pg_temp.expect_failure(
  format('SELECT public.book_advising_session(%L, %L, %L)',
         current_setting('yakal.student'), current_setting('yakal.day'), '10:00'),
  'an hour the counsellor already holds');

-- 4. The allowance is a ceiling: the second of two lands, the third does not.
DO $$
BEGIN
  PERFORM public.book_advising_session(current_setting('yakal.student')::uuid,
    (current_setting('yakal.day')::date + 1), '11:00');
  RAISE NOTICE 'ok    the second of two lands';
END $$;

SELECT pg_temp.expect_failure(
  format('SELECT public.book_advising_session(%L, %L, %L)',
         current_setting('yakal.student'), (current_setting('yakal.day')::date + 2), '12:00'),
  'a booking past the monthly allowance');

-- 5. Somebody else's child is not bookable. The function runs as its owner, so
--    without this check it would write whatever it was asked to.
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-4000-8000-000000000004","role":"authenticated"}', true);

SELECT pg_temp.expect_failure(
  format('SELECT public.book_advising_session(%L, %L, %L)',
         current_setting('yakal.student'), (current_setting('yakal.day')::date + 20), '09:00'),
  'booking for a student who is not yours');

-- 6. The allowance refills: next month is bookable again.
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

DO $$
BEGIN
  PERFORM public.book_advising_session(current_setting('yakal.student')::uuid,
    (current_setting('yakal.day')::date + 32), '10:00');
  RAISE NOTICE 'ok    the allowance refills the following month';
END $$;

-- 7. Releasing an hour hands the allowance back, so a spent month can still
--    be rearranged. This is what makes Change slots more than a dead button.
DO $$
DECLARE v_session uuid;
BEGIN
  SELECT id INTO v_session FROM public.sessions
  WHERE student_id = current_setting('yakal.student')::uuid
    AND kind = 'advising' AND status = 'upcoming'
    AND date = current_setting('yakal.day')::date;

  PERFORM public.cancel_advising_session(v_session);
  RAISE NOTICE 'ok    an upcoming hour can be released';

  PERFORM public.book_advising_session(current_setting('yakal.student')::uuid,
    (current_setting('yakal.day')::date + 3), '14:00');
  RAISE NOTICE 'ok    the freed allowance can be spent again';
END $$;

-- 8. Somebody else cannot release your hour.
--
-- The id is looked up before the role switch. Read as the outsider it comes
-- back null, the function answers "No such session", and the check passes
-- without ever exercising the ownership test it is named after.
RESET ROLE;
SELECT set_config('yakal.session',
  (SELECT id::text FROM public.sessions
    WHERE student_id = current_setting('yakal.student')::uuid
      AND kind = 'advising' AND status = 'upcoming' LIMIT 1), true);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-4000-8000-000000000004","role":"authenticated"}', true);

SELECT pg_temp.expect_failure(
  format('SELECT public.cancel_advising_session(%L)', current_setting('yakal.session')),
  'releasing a session that is not yours');

RESET ROLE;
ROLLBACK;
