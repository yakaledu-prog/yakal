-- Server-side aggregation for the admin diagnostics report.
--
-- The results panel first shipped by fetching every diagnostic_results row and
-- folding it in the browser. Fine for a demo, wrong for a real school: both the
-- payload and the work grow with every sitting ever recorded. This moves the
-- fold into Postgres, so the client fetches one small summary object instead of
-- the whole history.
--
-- A SECURITY DEFINER function, not a plain view. The aggregate has to span every
-- student's rows and be admins-only. A security_invoker view would instead
-- aggregate just the caller's own rows under RLS; a plain view owned by a
-- superuser would hand the whole table to anyone who can select it. A definer
-- function checks is_admin() once and then reads across students, so the gate
-- lives in one place.

CREATE OR REPLACE FUNCTION public.diagnostic_result_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  -- The only thing that reads across students. Everything else is gated by
  -- row-level security; this is gated here.
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'diagnostic_result_stats is admin only' USING errcode = '42501';
  END IF;

  SELECT jsonb_build_object(
    'overview', (
      SELECT jsonb_build_object(
        'attempts', count(*),
        'students', count(DISTINCT student_id),
        'correct', coalesce(sum(score), 0),
        'total', coalesce(sum(total), 0)
      )
      FROM public.diagnostic_results
    ),
    -- Weakest first, so the tests students struggle with are at the top of the
    -- chart. Averages each sitting's percentage, matching the tutor view's maths.
    'byTest', coalesce((
      SELECT jsonb_agg(to_jsonb(t) ORDER BY t.avg_accuracy ASC, t.slug ASC)
      FROM (
        SELECT
          diagnostic_slug AS slug,
          count(*) AS attempts,
          count(DISTINCT student_id) AS students,
          round(avg(score::numeric / nullif(total, 0) * 100))::int AS avg_accuracy
        FROM public.diagnostic_results
        GROUP BY diagnostic_slug
      ) t
    ), '[]'::jsonb)
  )
  INTO result;

  RETURN result;
END;
$$;

-- EXECUTE is granted to PUBLIC by default; take it back and hand it only to
-- signed-in users. The is_admin() check inside is what actually restricts it.
REVOKE ALL ON FUNCTION public.diagnostic_result_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.diagnostic_result_stats() TO authenticated;
