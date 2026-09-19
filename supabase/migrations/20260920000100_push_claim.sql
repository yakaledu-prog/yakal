-- A browser's push endpoint belongs to whoever turns notifications on in it.
--
-- The endpoint is unique, one row per browser, and the browser saved it with
-- an upsert. On a shared laptop (a parent and a child, or anybody testing two
-- accounts) the second person's upsert collided with the first person's row,
-- and the own-rows policy refused to update a row that was not theirs, so
-- turning notifications on failed with an RLS error. Worse, the first account
-- kept receiving pushes on a device somebody else was now using.
--
-- The browser cannot see or change another user's row, and should not be able
-- to, so the hand-over happens here. Taking an endpoint over is harmless to
-- the previous owner beyond losing that device: pushes go to the browser that
-- holds the keys, so nobody receives anybody else's notifications by it.

CREATE OR REPLACE FUNCTION public.claim_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = '42501';
  END IF;
  IF coalesce(p_endpoint, '') !~ '^https://' OR coalesce(p_p256dh, '') = '' OR coalesce(p_auth, '') = '' THEN
    RAISE EXCEPTION 'That is not a push subscription.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  VALUES (auth.uid(), p_endpoint, p_p256dh, p_auth, left(p_user_agent, 200))
  ON CONFLICT (endpoint) DO UPDATE
    SET user_id = excluded.user_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        user_agent = excluded.user_agent,
        created_at = now(),
        last_used_at = NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_push_subscription(text, text, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.claim_push_subscription(text, text, text, text) TO authenticated;
