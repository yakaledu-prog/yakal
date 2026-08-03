-- Counsellor assignment and isolation.
--
-- Run: psql "$LOCAL_DB" -v ON_ERROR_STOP=1 -f scripts/verify/counselor-assignment.sql
--
-- Everything happens inside one transaction and is rolled back, so this is
-- safe against a database you care about. ON_ERROR_STOP matters: without it
-- psql exits 0 even when a statement failed, and every assertion below would
-- pass by not running.

\set ON_ERROR_STOP on
BEGIN;

-- Two counsellors, so "a counsellor can see it" and "this counsellor can see
-- it" stop being the same sentence.
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
VALUES
  ('c0000000-0000-4000-8000-00000000000a','00000000-0000-0000-0000-000000000000',
   'authenticated','authenticated','verify.counselor.a@yakal.test','x',now(),now(),now(),'{}','{}'),
  ('c0000000-0000-4000-8000-00000000000b','00000000-0000-0000-0000-000000000000',
   'authenticated','authenticated','verify.counselor.b@yakal.test','x',now(),now(),now(),'{}','{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, email, full_name, role, status, is_onboarded)
VALUES
  ('c0000000-0000-4000-8000-00000000000a','verify.counselor.a@yakal.test','Verify Counselor A','counselor','active',true),
  ('c0000000-0000-4000-8000-00000000000b','verify.counselor.b@yakal.test','Verify Counselor B','counselor','active',true)
ON CONFLICT (id) DO UPDATE SET role='counselor', status='active';

-- A student with a plan belonging to A.
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
VALUES ('50000000-0000-4000-8000-00000000000a','00000000-0000-0000-0000-000000000000',
        'authenticated','authenticated','verify.student@yakal.test','x',now(),now(),now(),'{}','{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, email, full_name, role, status, is_onboarded)
VALUES ('50000000-0000-4000-8000-00000000000a','verify.student@yakal.test','Verify Student','student','active',true)
ON CONFLICT (id) DO UPDATE SET role='student', status='active';

INSERT INTO public.admissions_plans (student_id, tier_id, counselor_id, status)
SELECT '50000000-0000-4000-8000-00000000000a', t.id,
       'c0000000-0000-4000-8000-00000000000a', 'active'
FROM public.admissions_tiers t ORDER BY t.sort_order LIMIT 1;

INSERT INTO public.college_guide_applications (student_id, counselor_id)
VALUES ('50000000-0000-4000-8000-00000000000a','c0000000-0000-4000-8000-00000000000a');

-- 1. Least loaded picks somebody carrying the fewest live plans.
--
-- Asserted as a property rather than a name. Naming the expected counsellor
-- only worked against a database that happened to have the seeded one already
-- loaded up; on a fresh one every counsellor has nothing and the tie goes to
-- whoever joined first, which is correct and would have failed the test.
DO $$
DECLARE
  v_pick uuid;
  v_picked_load int;
  v_min_load int;
BEGIN
  SELECT public.next_counselor() INTO v_pick;
  IF v_pick IS NULL THEN
    RAISE EXCEPTION 'next_counselor() returned nothing with active counsellors present';
  END IF;

  WITH load AS (
    SELECT p.id, count(ap.id) AS n
    FROM public.profiles p
    LEFT JOIN public.admissions_plans ap
      ON ap.counselor_id = p.id AND ap.status IN ('active','past_due')
    WHERE p.role = 'counselor' AND p.status = 'active'
    GROUP BY p.id
  )
  SELECT (SELECT n FROM load WHERE id = v_pick), (SELECT min(n) FROM load)
  INTO v_picked_load, v_min_load;

  IF v_picked_load <> v_min_load THEN
    RAISE EXCEPTION 'next_counselor() chose one carrying % plans, the lightest carries %',
      v_picked_load, v_min_load;
  END IF;
  RAISE NOTICE 'ok    least loaded counsellor is chosen';
END $$;

-- 2. The assigned counsellor sees the student's application.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"c0000000-0000-4000-8000-00000000000a","role":"authenticated"}';
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.college_guide_applications
  WHERE student_id = '50000000-0000-4000-8000-00000000000a';
  IF n <> 1 THEN RAISE EXCEPTION 'assigned counsellor sees % applications, expected 1', n; END IF;
  RAISE NOTICE 'ok    assigned counsellor sees the application';
END $$;

-- 3. The other counsellor sees nothing. This is the whole point: before this
--    migration is_counselor() alone let anyone with the role read every
--    personal statement in the product.
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"c0000000-0000-4000-8000-00000000000b","role":"authenticated"}';
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.college_guide_applications
  WHERE student_id = '50000000-0000-4000-8000-00000000000a';
  IF n <> 0 THEN RAISE EXCEPTION 'unassigned counsellor sees % applications, expected 0', n; END IF;
  RAISE NOTICE 'ok    unassigned counsellor sees no application';
END $$;

-- 4. And cannot write to it either.
DO $$
DECLARE n int;
BEGIN
  UPDATE public.college_guide_applications
  SET counselor_notes = 'should not land'
  WHERE student_id = '50000000-0000-4000-8000-00000000000a';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'unassigned counsellor updated % rows, expected 0', n; END IF;
  RAISE NOTICE 'ok    unassigned counsellor cannot write';
END $$;

-- 5. Plans are separated the same way.
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.admissions_plans
  WHERE student_id = '50000000-0000-4000-8000-00000000000a';
  IF n <> 0 THEN RAISE EXCEPTION 'unassigned counsellor sees % plans, expected 0', n; END IF;
  RAISE NOTICE 'ok    unassigned counsellor sees no plan';
END $$;

-- 6. The family still sees their own plan, counsellor or not.
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"50000000-0000-4000-8000-00000000000a","role":"authenticated"}';
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.admissions_plans
  WHERE student_id = '50000000-0000-4000-8000-00000000000a';
  IF n <> 1 THEN RAISE EXCEPTION 'the student sees % of their own plans, expected 1', n; END IF;
  RAISE NOTICE 'ok    the student still sees their own plan';
END $$;

RESET ROLE;
ROLLBACK;
