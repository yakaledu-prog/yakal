-- What a tutor is rated, without exposing who said what.
--
-- session_ratings is readable only by the people in the session: the student
-- who wrote it, the tutor, that student's parents, and admins. That is right
-- for a comment somebody wrote about a lesson, and it also means a parent
-- choosing between tutors cannot read enough rows to work out an average.
--
-- So the aggregate gets its own view. Deliberately not security_invoker, so it
-- runs as its owner and can count rows the caller may not read, and it selects
-- only the average and the count. No comment, no reviewer, no session.
--
-- Tutor cards showed a hardcoded 4.8 before this. A number that is the same
-- for everybody is worse than no number: it looks like data and decides
-- nothing.

CREATE OR REPLACE VIEW public.v_tutor_ratings AS
SELECT
  r.ratee_id AS tutor_id,
  -- One decimal place. Two implies a precision that twelve ratings do not have.
  round(avg(r.stars)::numeric, 1) AS average_stars,
  count(*)::int AS rating_count
FROM public.session_ratings r
GROUP BY r.ratee_id;

REVOKE ALL ON public.v_tutor_ratings FROM anon, authenticated;
GRANT SELECT ON public.v_tutor_ratings TO anon, authenticated;

-- The marketing page draws the same cards, so it gets the same numbers.
-- Columns are appended, which CREATE OR REPLACE allows; changing or reordering
-- the existing ones would need a DROP and would break anything mid-query.
CREATE OR REPLACE VIEW public.v_public_tutors AS
SELECT
  p.id,
  p.full_name,
  p.avatar_url,
  p.bio,
  p.subjects,
  -- Null rather than zero when nobody has rated them. Zero would draw an empty
  -- five stars, which reads as "rated badly" rather than "not rated yet".
  tr.average_stars,
  coalesce(tr.rating_count, 0) AS rating_count
FROM public.profiles p
LEFT JOIN public.v_tutor_ratings tr ON tr.tutor_id = p.id
WHERE p.role = 'tutor'
  AND p.status = 'active'
  AND p.accepting_students
  AND coalesce(array_length(p.subjects, 1), 0) > 0
  AND length(btrim(coalesce(p.bio, ''))) >= 80
ORDER BY p.created_at;

REVOKE ALL ON public.v_public_tutors FROM anon, authenticated;
GRANT SELECT ON public.v_public_tutors TO anon, authenticated;
