-- What a family has actually bought, separated from what a parent permits.
--
-- child_services.is_active had three writers and two meanings, and they could
-- disagree:
--
--   * fulfil.ts turned "admissions" on when an admissions invoice was paid
--   * a parent turned either on or off by hand
--   * an invite turned on whatever the parent picked when inviting
--
-- So the one boolean answered both "has this been paid for" and "may my child
-- see this", and a hand-set value could contradict the billing record. Buying a
-- course granted nothing at all, because nothing anywhere ever wrote
-- "tutoring": that switch could only ever be flipped by hand.
--
-- The split from here:
--
--   entitlement  derived, never stored. Comes from enrolments and
--                admissions_plans, which are written by the Stripe webhook.
--                Payment is the only thing that creates it.
--   permission   child_services.is_active, which is what it has always
--                effectively been: the parent saying their child may see this.
--
-- A student sees a service when both are true. That keeps the parental control
-- the app already has, including the "request access" flow, while making it
-- impossible for a toggle to hand out something nobody paid for.

CREATE OR REPLACE VIEW public.v_student_entitlements AS
SELECT DISTINCT
  e.student_id,
  'tutoring'::text AS service
FROM public.enrolments e
WHERE e.status = 'active'
UNION
SELECT DISTINCT
  p.student_id,
  'admissions'::text AS service
FROM public.admissions_plans p
WHERE p.status = 'active';

-- Not security_invoker on purpose. A student must be able to see that they are
-- entitled to something without being able to read the enrolment and plan rows
-- it is derived from, which carry the invoice and who paid.
REVOKE ALL ON public.v_student_entitlements FROM anon, authenticated;
GRANT SELECT ON public.v_student_entitlements TO authenticated;

COMMENT ON VIEW public.v_student_entitlements IS
  'Services a student has paid access to. Derived from enrolments and '
  'admissions_plans. child_services.is_active is the parent permitting it; a '
  'student needs both.';
