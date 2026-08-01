-- ============================================================
-- Admissions counselling, sold as a tier.
--
-- Three decisions are baked in here, and each one removes work rather than
-- adding it:
--
--   The tiers are data. Names, blurbs, prices, the bullet list and the quotas
--   all live in rows, because the offering is not settled and every change to
--   it should be an UPDATE rather than a migration.
--
--   There is no season. "Weekly in season" is a promise a counselor keeps by
--   scheduling, not a window the database polices. Nothing here knows what
--   month it is.
--
--   Quotas are counted and shown, never enforced. A limit that blocks invites
--   the question of who is allowed to spend it and what happens when somebody
--   mis-clicks, and it makes the counter worth gaming. A limit that only
--   displays is a fact both sides can see, and the conversation about a
--   seventh round happens between people, where it belongs.
--
-- What makes the count trustworthy is not the ceiling, it is the receipt:
-- every round is a row naming who did it and when.
-- ============================================================

-- ------------------------------------------------------------
-- What is on offer
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admissions_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Stable handle for a tier, so a rename does not orphan anything.
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  blurb text,
  price_cents integer NOT NULL CHECK (price_cents >= 0),

  -- Quotas. NULL is unlimited, not a large number: a tier that promises
  -- "unlimited essay editing" and stores 999 is telling a lie with an expiry
  -- date on it.
  ps_rounds_limit smallint,
  supp_essays_limit smallint,
  sessions_per_month smallint,

  -- The bullet list, in order, exactly as the card shows it. Free text so the
  -- offering can be rewritten without touching this file.
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- "Fits: motivated, self-driven students who..."
  fits text,

  is_recommended boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- What a family bought
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admissions_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  purchased_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  tier_id uuid NOT NULL REFERENCES public.admissions_tiers(id),
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- A student is on one tier at a time. Upgrading ends the old row and starts a
-- new one, so the history of what they were on is kept.
CREATE UNIQUE INDEX IF NOT EXISTS admissions_plans_one_active
  ON public.admissions_plans (student_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS admissions_plans_student_idx
  ON public.admissions_plans (student_id);

-- What an invoice is buying, when it is buying a tier. The course case
-- already works this way: the intent is recorded before the payer is
-- redirected, because the webhook cannot ask the browser afterwards.
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS admissions_tier_id uuid REFERENCES public.admissions_tiers(id);

-- ------------------------------------------------------------
-- Every pass a counselor made over an essay
--
-- The essay itself is written and commented on in Google Docs. What belongs
-- here is not the feedback, it is the fact that a pass happened: who, when,
-- and which way it went. That is the audit trail, the student's history, and
-- the round counter, from one row.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.essay_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  essay_id uuid NOT NULL REFERENCES public.essays(id) ON DELETE CASCADE,
  counselor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- returned: back to the student with comments. approved: finished.
  -- reopened: the counselor undoing an approval, which is a correction and
  -- must not cost the family a round.
  action text NOT NULL CHECK (action IN ('returned', 'approved', 'reopened')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS essay_reviews_essay_idx
  ON public.essay_reviews (essay_id, created_at DESC);

-- essays.rounds_used already existed as a bare counter that nothing
-- maintained. It stays, kept in step with the log, so anything already
-- reading it keeps working and the log stays the source of truth.
CREATE OR REPLACE FUNCTION public.sync_essay_rounds()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.essays
  SET rounds_used = (
        SELECT count(*)
        FROM public.essay_reviews r
        WHERE r.essay_id = COALESCE(NEW.essay_id, OLD.essay_id)
          AND r.action IN ('returned', 'approved')
      ),
      last_feedback_at = now(),
      updated_at = now()
  WHERE id = COALESCE(NEW.essay_id, OLD.essay_id);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS essay_reviews_sync ON public.essay_reviews;
CREATE TRIGGER essay_reviews_sync
  AFTER INSERT OR DELETE ON public.essay_reviews
  FOR EACH ROW EXECUTE FUNCTION public.sync_essay_rounds();

-- ------------------------------------------------------------
-- Row level security
-- ------------------------------------------------------------
ALTER TABLE public.admissions_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admissions_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.essay_reviews ENABLE ROW LEVEL SECURITY;

-- The price list is not a secret. Anyone signed in can read what is on offer,
-- because a parent has to see it before they can buy it.
DROP POLICY IF EXISTS admissions_tiers_read ON public.admissions_tiers;
CREATE POLICY admissions_tiers_read ON public.admissions_tiers
  FOR SELECT TO authenticated USING (is_active OR public.is_admin());

DROP POLICY IF EXISTS admissions_tiers_admin ON public.admissions_tiers;
CREATE POLICY admissions_tiers_admin ON public.admissions_tiers
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- A plan is visible to the student it is for, the parent who bought it, any
-- counselor, and an admin. Nobody writes it from the browser: fulfilment does,
-- with the service key, after the money has moved.
DROP POLICY IF EXISTS admissions_plans_read ON public.admissions_plans;
CREATE POLICY admissions_plans_read ON public.admissions_plans
  FOR SELECT TO authenticated USING (
    auth.uid() = student_id
    OR auth.uid() = purchased_by
    OR public.is_counselor()
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.parent_student_links psl
      WHERE psl.parent_id = auth.uid()
        AND psl.status = 'active'
        AND psl.student_id = admissions_plans.student_id
    )
  );

DROP POLICY IF EXISTS admissions_plans_admin ON public.admissions_plans;
CREATE POLICY admissions_plans_admin ON public.admissions_plans
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Reviews follow the essay they are about.
DROP POLICY IF EXISTS essay_reviews_read ON public.essay_reviews;
CREATE POLICY essay_reviews_read ON public.essay_reviews
  FOR SELECT TO authenticated USING (
    public.is_counselor()
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.essays e
      WHERE e.id = essay_reviews.essay_id
        AND (
          e.student_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.parent_student_links psl
            WHERE psl.parent_id = auth.uid()
              AND psl.status = 'active'
              AND psl.student_id = e.student_id
          )
        )
    )
  );

