-- The newsletter list, and a record of which post has already gone out.
--
-- The footer already had a Subscribe box. It showed "Thanks for joining our
-- newsletter" and threw the address away, so every person who signed up since
-- launch is gone. This is the table that box should always have written to.
--
-- Nothing reaches this table directly from a browser. Subscribing goes through
-- /api/newsletter, which holds the service key, so anon needs no grant at all.
-- That matters more here than on most tables: a list of email addresses is the
-- one thing on this project worth scraping, and a SELECT policy added later by
-- someone reaching for a quick admin page would expose the lot.

CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Stored lowercase and unique. Someone signing up twice with Foo@ and foo@
  -- is one person, and sending them two copies is how a list gets reported as
  -- spam rather than unsubscribed from.
  email text NOT NULL,
  -- Unsubscribed rows are kept rather than deleted. A deleted row resubscribes
  -- silently on the next signup, which is exactly what someone who just opted
  -- out did not ask for.
  status text NOT NULL DEFAULT 'subscribed',
  -- In the unsubscribe link. A guessable id would let anyone remove anyone.
  unsubscribe_token uuid NOT NULL DEFAULT gen_random_uuid(),
  -- Where they signed up, for when there is more than one form.
  source text NOT NULL DEFAULT 'footer',
  created_at timestamptz NOT NULL DEFAULT now(),
  unsubscribed_at timestamptz,
  CONSTRAINT newsletter_subscribers_status_check
    CHECK (status = ANY (ARRAY['subscribed'::text, 'unsubscribed'::text]))
);

CREATE UNIQUE INDEX IF NOT EXISTS newsletter_subscribers_email_key
  ON public.newsletter_subscribers (lower(email));

CREATE INDEX IF NOT EXISTS newsletter_subscribers_status_idx
  ON public.newsletter_subscribers (status);

CREATE UNIQUE INDEX IF NOT EXISTS newsletter_subscribers_token_key
  ON public.newsletter_subscribers (unsubscribe_token);

ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- Supabase grants anon and authenticated ALL on new tables in public through
-- ALTER DEFAULT PRIVILEGES. RLS would still stop a read, but the grant has no
-- reason to exist, and a permissive policy added later would then be the only
-- thing between the public internet and every address on this list.
REVOKE ALL ON public.newsletter_subscribers FROM anon, authenticated;

-- No policies, deliberately. Every path in and out is the service role, which
-- bypasses RLS. An empty policy set means anyone else gets nothing, which is
-- the correct answer for all of them.

-- When the newsletter for this post went out. Null means never.
--
-- A column rather than a separate sends table because the question being asked
-- is only ever "has this one gone yet", and it is the guard that stops a second
-- click sending a second copy to the whole list.
ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS newsletter_sent_at timestamptz;
