-- ============================================================
-- A flagged-message notification opened to one line and a button.
--
-- Notifications carry template and vars so the detail view can re-render the
-- full paragraph, its facts and its footnote from the template, rather than
-- from prose frozen into the row at send time. detailFor() falls back to the
-- stored title and message when they are absent, which is what every row this
-- trigger has ever written did: the messageReport template has a paragraph
-- explaining that the scan is automatic, that it is often nothing, and that the
-- other person has not been told, and a parent never saw a word of it.
--
-- The stored title and message stay, deliberately. They are the fallback if the
-- template is ever renamed, and they are what the list row shows, which wants
-- one line beside a timestamp.
--
-- The other participant is named because the template asks for them, and
-- because "your child's conversation with Bethlehem" is the sentence a parent
-- needs. It is the participant who is neither the child nor the parent.
-- ============================================================

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
  v_child uuid;
  v_child_name text;
  v_other_name text;
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

  FOR v_parent, v_child, v_child_name IN
    SELECT DISTINCT psl.parent_id, psl.student_id, p.full_name
    FROM public.conversation_participants cp
    JOIN public.parent_student_links psl
      ON psl.student_id = cp.user_id AND psl.status = 'active'
    JOIN public.profiles p ON p.id = psl.student_id
    WHERE cp.conversation_id = NEW.conversation_id
      AND psl.parent_id <> NEW.sender_id
  LOOP
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

    -- Whoever else is in the room. Null rather than a guess when the
    -- conversation has more than two people in it.
    SELECT p.full_name INTO v_other_name
    FROM public.conversation_participants cp
    JOIN public.profiles p ON p.id = cp.user_id
    WHERE cp.conversation_id = NEW.conversation_id
      AND cp.user_id <> v_child
      AND cp.user_id <> v_parent
    LIMIT 1;

    INSERT INTO public.notifications (user_id, type, title, message, link, template, vars)
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
      v_link,
      'messageReport',
      jsonb_build_object(
        'studentName', coalesce(v_child_name, 'your child'),
        'otherName', coalesce(v_other_name, 'the other person'),
        'severity', CASE WHEN v_high THEN 'high' ELSE 'medium' END
      )
    );
  END LOOP;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- A scan that throws must never stop a message being sent.
    RETURN NEW;
END;
$$;
