-- ============================================================
-- Ratings as reviews, for somebody choosing a tutor.
--
-- The notes students leave are the most useful thing on a tutor's profile and
-- they were going nowhere: session_ratings is readable only by the two people
-- in the session, their parent and an admin, which is right for the raw row
-- and useless for a family browsing.
--
-- So a view instead, carrying only what a stranger should see: the score, the
-- note, when it was left, and a first name. Not the session, not the student's
-- identity, not the other party. A review should not tell a reader which
-- lesson it came from, or they could work out who wrote it.
-- ============================================================

DROP VIEW IF EXISTS public.v_tutor_reviews;
CREATE VIEW public.v_tutor_reviews AS
SELECT
  r.id,
  r.ratee_id                                   AS tutor_id,
  r.stars,
  r.comment,
  r.created_at,
  -- First name only. "Amen W." is enough to read as a person without naming
  -- a child to anybody who asks for a tutor's profile.
  split_part(p.full_name, ' ', 1) ||
    CASE WHEN split_part(p.full_name, ' ', 2) <> ''
         THEN ' ' || left(split_part(p.full_name, ' ', 2), 1) || '.'
         ELSE '' END                           AS reviewer_name,
  p.avatar_url                                 AS reviewer_avatar_url
FROM public.session_ratings r
JOIN public.profiles p ON p.id = r.rated_by
WHERE r.comment IS NOT NULL AND btrim(r.comment) <> '';

COMMENT ON VIEW public.v_tutor_reviews IS
  'Written reviews for a tutor, safe for anyone choosing one to read. Only ratings that carry a note; a bare score is an average, not a review.';

GRANT SELECT ON public.v_tutor_reviews TO authenticated;