-- Only a counselor records a pass, and only as themselves.
DROP POLICY IF EXISTS essay_reviews_counselor_write ON public.essay_reviews;
CREATE POLICY essay_reviews_counselor_write ON public.essay_reviews
  FOR INSERT TO authenticated
  WITH CHECK ((public.is_counselor() OR public.is_admin()) AND counselor_id = auth.uid());

-- ------------------------------------------------------------
-- Notifications this flow sends
-- ------------------------------------------------------------
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type = ANY (ARRAY[
    'booking', 'assignment', 'approval', 'message', 'system', 'parent_link',
    'application', 'unlock_request', 'course_application',
    'course_application_decided', 'enrolment',
    'admissions_plan', 'essay_review'
  ]));

-- ------------------------------------------------------------
-- A starting point, not the offering.
--
-- These three came from a sketch and the prices are placeholders. They are
-- rows so that correcting them is an UPDATE.
-- ------------------------------------------------------------
INSERT INTO public.admissions_tiers
  (key, name, blurb, price_cents, ps_rounds_limit, supp_essays_limit, sessions_per_month,
   fits, is_recommended, sort_order, features)
VALUES
  (
    'essential',
    'Essential',
    'A strong foundation with expert direction, accountability and feedback. Flexible and affordable.',
    120000, 3, 5, 1,
    'Motivated, self-driven students who need expert checkpoints, not hand-holding.',
    false, 1,
    '["Monthly 1-on-1 advising (60 min)","Personalized college-list development","Admissions timeline and planning","Personal statement plus up to 3 edit rounds","Review of up to 5 supplemental essays","Email support and all group workshops"]'::jsonb
  ),
  (
    'premier',
    'Premier',
    'Deeper strategy, more frequent meetings, expanded essay support and interview prep for a competitive edge.',
    250000, 6, 12, 2,
    'Families wanting ongoing mentorship and a real edge, not just checkpoints.',
    true, 2,
    '["Two advising sessions per month","Tailored admissions strategy","Unlimited email support","Up to 6 personal-statement rounds","Review of up to 12 supplemental essays","Interview 101 and one mock with feedback","Priority scheduling and former-officer Q&A"]'::jsonb
  ),
  (
    'elite',
    'Elite',
    'A concierge experience: consistent coaching and full strategy from start to enrollment.',
    450000, NULL, NULL, 4,
    'Families seeking the highest-touch partnership through enrollment.',
    false, 3,
    '["Weekly 1-on-1 advising","Unlimited strategy meetings and essay editing","Every application reviewed pre-submission","Multiple mock interviews","Scholarship and financial-aid coaching","Waitlist, appeal and post-admission support"]'::jsonb
  )
ON CONFLICT (key) DO NOTHING;
