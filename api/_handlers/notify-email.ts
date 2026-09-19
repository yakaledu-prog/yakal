import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getServiceClient, emailBaseUrl } from '../_utils/supabase.js';
import { callerOrNull } from '../_utils/access.js';
import { sendEmail, layout } from '../_utils/email.js';
import { pushToUser } from '../_utils/push.js';
import { TEMPLATES } from '../../src/lib/notifications/templates/index.js';

/**
 * The email half of a notification.
 *
 * sendFromTemplate writes the in-app row from the browser and stops there,
 * because a browser cannot send email: the Resend key and the SMTP
 * credentials are server-side and must stay that way. So every notification
 * raised from the client appeared in the bell and never reached an inbox,
 * which looked like a broken mail server rather than a missing half.
 *
 * The same templates render both, imported rather than copied, so the email
 * and the notification cannot drift into saying different things.
 *
 * The recipient's address is looked up here from their id. It is never taken
 * from the request: an endpoint that emails whatever address it is handed is
 * an open relay with a login page in front of it.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const caller = await callerOrNull(req);
  if (!caller) return res.status(401).json({ error: 'Sign in first.' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body ?? {};
  // vars in the body is ignored. It used to be rendered straight into the
  // email, so a row that passed the check could be mailed out saying
  // something else entirely.
  const { userId, template } = body as {
    userId?: string;
    template?: keyof typeof TEMPLATES;
  };

  if (!userId || !template) return res.status(400).json({ error: 'userId and template are required.' });

  const entry = TEMPLATES[template];
  if (!entry) return res.status(400).json({ error: `No template named ${String(template)}.` });

  const db = getServiceClient();

  /**
   * Only send where a notification for that person already exists.
   *
   * requireUser alone proved somebody was signed in, not that they had any
   * business emailing the recipient: any account could have posted any
   * template to any user id. The in-app row is written first, under RLS, by
   * whoever is entitled to write it, so requiring a matching row from the last
   * minute makes this endpoint the email half of something already authorised
   * rather than an independent way to send mail.
   *
   * And a row this caller wrote. created_by is stamped by a database trigger
   * and may_notify decided the row could exist at all, so without this a
   * stranger could have mailed out somebody else's notification a second
   * time. The email is rendered from that row's own vars, never the request.
   */
  const { data: raised } = await db
    .from('notifications')
    .select('id, vars')
    .eq('user_id', userId)
    .eq('template', template)
    .eq('created_by', caller.id)
    .gte('created_at', new Date(Date.now() - 60_000).toISOString())
    .order('created_at', { ascending: false })
    .limit(1);

  if (!raised?.length) {
    console.warn(`notify-email refused: no recent ${String(template)} for ${userId} (caller ${caller.id})`);
    return res.status(403).json({ error: 'No matching notification to send.' });
  }
  const vars = (raised[0].vars as Record<string, unknown> | null) ?? {};

  // The push, alongside the email. Both are copies of a row that already
  // exists, both need credentials the browser does not have, and both are
  // authorised by the check above, so asking for them separately would be a
  // second round trip proving the same thing twice.
  //
  // Before the address lookup, not after: somebody with no email on file
  // returns early below, and a student who signed up through an invite often
  // is exactly that person. Their phone should still buzz.
  //
  // The action is still called "email" because that is what every caller
  // names, and renaming it would break them all for a word.
  const rendered = (entry.notification as (v: unknown) => {
    title: string;
    message: string;
    link: string | null;
  })(vars);
  void pushToUser(db, userId, {
    title: rendered.title,
    body: rendered.message,
    url: rendered.link,
    // No tag, for the reason in _utils/notify.ts: keyed on the template it
    // collapsed two different events into one notification.
  });

  const { data: person } = await db
    .from('profiles')
    .select('email, full_name')
    .eq('id', userId)
    .maybeSingle();

  // Not an error worth failing on. The notification is the record; this is the
  // copy, and somebody without an address on file still got the record.
  if (!person?.email) return res.status(200).json({ sent: false, pushed: true, reason: 'no address on file' });

  try {
    const email = (entry.email as (v: unknown) => {
      subject: string;
      heading: string;
      intro: string;
      facts: { label: string; value: string }[];
      cta: { label: string; url: string } | null;
      footer: string | null;
    })(vars);

    const result = await sendEmail({
      to: person.email,
      subject: email.subject,
      html: layout({
        heading: email.heading,
        intro: email.intro,
        facts: email.facts,
        // Templates carry app-relative paths, since the notification uses the
        // same field to route inside the app. An inbox needs the whole URL.
        cta: email.cta
          ? { label: email.cta.label, url: `${emailBaseUrl()}${email.cta.url}` }
          : undefined,
        footer: email.footer ?? undefined,
        recipientName: person.full_name?.split(' ')[0],
      }),
    });

    return res.status(200).json({ sent: result.sent, provider: result.provider, error: result.error });
  } catch (err: any) {
    console.error('notify-email failed:', err);
    return res.status(500).json({ error: err.message });
  }
}
