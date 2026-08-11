-- ============================================================
-- The invitation is the family relationship, not a purchase.
--
-- Service access is derived from payment in v_student_entitlements (an active
-- enrolment means tutoring, an active admissions plan means admissions), which
-- only the Stripe webhook writes. This migration finishes that split by taking
-- service-granting out of the invite: accepting an invitation links the family
-- and lets the child sign in, and nothing more. A child who has accepted but
-- whose parent has not paid has an account and no paid features, as intended.
--
-- (An earlier draft of this migration also added an active_services() function
-- that OR-ed in a manual child_services override. That was dropped in favour of
-- the payment-only v_student_entitlements view, so access is never something a
-- toggle can hand out.)
-- ============================================================

-- ------------------------------------------------------------
-- Accepting an invite now only links the family. It no longer switches on any
-- service: those are bought per child and turn on when the payment lands.
-- Redefined here rather than edited in place, since the original migration has
-- already run.
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

  -- The relationship only. No child_services: access comes from what has been
  -- paid for, which any service already reserved for this child will grant on
  -- its own once the link is active.
  INSERT INTO public.parent_student_links (parent_id, student_id, status)
  VALUES (inv.parent_id, me.id, 'active')
  ON CONFLICT (parent_id, student_id)
  DO UPDATE SET status = 'active', updated_at = now();

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

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Signup path: link the family, do not grant services.
CREATE OR REPLACE FUNCTION public.claim_child_invites()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite record;
BEGIN
  IF NEW.role <> 'student' OR NEW.email IS NULL THEN
    RETURN NEW;
  END IF;

  FOR v_invite IN
    SELECT id, parent_id FROM public.parent_child_invites
    WHERE lower(email) = lower(NEW.email) AND status = 'pending' AND expires_at > now()
  LOOP
    INSERT INTO public.parent_student_links (parent_id, student_id, status)
    VALUES (v_invite.parent_id, NEW.id, 'active')
    ON CONFLICT (parent_id, student_id)
    DO UPDATE SET status = 'active', updated_at = now();

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
