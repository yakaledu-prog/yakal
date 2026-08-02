-- ============================================================
-- Catching the messages a parent would want to have seen.
--
-- Reports have until now been something a person files. That only works if
-- somebody is reading, and the person best placed to read a grooming attempt
-- is the child being groomed. So the database reads every message as it is
-- written and files what looks wrong, which the parent then reports.
--
-- Why a trigger rather than a check in the app: the app is not the only way
-- into this table. PostgREST is reachable with the anon key from any browser,
-- and msg_insert admits anyone who is a participant. A scan that lives in the
-- client is a scan that can be skipped by not using the client. This one
-- cannot be, because it is part of the write.
--
-- What it looks for is deliberately not "toxic language". A predator is warm,
-- complimentary and patient, and would sail through a sentiment score. What
-- they must eventually do is move the conversation somewhere unwatched, so
-- that is what is looked for: contact details, other apps, money outside the
-- platform, meeting alone, and asking a child to keep a secret.
--
-- It never blocks a message. A false positive that silences a real
-- conversation costs more than a false negative that is merely recorded, and
-- blocking teaches whoever tripped it exactly what to rephrase.
-- ============================================================

-- ------------------------------------------------------------
-- Normalising, so the rules survive contact with a keyboard
-- ------------------------------------------------------------

