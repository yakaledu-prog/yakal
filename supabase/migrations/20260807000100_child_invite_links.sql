-- ============================================================
-- One invitation link, sent to a child's email, that grants a service.
--
-- The parent picks what the child gets: tutoring, admissions, or both. The
-- link carries a token and that scope. When the child follows it, the link in
-- their own inbox is the consent, so acceptance grants access on the spot
-- rather than opening a request the child then has to accept a second time.
--
-- Two ways in, one outcome:
--
--   No account yet. The child signs up with the invited address, and the
--   profile trigger below grants the link and services as part of that signup.
--   That path survives email confirmation, because it happens in the database
--   when the profile row appears, not in a browser that may have navigated away.
--
--   Account already exists. The child clicks the link while signed in and
--   accept_child_invite() does the same grant. Idempotent with the trigger, so
--   the two can never fight over who linked whom.
--
-- The token is the secret. The invite row is never readable by the child
-- directly; they reach it only through the two SECURITY DEFINER functions here,
-- and accepting requires being signed in as a student whose email matches the
-- address the invite was sent to. A stolen token cannot attach a stranger.
-- ============================================================

-- ------------------------------------------------------------
-- Extend the invite with a token, a service scope and an expiry.
-- ------------------------------------------------------------
ALTER TABLE public.parent_child_invites
  -- Two uuids, dashes stripped: 64 opaque characters, unguessable, and no
  -- dependency on an extension the hosted project might not have enabled.
  ADD COLUMN IF NOT EXISTS token text NOT NULL
    DEFAULT (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  -- Which services the link unlocks. Defaults to both so a legacy invite, made
  -- before scopes existed, keeps behaving as it did. The app always sends an
  -- explicit choice.
  ADD COLUMN IF NOT EXISTS services text[] NOT NULL
    DEFAULT ARRAY['tutoring', 'admissions']::text[],
  ADD COLUMN IF NOT EXISTS expires_at timestamptz NOT NULL
    DEFAULT (now() + interval '14 days');

-- Nothing outside the known two, so a typo cannot grant a service that does
-- not exist.
ALTER TABLE public.parent_child_invites
  DROP CONSTRAINT IF EXISTS parent_child_invites_services_check;
ALTER TABLE public.parent_child_invites
  ADD CONSTRAINT parent_child_invites_services_check
  CHECK (services <@ ARRAY['tutoring', 'admissions']::text[]);

CREATE UNIQUE INDEX IF NOT EXISTS parent_child_invites_token
  ON public.parent_child_invites (token);

-- ------------------------------------------------------------
-- Read an invite by its token, for the landing page.
--
-- Callable signed out, because the child has not necessarily made an account
-- yet. Returns only what the page needs to explain the invitation, and only
-- for a token that actually matches. The email comes back so signup can be
-- pre-filled; nothing else about the parent or the platform is exposed.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_child_invite(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv record;
  pname text;
BEGIN
  SELECT * INTO inv FROM public.parent_child_invites WHERE token = p_token;
  IF inv.id IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'invalid');
  END IF;

  SELECT full_name INTO pname FROM public.profiles WHERE id = inv.parent_id;

  RETURN jsonb_build_object(
    'valid', (inv.status = 'pending' AND inv.expires_at > now()),
    'reason', CASE
        WHEN inv.status = 'accepted'  THEN 'used'
        WHEN inv.status = 'cancelled' THEN 'cancelled'
        WHEN inv.expires_at <= now()  THEN 'expired'
        ELSE 'ok'
      END,
    'email', inv.email,
    'services', to_jsonb(inv.services),
    'parent_name', coalesce(pname, 'A parent')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_child_invite(text) TO anon, authenticated;

-- ------------------------------------------------------------
-- Accept an invite. The existing-account path.
--
-- The grant is upserts, so calling it after the signup trigger already ran is
-- a harmless no-op that reports success rather than "already used". Only the
-- first, pending-to-accepted transition notifies the parent.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accept_child_invite(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv record;
  me  record;
  svc text;
  was_pending boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You must be signed in to accept an invitation.');
  END IF;

  SELECT id, email, full_name, role INTO me FROM public.profiles WHERE id = auth.uid();

  SELECT * INTO inv FROM public.parent_child_invites WHERE token = p_token FOR UPDATE;
  IF inv.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This invitation link is not valid.');
  END IF;
  IF inv.status = 'cancelled' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This invitation was withdrawn.');
  END IF;
  -- Expired only blocks an invite nobody has taken up. One already accepted
  -- stays acceptable so the trigger-then-click race resolves to success.
  IF inv.status = 'pending' AND inv.expires_at <= now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This invitation link has expired. Ask your parent to send a new one.');
  END IF;
  IF me.role <> 'student' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only a student account can accept this invitation.');
  END IF;
  IF lower(coalesce(me.email, '')) <> lower(inv.email) THEN
    RETURN jsonb_build_object('ok', false, 'error',
      'This invitation was sent to ' || inv.email || '. Sign in with that email to accept it.');
  END IF;

  was_pending := (inv.status = 'pending');

  -- Grant on click: active straight away, not a pending request.
  INSERT INTO public.parent_student_links (parent_id, student_id, status)
  VALUES (inv.parent_id, me.id, 'active')
  ON CONFLICT (parent_id, student_id)
  DO UPDATE SET status = 'active', updated_at = now();

  FOREACH svc IN ARRAY inv.services LOOP
    INSERT INTO public.child_services (student_id, service, is_active)
    VALUES (me.id, svc, true)
    ON CONFLICT (student_id, service)
    DO UPDATE SET is_active = true, updated_at = now();
  END LOOP;

  IF was_pending THEN
    UPDATE public.parent_child_invites
    SET status = 'accepted', accepted_at = now()
    WHERE id = inv.id;

    INSERT INTO public.notifications (user_id, type, title, message, link)
    VALUES (
      inv.parent_id,
      'parent_link',
      'Invitation accepted',
      coalesce(me.full_name, 'Your child') || ' accepted your invitation and is now linked to your account.',
      '/parent/children'
    );
  END IF;

  RETURN jsonb_build_object('ok', true, 'services', to_jsonb(inv.services));
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_child_invite(text) TO authenticated;

-- ------------------------------------------------------------
-- The signup path.
--
-- Replaces the old body, which created a *pending* link and asked the child to
-- accept a second time. A token in the child's inbox is already the yes, so a
-- child who signs up with the invited address is linked and their services are
-- switched on as part of signing up.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_child_invites()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite record;
  svc text;
BEGIN
  IF NEW.role <> 'student' OR NEW.email IS NULL THEN
    RETURN NEW;
  END IF;

  FOR v_invite IN
    SELECT id, parent_id, services FROM public.parent_child_invites
    WHERE lower(email) = lower(NEW.email) AND status = 'pending' AND expires_at > now()
  LOOP
    INSERT INTO public.parent_student_links (parent_id, student_id, status)
    VALUES (v_invite.parent_id, NEW.id, 'active')
    ON CONFLICT (parent_id, student_id)
    DO UPDATE SET status = 'active', updated_at = now();

    FOREACH svc IN ARRAY v_invite.services LOOP
      INSERT INTO public.child_services (student_id, service, is_active)
      VALUES (NEW.id, svc, true)
      ON CONFLICT (student_id, service)
      DO UPDATE SET is_active = true, updated_at = now();
    END LOOP;

    UPDATE public.parent_child_invites
    SET status = 'accepted', accepted_at = now()
    WHERE id = v_invite.id;

    INSERT INTO public.notifications (user_id, type, title, message, link)
    VALUES (
      v_invite.parent_id,
      'parent_link',
      'Invitation accepted',
      coalesce(NEW.full_name, 'Your child') || ' joined Yakal and is now linked to your account.',
      '/parent/children'
    );
  END LOOP;

  RETURN NEW;
END;
$$;
