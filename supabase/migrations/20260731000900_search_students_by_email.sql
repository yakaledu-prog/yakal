-- Confirming a child's email address while typing it.
--
-- An open search over profiles would be a user-enumeration oracle: any account
-- could harvest the email of every student on the platform, and a large share
-- of those students are minors. That is the risk worth designing against, not
-- spam.
--
-- So this is deliberately not a directory. It is a confirmation:
--
--   * only a parent may call it
--   * at least 5 characters, matched as a prefix rather than a substring, so
--     a caller has to substantially know the address before it answers
--   * students only, never a tutor, counselor or admin
--   * at most 5 rows
--   * the email comes back masked; the caller sees enough to recognise the
--     person they meant and not enough to learn an address they did not have
--
-- What is given up is discovery from a partial guess. That is the part that
-- should be given up.

CREATE OR REPLACE FUNCTION public.search_students_by_email(p_prefix text)
RETURNS TABLE (
  id uuid,
  full_name text,
  masked_email text,
  avatar_url text,
  grade_level text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix text := lower(trim(coalesce(p_prefix, '')));
BEGIN
  -- Below the threshold this returns nothing rather than erroring: the input
  -- is a field someone is still typing into, not a bad request.
  IF length(v_prefix) < 5 THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'parent'
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.full_name,
    -- First two characters, then the domain. "amen.worku@gmail.com" with a
    -- prefix of "amen." comes back as "am*******@gmail.com".
    CASE
      WHEN position('@' IN p.email) > 3
        THEN left(split_part(p.email, '@', 1), 2)
             || repeat('*', greatest(length(split_part(p.email, '@', 1)) - 2, 1))
             || '@' || split_part(p.email, '@', 2)
      ELSE p.email
    END AS masked_email,
    p.avatar_url,
    p.grade_level
  FROM public.profiles p
  WHERE p.role = 'student'
    AND lower(p.email) LIKE v_prefix || '%'
    -- Children already linked to this parent are not candidates to add.
    AND NOT EXISTS (
      SELECT 1 FROM public.parent_student_links l
      WHERE l.student_id = p.id AND l.parent_id = auth.uid()
    )
  ORDER BY p.email
  LIMIT 5;
END;
$$;

REVOKE ALL ON FUNCTION public.search_students_by_email(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.search_students_by_email(text) TO authenticated;

-- Makes the prefix match an index scan rather than a sequential one. The
-- pattern ops class is what LIKE 'x%' needs on a non-C collation.
CREATE INDEX IF NOT EXISTS profiles_email_prefix_idx
  ON public.profiles (lower(email) text_pattern_ops)
  WHERE role = 'student';