-- Folds case, leetspeak and padding, so "W-h-a-t-s-App" and "wh4tsapp" read
-- the same as "whatsapp". Digits fold into letters here, which is why phone
-- numbers are matched against the original text further down instead.
CREATE OR REPLACE FUNCTION public.report_scan_normalise(p_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT regexp_replace(
           regexp_replace(
             translate(
               -- Zero-width characters are invisible padding between letters,
               -- and apostrophes only make "don't" and "dont" two rules.
               translate(lower(coalesce(p_text, '')),
                         chr(8203) || chr(8204) || chr(8205) || chr(65279) || '''' || chr(700),
                         ''),
               '013457@$!', 'oieastasi'
             ),
             -- Three or more of the same letter is emphasis, not a new word.
             '(.)\1{2,}', '\1\1', 'g'
           ),
           '\s+', ' ', 'g'
         );
$$;

-- Everything that is not a letter or a digit, removed. Defeats the spacing and
-- punctuation people put between the letters of a word they expect to be read.
CREATE OR REPLACE FUNCTION public.report_scan_flatten(p_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT regexp_replace(public.report_scan_normalise(p_text), '[^a-z0-9]', '', 'g');
$$;

-- "oh nine one one" becomes "0911". Dictating a number one word at a time is
-- the oldest way around a digit rule.
CREATE OR REPLACE FUNCTION public.report_scan_spell_digits(p_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT regexp_replace(
    regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
    regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
      lower(coalesce(p_text, '')),
      '\y(zero|oh)\y', '0', 'g'),
      '\yone\y',   '1', 'g'),
      '\ytwo\y',   '2', 'g'),
      '\ythree\y', '3', 'g'),
      '\yfour\y',  '4', 'g'),
      '\yfive\y',  '5', 'g'),
      '\ysix\y',   '6', 'g'),
      '\yseven\y', '7', 'g'),
      '\yeight\y', '8', 'g'),
      '\ynine\y',  '9', 'g'),
    -- The spaces that separated the words are now separating digits.
    '(?<=[0-9]) +(?=[0-9])', '', 'g');
$$;

-- ------------------------------------------------------------
-- The scan
--
-- Pure and immutable: given the same text it returns the same verdict, which
-- is what makes it testable on its own without inserting a message.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.scan_message_content(p_text text)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_raw  text := lower(coalesce(p_text, ''));
  v_norm text := public.report_scan_normalise(p_text);
  v_flat text := public.report_scan_flatten(p_text);
  v_dig  text := public.report_scan_spell_digits(p_text);
  v_cats text[] := '{}';
  v_match text;
  v_digits int;
BEGIN
  IF length(v_norm) < 3 THEN
    RETURN '[]'::jsonb;
  END IF;

  -- ---------- secrecy ----------
  -- The one thing a legitimate tutor never needs. Asking a child to hide the
  -- conversation from their parents has no innocent reading, which is why it
  -- is the highest-confidence rule here.
  IF v_norm ~ '\y(dont|do not|never|cant|cannot) (tell|say|mention|show)\y'
     OR v_norm ~ '\y(just )?between (us|you and me|the two of us)\y'
     OR v_norm ~ '\your (little )?secret\y'
     OR v_norm ~ '\ykeep (this|it|that) (a )?secret\y'
     OR v_norm ~ '\ykeep (this|it|that) (to yourself|quiet|hidden)\y'
     OR v_norm ~ '\y(delete|erase|clear) (this|these|the|our) (chat|message|messages|conversation)\y'
     OR v_norm ~ '\ydont (screenshot|save|tell anyone|let anyone see)\y'
     OR v_norm ~ '\ypromise (me )?(not to|you wont) tell\y'
     OR v_norm ~ '\y(secret|private) (chat|account|number)\y'
  THEN
    v_cats := v_cats || 'secrecy'::text;
  END IF;

  -- ---------- grooming ----------
  -- Meeting away from anyone watching, asking for images, and testing whether
  -- an adult is nearby. Each of these is reported on its own.
  -- Photographs, but only of the person. Students photograph their working
  -- and send it over all day long, so "send me a picture" on its own is the
  -- single noisiest thing this scan could look for. "of you" is what separates
  -- a page of algebra from the request that matters.
  IF v_norm ~ '\y(send|share|show|post) (me |us )?(a |an |your |some |the )?(pic|pics|picture|pictures|photo|photos|video|videos|snap) of (you|u|yourself|urself|your (face|body|self|room|bedroom))\y'
     OR v_norm ~ '\y(send|share|show) me (a |your |some )?(selfie|selfies)\y'
     OR v_norm ~ '\ysend (me )?(nudes|a nude)\y'
     OR v_norm ~ '\y(what|how) (do|does) (you|u) look like\y'
     OR v_norm ~ '\ywhat (are|r) (you|u) wearing\y'
     OR v_norm ~ '\y(turn on|open) (your )?(cam|camera|webcam)\M'
     OR v_norm ~ '\y(meet|see) (me |up )?(in person|face to face|irl|alone)\y'
     OR v_norm ~ '\ycome (to my|over to my|by my) (house|home|place|apartment|flat|room|office)\y'
     OR v_norm ~ '\y(come over|swing by|stop by) (after|later|tonight|tomorrow|sometime)\y'
     OR v_norm ~ '\y(pick (you|u) up|give (you|u) a (ride|lift)|drive (you|u) home)\y'
     OR v_norm ~ '\y(are|r) (you|u) (home )?alone\y'
     OR v_norm ~ '\yhome alone\y'
     OR v_norm ~ '\y(are|r) your (parents|mom|mum|dad|folks|family) (home|there|around|out|away)\y'
     OR v_norm ~ '\yjust the two of us\y'
     OR v_norm ~ '\y(do|have) (you|u) (have|got) a (boyfriend|girlfriend)\y'
     OR v_norm ~ '\y(you are|youre|ur|u r) (so |very |really |such )?(pretty|beautiful|gorgeous|cute|hot|sexy|mature)\y'
     OR v_norm ~ '\ymature for your age\y'
     OR v_norm ~ '\y(our|this) (special|little) (secret|friendship|thing)\y'
     OR v_norm ~ '\ydont be shy\y'
  THEN
    v_cats := v_cats || 'grooming'::text;
  END IF;

  -- ---------- contact details ----------
  -- Matched against the original text: the normaliser folds digits into
  -- letters, which would eat every phone number before it got here.
  IF v_raw ~ '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}'
     OR v_norm ~ '[a-z0-9._%+-]+ ?(\(at\)|\[at\]| at ) ?(gmail|yahoo|hotmail|outlook|icloud|proton|protonmail)\y'
  THEN
    v_cats := v_cats || 'contact_details'::text;
  END IF;

  IF NOT ('contact_details' = ANY (v_cats)) THEN
    -- A run of nine to fifteen digits that is grouped, or starts with a zero
    -- or a plus. The grouping is what separates a phone number from an answer:
    -- a full stop is not a separator here, or every decimal in a maths lesson
    -- would be reported.
    FOR v_match IN
      SELECT m[1] FROM regexp_matches(v_dig, '(\+?[0-9][0-9 ()+-]{7,}[0-9])', 'g') m
    LOOP
      v_digits := length(regexp_replace(v_match, '[^0-9]', '', 'g'));
      IF v_digits BETWEEN 9 AND 15
         AND (v_match ~ '[ ()+-]' OR v_match ~ '^\+' OR v_match ~ '^0')
      THEN
        v_cats := v_cats || 'contact_details'::text;
        EXIT;
      END IF;
    END LOOP;
  END IF;

  -- ---------- off platform ----------
  -- Named apps are matched flattened, so spacing them out does not help.
  -- Nothing shorter than five letters goes in that list: "imo" is inside
  -- "timothy", and a rule that fires on a name is a rule people learn to
  -- ignore.
  IF v_flat ~ '(whatsapp|whatsap|watsapp|telegram|snapchat|instagram|messenger|facebook|discord|viber|skype|tiktok|wechat|kakaotalk)'
     OR v_norm ~ '\y(my|his|her|the) (number|phone|mobile|cell|contact) is\y'
     OR v_norm ~ '\y(text|call|message|dm|whatsapp|reach) me (on|at|directly|instead|privately)\y'
     OR v_norm ~ '\y(add|find|follow|message) me on\y'
     OR v_norm ~ '\y(off|outside) (the )?(app|platform|site|website|yakal)\y'
     OR v_norm ~ '\ylets (talk|chat|continue|do this) (somewhere else|elsewhere|privately|outside)\y'
     OR v_norm ~ '\y(no need|dont need|why) (to )?(go through|use) (the )?(app|platform|site|yakal)\y'
  THEN
    v_cats := v_cats || 'off_platform'::text;
  END IF;

  -- ---------- payment ----------
  -- Paying a tutor directly takes the session outside everything that protects
  -- both sides of it: no record, no refund, no cover.
  IF v_flat ~ '(paypal|venmo|cashapp|zelle|revolut|telebirr|cbebirr|chapa|westernunion|moneygram)'
     OR v_norm ~ '\y(pay|paying|payment) (me |him |her )?(directly|in cash|by cash|outside|off the books)\y'
     OR v_norm ~ '\y(bank|wire|direct) transfer\y'
     OR v_norm ~ '\y(my|the) (account|card) number\y'
     OR v_norm ~ '\y(send|transfer) (me |the )?(the )?money\y'
     OR v_norm ~ '\y(cheaper|discount|less) (if|when) (you|u|we) (pay|book|go) (directly|outside|privately)\y'
  THEN
    v_cats := v_cats || 'payment'::text;
  END IF;

  IF array_length(v_cats, 1) IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  RETURN (
    SELECT jsonb_agg(jsonb_build_object(
      'category', c,
      'severity', CASE WHEN c IN ('secrecy', 'grooming') THEN 'high' ELSE 'medium' END
    ))
    FROM unnest(v_cats) c
  );
END;
$$;

COMMENT ON FUNCTION public.scan_message_content(text) IS
  'Reads one message and returns [{category, severity}] for whatever it trips. Pure, so it can be tested without writing a message.';

-- ------------------------------------------------------------
-- What the scan found
--
-- Its own table rather than a column on messages, because of who is allowed to
-- know. A tutor who can see that a message was reported can work out which
-- word did it and write the next one differently. Only an admin and the
-- child's own parent read these rows; to everyone else the message looks
-- exactly as it did before.
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.message_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  -- Carried rather than joined for: the parent's view lists a whole
  -- conversation's reports at once, and the admin side counts them per sender.
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category text NOT NULL,
  severity text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT message_reports_category_check
    CHECK (category = ANY (ARRAY['secrecy', 'grooming', 'contact_details', 'off_platform', 'payment'])),
  CONSTRAINT message_reports_severity_check
    CHECK (severity = ANY (ARRAY['high', 'medium'])),
  CONSTRAINT message_reports_one_per_category UNIQUE (message_id, category)
);

CREATE INDEX IF NOT EXISTS message_reports_conversation_idx
  ON public.message_reports (conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS message_reports_sender_idx
  ON public.message_reports (sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS message_reports_severity_idx
  ON public.message_reports (severity, created_at DESC);

ALTER TABLE public.message_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS message_reports_admin_all ON public.message_reports;
DROP POLICY IF EXISTS message_reports_parent_select ON public.message_reports;

CREATE POLICY message_reports_admin_all ON public.message_reports
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- The parent of a child in the conversation, and nobody else in it. There is
-- no INSERT or UPDATE policy at all: only the trigger writes here, and it is
-- SECURITY DEFINER, so row level security does not apply to it.
CREATE POLICY message_reports_parent_select ON public.message_reports
  FOR SELECT USING (public.is_linked_parent_of_conversation(conversation_id));

-- ------------------------------------------------------------
-- Reported messages cannot be rewritten or removed
--
-- msg_update lets any participant update any message in their conversation.
-- Once a message has been reported that becomes a way to erase the evidence
-- between the parent being notified and the parent looking.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.protect_reported_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_admin() THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.message_reports WHERE message_id = OLD.id) THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'This message has been reported and cannot be deleted.';
  END IF;

  -- Marking it read is still allowed. Changing what it says is not.
  IF NEW.content IS DISTINCT FROM OLD.content THEN
    RAISE EXCEPTION 'This message has been reported and cannot be edited.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_reported_message ON public.messages;
CREATE TRIGGER protect_reported_message
  BEFORE UPDATE OR DELETE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.protect_reported_message();

-- ------------------------------------------------------------
-- Telling the parent
-- ------------------------------------------------------------

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type = ANY (ARRAY[
    'booking', 'assignment', 'approval', 'message', 'system', 'parent_link',
    'application', 'unlock_request', 'course_application',
    'course_application_decided', 'enrolment',
    'admissions_plan', 'essay_review', 'payout', 'message_report'
  ]));

CREATE OR REPLACE FUNCTION public.scan_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hits jsonb;
  v_high boolean;
  v_parent uuid;
  v_child_name text;
  -- The parent's own threads live at /parent/messages. Their children's live
  -- here, and this is a notification about a child's conversation.
  v_link text := '/parent/child-chats';
BEGIN
  IF NEW.type IS DISTINCT FROM 'text' OR coalesce(NEW.content, '') = '' THEN
    RETURN NEW;
  END IF;

  v_hits := public.scan_message_content(NEW.content);
  IF jsonb_array_length(v_hits) = 0 THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.message_reports (message_id, conversation_id, sender_id, category, severity)
  SELECT NEW.id, NEW.conversation_id, NEW.sender_id, h ->> 'category', h ->> 'severity'
  FROM jsonb_array_elements(v_hits) h
  ON CONFLICT (message_id, category) DO NOTHING;

  v_high := v_hits @> '[{"severity": "high"}]'::jsonb;

  -- Every active parent of every student in the conversation, except a parent
  -- who wrote the message themselves.
  FOR v_parent, v_child_name IN
    SELECT DISTINCT psl.parent_id, p.full_name
    FROM public.conversation_participants cp
    JOIN public.parent_student_links psl
      ON psl.student_id = cp.user_id AND psl.status = 'active'
    JOIN public.profiles p ON p.id = psl.student_id
    WHERE cp.conversation_id = NEW.conversation_id
      AND psl.parent_id <> NEW.sender_id
  LOOP
    -- One notification per conversation per six hours. An exchange that trips
    -- the scan usually trips it several times over, and six alerts saying the
    -- same thing get dismissed as a batch.
    --
    -- Except when it escalates. A conversation that drifts from a phone number
    -- to "keep this between us" is the whole shape this is looking for, and
    -- letting the first, milder alert silence the one that matters would get
    -- it exactly backwards. So a high-severity message breaks through a quiet
    -- period that only medium ones have earned, once.
    CONTINUE WHEN
      EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.user_id = v_parent
          AND n.type = 'message_report'
          AND n.link = v_link
          AND n.created_at > now() - interval '6 hours'
      )
      AND (
        NOT v_high
        OR EXISTS (
          SELECT 1 FROM public.message_reports r
          WHERE r.conversation_id = NEW.conversation_id
            AND r.severity = 'high'
            AND r.message_id <> NEW.id
            AND r.created_at > now() - interval '6 hours'
        )
      );

    INSERT INTO public.notifications (user_id, type, title, message, link)
    VALUES (
      v_parent,
      'message_report',
      CASE WHEN v_high THEN 'Check a message in ' || coalesce(v_child_name, 'your child') ||
                            '''s conversation'
           ELSE 'Something to look at in ' || coalesce(v_child_name, 'your child') ||
                '''s conversation' END,
      CASE WHEN v_high
           THEN 'A message was written that we think you should read. Open the conversation to see it and report it to us if you agree.'
           ELSE 'A message mentioned contact details or paying outside Yakal. Open the conversation to see it.'
      END,
      v_link
    );
  END LOOP;

  RETURN NEW;
EXCEPTION
  -- Reading messages must never stop anyone sending one. A broken rule here
  -- should cost the protection, loudly, and nothing else.
  WHEN OTHERS THEN
    RAISE WARNING 'scan_message failed for message %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS scan_message ON public.messages;
CREATE TRIGGER scan_message
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.scan_message();

-- ------------------------------------------------------------
-- Who keeps tripping it
--
-- One reported message is a bad day. The same person across several
-- conversations is the pattern worth acting on, and counting it in the client
-- would mean reading every report row to do it.
--
-- security_invoker so the reader's own policies decide what it counts: an
-- admin sees everyone, and nobody else sees anything.
-- ------------------------------------------------------------

DROP VIEW IF EXISTS public.v_sender_report_summary;
CREATE VIEW public.v_sender_report_summary
WITH (security_invoker = true) AS
SELECT
  r.sender_id,
  count(*) FILTER (WHERE r.severity = 'high')   AS high_count,
  count(*) FILTER (WHERE r.severity = 'medium') AS medium_count,
  count(DISTINCT r.conversation_id)             AS conversation_count,
  max(r.created_at)                             AS last_reported_at,
  array_agg(DISTINCT r.category)                AS categories
FROM public.message_reports r
GROUP BY r.sender_id;

GRANT SELECT ON public.v_sender_report_summary TO authenticated;
GRANT EXECUTE ON FUNCTION public.scan_message_content(text) TO authenticated;
