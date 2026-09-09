-- ============================================================
-- The answer key was public, and the score was whatever the browser said.
--
-- Three separate holes, and they compound:
--
--   1. diagnostics carried GRANT SELECT to anon with a policy of
--      USING (published), and questions is a jsonb blob with correctAnswer in
--      it. So every answer to every published diagnostic was readable over the
--      REST API by anyone, signed out.
--
--   2. The student pages imported src/data/diagnostics.ts, which put the same
--      answer key in the browser bundle whether the table was used or not.
--
--   3. saveResult() compared chosen to correct in the browser and inserted the
--      score it had computed. authenticated holds INSERT on diagnostic_results,
--      so a student could post any score against themselves without going near
--      the UI, and the row would look exactly like a real one.
--
-- A diagnostic is placement rather than an exam, so this is not a cheating
-- scandal. But a placement built on numbers a student can choose is not
-- placement, and a tutor reading those numbers is being misled rather than
-- informed.
--
-- So: the key stops leaving the server, and the server does the marking.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Nobody reads the key over REST any more
--
-- Admins still read the table directly, through their own policy, because the
-- editor has to show the correct answer to let somebody set it.
-- ------------------------------------------------------------
REVOKE SELECT ON public.diagnostics FROM anon;

DROP POLICY IF EXISTS "Published diagnostics are readable" ON public.diagnostics;

-- ------------------------------------------------------------
-- 2. What a student is allowed to see: the questions, without the answers
--
-- SECURITY DEFINER so it can read a table the caller no longer can. It strips
-- correctAnswer and explanation from every question: the explanation gives the
-- answer away just as reliably, and both are returned afterwards by the review
-- path, which reads the stored result rather than the diagnostic.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.student_diagnostics()
RETURNS TABLE (
  id uuid,
  slug text,
  title text,
  description text,
  category_id text,
  category_name text,
  time_limit_minutes integer,
  course_id uuid,
  sort_order integer,
  questions jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    d.id, d.slug, d.title, d.description, d.category_id, d.category_name,
    d.time_limit_minutes, d.course_id, d.sort_order,
    coalesce(
      (
        SELECT jsonb_agg(
                 jsonb_build_object(
                   'id', q ->> 'id',
                   'text', q ->> 'text',
                   'options', q -> 'options'
                 )
                 ORDER BY ord
               )
        FROM jsonb_array_elements(d.questions) WITH ORDINALITY AS t(q, ord)
      ),
      '[]'::jsonb
    ) AS questions
  FROM public.diagnostics d
  WHERE d.published
  ORDER BY d.sort_order, d.title;
$$;

REVOKE ALL ON FUNCTION public.student_diagnostics() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.student_diagnostics() TO authenticated;

-- ------------------------------------------------------------
-- 3. Marking happens here, against the real key
--
-- Takes what the student chose and nothing else. The caller cannot say what is
-- correct, cannot say what they scored, and cannot record a sitting for anybody
-- but themselves.
--
-- Answers are stored with the correct index and the explanation alongside the
-- chosen one, so the review screen and the tutor's report work from the stored
-- row: a diagnostic reworded next term must not silently rewrite what somebody
-- sat, and the review is the one place a student is meant to see the answer.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_diagnostic(
  p_slug text,
  p_answers jsonb
)
RETURNS TABLE (score integer, total integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_questions jsonb;
  v_answers   jsonb;
  v_score     integer;
  v_total     integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not signed in' USING ERRCODE = '42501';
  END IF;

  IF jsonb_typeof(p_answers) <> 'array' THEN
    RAISE EXCEPTION 'Answers must be an array' USING ERRCODE = '22023';
  END IF;

  SELECT d.questions INTO v_questions
  FROM public.diagnostics d
  WHERE d.slug = p_slug AND d.published;

  IF v_questions IS NULL THEN
    RAISE EXCEPTION 'No published diagnostic with that name' USING ERRCODE = 'P0002';
  END IF;

  -- One row per question in the diagnostic, not per answer submitted, so a
  -- caller cannot pad the total with questions that do not exist or shorten it
  -- by leaving hard ones out. An unanswered question is -1 and counts against.
  SELECT
    jsonb_agg(
      jsonb_build_object(
        'question_id', q ->> 'id',
        'chosen', coalesce(a.chosen, -1),
        'correct', (q ->> 'correctAnswer')::int,
        'explanation', q ->> 'explanation'
      )
      ORDER BY ord
    ),
    count(*)::int,
    count(*) FILTER (WHERE a.chosen = (q ->> 'correctAnswer')::int)::int
  INTO v_answers, v_total, v_score
  FROM jsonb_array_elements(v_questions) WITH ORDINALITY AS t(q, ord)
  LEFT JOIN LATERAL (
    SELECT (elem ->> 'chosen')::int AS chosen
    FROM jsonb_array_elements(p_answers) elem
    WHERE elem ->> 'question_id' = q ->> 'id'
    LIMIT 1
  ) a ON true;

  IF v_total IS NULL OR v_total = 0 THEN
    RAISE EXCEPTION 'That diagnostic has no questions' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.diagnostic_results (student_id, diagnostic_slug, score, total, answers)
  VALUES (auth.uid(), p_slug, v_score, v_total, v_answers);

  RETURN QUERY SELECT v_score, v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_diagnostic(text, jsonb) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.submit_diagnostic(text, jsonb) TO authenticated;

-- ------------------------------------------------------------
-- 4. And the browser stops being able to write a result directly
--
-- SELECT and DELETE stay: a student reads their own history and can clear it.
-- INSERT is now only reachable through submit_diagnostic above, which marks it.
-- ------------------------------------------------------------
REVOKE INSERT ON public.diagnostic_results FROM authenticated;
