-- Where to push a notification to.
--
-- A notification is a row in this database and an email. Both need somebody to
-- come and look: the row waits until the app is opened, and the email waits in
-- an inbox that a fourteen year old does not read. A lesson moved an hour
-- before it starts has to reach a phone.
--
-- Web Push, which every current browser speaks, so there is nothing to install
-- and no third party holding a device token. The browser mints an endpoint on
-- its vendor's push service and hands it over with two keys; we encrypt to
-- those keys and post to that endpoint. The vendor sees ciphertext.
--
-- One row per browser, not per person. Somebody with a laptop and a phone has
-- two, and they expire independently: a subscription is revoked by clearing
-- site data, reinstalling, or the vendor deciding it is stale, and the only
-- way to find out is a 404 or 410 on a send.

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- The vendor URL to POST to. Unique because a browser hands back the same
  -- endpoint for the same registration: re-subscribing must update the row it
  -- already has rather than accumulate one per sign-in.
  endpoint text NOT NULL UNIQUE,
  -- The two halves of the encryption key the browser generated. Useless to
  -- anybody who cannot also reach the endpoint, but they are the reason a push
  -- service cannot read what it delivers, so they are not for sharing.
  p256dh text NOT NULL,
  auth text NOT NULL,
  -- Only so a person can tell their own devices apart when revoking one.
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Touched on every successful send. A subscription nothing has reached in
  -- months is a browser somebody stopped using, and it is worth pruning.
  last_used_at timestamptz
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx
  ON public.push_subscriptions (user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Supabase grants anon and authenticated ALL on new tables in public. This one
-- holds the addresses a notification is delivered to, so the grant is removed
-- and given back a column at a time.
REVOKE ALL ON public.push_subscriptions FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;

-- Your own devices, and only yours. Reading somebody else's row would hand
-- over an endpoint anybody can post to.
DROP POLICY IF EXISTS push_subscriptions_own ON public.push_subscriptions;
CREATE POLICY push_subscriptions_own ON public.push_subscriptions
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- No admin policy on purpose. Sending is done with the service role, which
-- bypasses RLS, and there is nothing here an administrator has a reason to
-- read: the useful question is "did this reach them", which the send answers.

COMMENT ON TABLE public.push_subscriptions IS
  'Web Push endpoints, one per browser. Written by the browser, read by the sender.';
